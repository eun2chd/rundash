import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('admin run records list saved and open runs, filter them, and close abandoned runs', async t => {
 const db = new PGlite()
 const boss = '11111111-1111-4111-8111-111111111111', alice = '22222222-2222-4222-8222-222222222222', bob = '33333333-3333-4333-8333-333333333333'
 const stale = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001', fresh = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002'
 const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value
 const identity = async (id) => { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{\"is_anonymous\":false}',false)", [id]) }
 const records = (query = '', page = 0, type = '', view = 'saved') => scalar('select public.admin_run_records($1,$2,$3,$4) value', [query, page, type, view])
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
  for (let i = 0; i < 12; i++) await db.query("insert into public.runs(user_id,details,created_at) values($1,$2,now()-($3||' minutes')::interval)",
   [i % 2 ? alice : bob, JSON.stringify({ distanceKm: i + 1, elapsedSec: 400 * (i + 1), completed: i % 3 === 0, practice: i === 5, autoUsed: i === 4, items: [{ id: 'heavy' }] }), String(i)])
  await db.query("insert into public.training_sessions(id,user_id,xp_at_start,intensity,target_km,pace_sec,started_at,rules) values($1,$2,0,'steady',10,420,now()-interval '30 hours','{}'),($3,$4,0,'easy',5,480,now()-interval '5 minutes','{}')", [stale, alice, fresh, bob])
  await db.query('insert into public.runner_progress(user_id,active_run_id) values($1,$2),($3,$4)', [alice, stale, bob, fresh])
  await db.query('insert into public.running_checkpoints(run_id,user_id,payload) values($1,$2,$3)', [stale, alice, '{}'])

  await t.test('only admins can read run records', async () => {
   await identity(alice)
   await assert.rejects(records(), /관리자/)
   await assert.rejects(scalar('select public.admin_close_run($1,$2)', [stale, 'cleanup']), /관리자/)
  })
  await t.test('saved runs page newest first, filter by type and nickname, and drop heavy course data', async () => {
   await identity(boss)
   const all = await records()
   assert.equal(all.total, 12); assert.equal(all.items.length, 10)
   assert.equal(Number(all.items[0].details.distanceKm), 1)
   assert.equal(all.items[0].details.items, undefined)
   assert.deepEqual(all.summary, { all: 12, practice: 1, completed: 4, auto: 1 })
   assert.equal((await records('', 1)).items.length, 2)
   assert.equal((await records('', 0, 'practice')).total, 1)
   assert.equal((await records('', 0, 'completed')).total, 4)
   assert.equal((await records('', 0, 'partial')).total, 7)
   assert.equal((await records('', 0, 'auto')).items[0].details.autoUsed, true)
   assert.equal((await records('ali')).total, 6)
   await assert.rejects(records('', 0, 'bogus'), /필터/)
  })
  await t.test('open runs show which are stale', async () => {
   const open = await records('', 0, '', 'active')
   assert.equal(open.total, 2); assert.deepEqual(open.summary, { open: 2, stale: 1 })
   assert.equal(open.items[0].id, fresh)
   const old = await records('', 0, 'stale', 'active')
   assert.deepEqual(old.items.map(row => [row.id, row.stale]), [[stale, true]])
  })
  await t.test('closing a run ends it without XP and clears its traces', async () => {
   await assert.rejects(scalar('select public.admin_close_run($1,$2)', [stale, ' ']), /사유/)
   await db.query('select public.admin_close_run($1,$2)', [stale, '24시간 방치'])
   await db.exec('reset role')
   const session = (await db.query('select finished_at,practice from public.training_sessions where id=$1', [stale])).rows[0]
   assert.ok(session.finished_at); assert.equal(session.practice, true)
   assert.equal(await scalar('select active_run_id value from public.runner_progress where user_id=$1', [alice]), null)
   assert.equal(Number(await scalar('select count(*) value from public.running_checkpoints where run_id=$1', [stale])), 0)
   assert.equal(await scalar("select action value from public.admin_audit where target=$1", [stale]), 'run_closed')
   await identity(boss)
   await assert.rejects(scalar('select public.admin_close_run($1,$2)', [stale, 'again']), /이미 끝난/)
   assert.equal((await records('', 0, '', 'active')).total, 1)
  })
 } finally { await db.close() }
})
