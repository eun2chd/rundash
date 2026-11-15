import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('saved friends persist per account and respect removal, blocking and ownership', async () => {
  const db = new PGlite()
  const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222', c = '33333333-3333-4333-8333-333333333333'
  const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value
  const identity = async id => {
    await db.exec('reset role; set role authenticated')
    await db.query(`select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{"is_anonymous":false}',false)`, [id])
  }
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key,email text,is_anonymous boolean default false,created_at timestamptz default now(),last_sign_in_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      grant usage on schema auth to anon,authenticated;`)
    const directory = new URL('../supabase/migrations/', import.meta.url)
    for (const file of (await readdir(directory)).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, directory), 'utf8'))
    for (const [id, nickname] of [[a, 'Alice'], [b, 'Bobby'], [c, 'Carol']]) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [id, `${nickname}@private.test`])
      await db.query(`insert into public.profiles(id,nickname,color,skin) values($1,$2,'#e07b39','#f6d1b0')`, [id, nickname])
    }
    await identity(a)
    await db.query('select public.save_running_friend($1,true)', [b])
    await db.query('select public.save_running_friend($1,true)', [b])
    let rows = await scalar('select public.list_saved_running_friends() value')
    assert.equal(rows.length, 1); assert.equal(rows[0].nickname, 'Bobby'); assert.equal(rows[0].online, false)
    assert.ok(!JSON.stringify(rows).includes('@private.test'))
    await assert.rejects(db.query('select * from public.saved_running_friends'), /permission denied/)
    await assert.rejects(db.query('select public.save_running_friend($1,true)', [a]), /친구로 추가/)
    await identity(c); assert.deepEqual(await scalar('select public.list_saved_running_friends() value'), [])
    await identity(a)
    assert.equal((await scalar('select public.list_saved_running_friends() value'))[0].nickname, 'Bobby')
    await db.query('select public.save_running_friend($1,false)', [b])
    assert.deepEqual(await scalar('select public.list_saved_running_friends() value'), [])
    await db.query('select public.save_running_friend($1,true)', [b])
    await identity(b); await db.query('select public.save_running_friend($1,true)', [a])
    await db.query('select public.block_running_friend($1,true)', [a])
    assert.deepEqual(await scalar('select public.list_saved_running_friends() value'), [])
    await identity(a)
    assert.deepEqual(await scalar('select public.list_saved_running_friends() value'), [])
    await assert.rejects(db.query('select public.save_running_friend($1,true)', [b]), /친구로 추가/)
    await db.query(`select set_config('request.jwt.claims','{"is_anonymous":true}',false)`)
    await assert.rejects(db.query('select public.list_saved_running_friends()'), /정식 계정/)
  } finally { await db.close() }
})
