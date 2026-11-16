import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { DEFAULT_SETTINGS } from '../src/lib/settings.js'

test('attendance rules come from game settings and admins can change them', async t => {
 const db = new PGlite()
 const boss = '11111111-1111-4111-8111-111111111111', alice = '22222222-2222-4222-8222-222222222222'
 let n = 0
 const rid = () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++n).padStart(12, '0')}`
 const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value
 const identity = async (id) => { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{\"is_anonymous\":false}',false)", [id]) }
 const run = async (distanceKm) => {
  const id = rid()
  await identity(alice); await scalar("select public.start_training_run($1,1,'steady') value", [id])
  await db.exec('reset role'); await db.query("update public.training_sessions set started_at=clock_timestamp()-interval '3600 seconds' where id=$1", [id])
  await identity(alice); return scalar('select public.finish_training_run($1,$2) value', [id, JSON.stringify({ distanceKm, elapsedSec: 3000, completed: false })])
 }
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key,email text,is_anonymous boolean default false,created_at timestamptz default now(),last_sign_in_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
   grant usage on schema auth to anon,authenticated;`)
  const directory = new URL('../supabase/migrations/', import.meta.url)
  for (const file of (await readdir(directory)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, directory), 'utf8'))
  for (const [id, nickname] of [[boss, 'Boss'], [alice, 'Alice']]) {
   await db.query('insert into auth.users(id,email) values($1,$2)', [id, nickname.toLowerCase() + '@private.test'])
   await db.query("insert into public.profiles(id,nickname,color,skin) values($1,$2,'#e07b39','#f6d1b0')", [id, nickname])
  }
  await db.query('insert into public.admin_members(user_id) values($1)', [boss])

  await t.test('stored defaults match the app and the previous fixed rules', async () => {
   const value = await scalar('select public.current_game_settings() value')
   for (const key of ['attendanceMinKm', 'attendanceDailyXp', 'attendanceStreakEvery', 'attendanceStreakBonusXp']) assert.equal(Number(value[key]), DEFAULT_SETTINGS[key], key)
   await identity(alice)
   const status = await scalar('select public.attendance_status() value')
   assert.deepEqual({ ...status.rules, minKm: Number(status.rules.minKm) }, { minKm: 5, dailyXp: 50, streakEvery: 7, streakBonusXp: 300, timeZone: 'Asia/Seoul' })
  })
  await t.test('admins save new attendance rules and the next check-in uses them', async () => {
   await db.exec('reset role'); const version = Number(await scalar('select version value from public.game_settings'))
   await identity(boss)
   const next = { ...structuredClone(DEFAULT_SETTINGS), attendanceMinKm: 1, attendanceDailyXp: 80, attendanceStreakEvery: 3, attendanceStreakBonusXp: 500 }
   await assert.rejects(db.query('select public.admin_save_settings($1,$2)', [JSON.stringify({ ...next, attendanceStreakEvery: 1 }), version]), /attendanceStreakEvery/)
   await assert.rejects(db.query('select public.admin_save_settings($1,$2)', [JSON.stringify({ ...next, attendanceDailyXp: 1.5 }), version]), /attendanceDailyXp/)
   assert.equal(await scalar('select public.admin_save_settings($1,$2) value', [JSON.stringify(next), version]), version + 1)
   assert.equal((await run(0.7)).attendance.checked, false)
   const checked = (await run(1)).attendance
   assert.equal(checked.checked, true); assert.equal(checked.xp, 80)
   await identity(alice)
   assert.equal((await scalar('select public.attendance_status() value')).rules.streakEvery, 3)
  })
 } finally { await db.close() }
})
