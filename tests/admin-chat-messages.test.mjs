import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('admins browse all chat messages, delete any message and can suspend its author', async t => {
 const db = new PGlite()
 const boss = '11111111-1111-4111-8111-111111111111', alice = '22222222-2222-4222-8222-222222222222', bob = '33333333-3333-4333-8333-333333333333'
 const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value
 const identity = async (id) => { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{\"is_anonymous\":false}',false)", [id]) }
 const list = (query = '', page = 0, filter = '') => scalar('select public.admin_chat_messages($1,$2,$3) value', [query, page, filter])
 const remove = (id, reason = '욕설 메시지', suspend = false) => scalar('select public.admin_delete_chat_message($1,$2,$3) value', [id, reason, suspend])
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key,email text,is_anonymous boolean default false,created_at timestamptz default now(),last_sign_in_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
   grant usage on schema auth to anon,authenticated;`)
  const directory = new URL('../supabase/migrations/', import.meta.url)
  for (const file of (await readdir(directory)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, directory), 'utf8'))
  for (const [id, nickname] of [[boss, 'Boss'], [alice, 'Alice'], [bob, 'Bobby']]) {
   await db.query('insert into auth.users(id,email) values($1,$2)', [id, nickname.toLowerCase() + '@private.test'])
   await db.query("insert into public.profiles(id,nickname,color,skin) values($1,$2,'#e07b39','#f6d1b0')", [id, nickname])
  }
  await db.query('insert into public.admin_members(user_id) values($1)', [boss])
  for (let i = 0; i < 25; i++) await db.query("insert into public.race_messages(user_id,nickname,is_anonymous,message,created_at) values($1,$2,false,$3,now()-($4||' seconds')::interval)", [i % 2 ? alice : bob, i % 2 ? 'Alice' : 'Bobby', i === 3 ? '나쁜 말 메시지' : `hello ${i}`, String(i)])
  await db.query("insert into public.race_messages(user_id,nickname,is_anonymous,message) values($1,'Boss',false,'공지 메시지')", [boss])
  const bad = await scalar("select id value from public.race_messages where message='나쁜 말 메시지'")
  const notice = await scalar("select id value from public.race_messages where nickname='Boss'")
  await db.query("insert into public.race_message_reports(message_id,reporter_id,author_id,author_nickname,message,message_created_at,reason) select id,$1,user_id,nickname,message,created_at,'abuse' from public.race_messages where id=$2", [bob, bad])

  await t.test('only admins read and delete messages', async () => {
   await identity(alice)
   await assert.rejects(list(), /관리자/)
   await assert.rejects(remove(bad), /관리자/)
  })
  await t.test('messages page newest first and filter by text, nickname and reports', async () => {
   await identity(boss)
   const all = await list()
   assert.equal(all.total, 26); assert.equal(all.items.length, 10); assert.equal(all.items[0].id, notice)
   assert.equal(all.items[0].author_admin, true)
   assert.equal(all.summary.all, 26); assert.equal(all.summary.reported, 1)
   assert.equal((await list('', 2)).items.length, 6)
   assert.equal((await list('나쁜')).total, 1)
   assert.equal((await list('alice')).total, 12)
   const reported = await list('', 0, 'reported')
   assert.deepEqual(reported.items.map(row => [row.id, row.open_reports]), [[bad, 1]])
   await assert.rejects(list('', 0, 'bogus'), /필터/)
  })
  await t.test('deleting closes open reports, can suspend the author, and is audited', async () => {
   await assert.rejects(remove(bad, ' '), /사유/)
   await assert.rejects(remove(notice, '테스트', true), /관리자 계정/)
   assert.deepEqual(await remove(bad, '욕설 메시지', true), { removed: true, suspended: true })
   await db.exec('reset role')
   assert.equal(Number(await scalar('select count(*) value from public.race_messages where id=$1', [bad])), 0)
   assert.equal(await scalar('select status value from public.race_message_reports where message_id=$1', [bad]), 'removed')
   assert.equal(await scalar('select suspended value from public.account_controls where user_id=$1', [alice]), true)
   assert.deepEqual((await db.query("select action from public.admin_audit order by id")).rows.map(row => row.action).slice(-2), ['chat_remove', 'suspend'])
   await identity(boss)
   await assert.rejects(remove(bad), /이미 삭제/)
   assert.equal((await list('', 0, 'suspended')).total, 11)
   assert.deepEqual(await remove(notice, '오래된 공지'), { removed: true, suspended: false })
  })
 } finally { await db.close() }
})
