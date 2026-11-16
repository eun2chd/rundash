import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('admin dashboard summarises today, 14 days, live state and levels without test accounts', async t => {
 const db = new PGlite()
 const boss = '11111111-1111-4111-8111-111111111111', runner = '22222222-2222-4222-8222-222222222222', tester = '33333333-3333-4333-8333-333333333333'
 const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value
 const identity = async (id) => { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{\"is_anonymous\":false}',false)", [id]) }
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key,email text,is_anonymous boolean default false,created_at timestamptz default now(),last_sign_in_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
   grant usage on schema auth to anon,authenticated;`)
  const directory = new URL('../supabase/migrations/', import.meta.url)
  for (const file of (await readdir(directory)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, directory), 'utf8'))
  for (const [id, nickname] of [[boss, 'Boss'], [runner, 'Runner'], [tester, 'Tester']]) {
   await db.query('insert into auth.users(id,email) values($1,$2)', [id, nickname.toLowerCase() + '@private.test'])
   await db.query("insert into public.profiles(id,nickname,color,skin) values($1,$2,'#e07b39','#f6d1b0')", [id, nickname])
  }
  await db.exec("insert into auth.users(id,is_anonymous) select gen_random_uuid(), true from generate_series(1,3)")
  await db.query('insert into public.admin_members(user_id) values($1)', [boss])
  await db.query('insert into public.test_accounts(user_id) values($1)', [tester])
  await db.query('insert into public.runner_progress(user_id,xp,total_distance_km,run_count) values($1,2000000,40,4),($2,500,3,1),($3,9999999,999,99)', [boss, runner, tester])
  const run = (user, details, ago = '0 hours') => db.query(`insert into public.runs(user_id,details,created_at) values($1,$2,now()-$3::interval)`, [user, JSON.stringify(details), ago])
  await run(runner, { distanceKm: 5, elapsedSec: 2500, score: 120, completed: true, practice: false, intensity: 'easy', growth: { xpEarned: 300 } })
  await run(runner, { distanceKm: 2, completed: false, practice: true, intensity: 'steady', growth: { xpEarned: 0 } })
  await run(boss, { distanceKm: 3, elapsedSec: 1100, score: 40, completed: false, practice: false, intensity: 'challenge', growth: { xpEarned: 200 } }, '3 days')
  await run(tester, { distanceKm: 50, completed: true, practice: false, intensity: 'easy', growth: { xpEarned: 9000 } })
  await db.query("insert into public.support_tickets(user_id,category,title,body) values($1,'bug','Broken thing','Detailed reproduction steps')", [runner])

  await identity(runner)
  await assert.rejects(scalar('select public.admin_dashboard() value'), /관리자/)
  await identity(boss)
  const board = await scalar('select public.admin_dashboard() value')

  await t.test('today counts real runs only and skips test accounts and practice', () => {
   assert.equal(board.today.runs, 1); assert.equal(board.today.completed, 1); assert.equal(board.today.practice, 1)
   assert.equal(Number(board.today.km), 5); assert.equal(Number(board.today.xp), 300)
   assert.equal(board.today.signups, 2); assert.equal(board.today.anonymous, 3)
  })
  await t.test('14 daily points end today and include older runs', () => {
   assert.equal(board.daily.length, 14)
   assert.equal(board.daily.reduce((sum, day) => sum + day.runs, 0), 2)
   assert.equal(Number(board.daily.at(-1).km), 5)
   assert.equal(board.hours.length, 24)
   assert.deepEqual(board.intensity, { easy: 1, steady: 0, challenge: 1, custom: 0 })
  })
  await t.test('averages, distance and pace spread, top runners', () => {
   assert.equal(board.averages.runs, 2); assert.equal(board.averages.runners, 2)
   assert.equal(Number(board.averages.km), 4); assert.equal(Number(board.averages.paceSec), 450)
   assert.equal(Number(board.averages.elapsedSec), 1800); assert.equal(Number(board.averages.score), 80)
   assert.equal(Number(board.averages.completionRate), 50)
   assert.deepEqual(board.distances.map(row => row.runs), [0, 0, 1, 1, 0, 0])
   assert.deepEqual(board.paces.map(row => row.runs), [0, 0, 1, 0, 1, 0])
   assert.deepEqual(board.topRunners.map(row => [row.nickname, Number(row.km)]), [['Runner', 5], ['Boss', 3]])
   assert.equal(Number(board.daily.at(-1).avgPaceSec), 500)
  })
  await t.test('totals, levels, waiting work and purge status', () => {
   assert.equal(board.totals.members, 2); assert.equal(board.totals.anonymous, 3); assert.equal(Number(board.totals.km), 43)
   assert.equal(board.totals.autoRunners, 1)
   assert.deepEqual(board.levels.map(row => row.runners), [1, 0, 0, 0, 1])
   assert.equal(board.pending.support, 1); assert.equal(board.pending.reports, 0)
   assert.equal(board.purge.available, false)
   assert.deepEqual(board.now, { running: 0, paused: 0, groups: 0, staleSessions: 0 })
  })
 } finally { await db.close() }
})
