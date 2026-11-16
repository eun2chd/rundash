import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { DEFAULT_SETTINGS } from '../src/lib/settings.js'

test('100 levels: random per-km XP, capped score bonus, level table and settings validation', async t => {
 const db = new PGlite()
 const a = '11111111-1111-4111-8111-111111111111', admin = '22222222-2222-4222-8222-222222222222'
 let n = 0
 const rid = () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++n).padStart(12, '0')}`
 const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value
 const identity = async (id) => { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{\"is_anonymous\":false}',false)", [id]) }
 const root = () => db.exec('reset role')
 // Starts a run, ages it so the distance is physically possible, then saves it (after the attendance day is used up).
 const run = async (distanceKm, extra = {}, target = 10) => {
  const id = rid()
  await identity(a); await scalar("select public.start_training_run($1,$2,'steady') value", [id, target])
  await root(); await db.query("update public.training_sessions set started_at=clock_timestamp()-interval '30000 seconds' where id=$1", [id])
  await identity(a); return scalar('select public.finish_training_run($1,$2) value', [id, JSON.stringify({ distanceKm, elapsedSec: 29000, completed: false, ...extra })])
 }
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key,email text,is_anonymous boolean default false,created_at timestamptz default now(),last_sign_in_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
   grant usage on schema auth to anon,authenticated;`)
  const directory = new URL('../supabase/migrations/', import.meta.url)
  for (const file of (await readdir(directory)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, directory), 'utf8'))
  for (const [id, nickname] of [[a, 'Alice'], [admin, 'Bobby']]) {
   await db.query('insert into auth.users(id,email) values($1,$2)', [id, nickname + '@private.test'])
   await db.query("insert into public.profiles(id,nickname,color,skin) values($1,$2,'#e07b39','#f6d1b0')", [id, nickname])
  }
  await db.query('insert into public.admin_members(user_id) values($1)', [admin])

  await t.test('stored settings carry 100 levels with the same XP table as the app', async () => {
   const value = await scalar('select public.current_game_settings() value')
   assert.equal(value.levels.length, 100)
   assert.deepEqual(value.levels.map(row => row.xp), DEFAULT_SETTINGS.levels.map(row => row.xp))
   assert.equal(value.xpPerKmMin, 10); assert.equal(value.xpPerKmMax, 100); assert.equal(value.scorePointsPerXp, 10); assert.equal(value.autoLevel, 80)
   assert.equal(value.xpBase, undefined); assert.equal(value.xpPerKm, undefined)
   for (const level of [1, 2, 50, 80, 100]) {
    const xp = DEFAULT_SETTINGS.levels[level - 1].xp
    assert.equal(await scalar('select public.training_level($1) value', [xp]), level)
    if (level > 1) assert.equal(await scalar('select public.training_level($1) value', [xp - 1]), level - 1)
   }
   assert.equal(await scalar('select public.training_level($1) value', [99999999]), 100)
   assert.equal(await scalar("select public.training_pace(100,'challenge') value"), DEFAULT_SETTINGS.levels[99].pace)
   // Snapshots taken before this migration still resolve with the old formula.
   assert.equal(await scalar(`select public.rules_level(2400, '{"xpBase":300,"xpStep":100,"levels":[{"level":1,"pace":540}]}'::jsonb) value`), 5)
  })

  await t.test('each km rolls 10~100 XP and the score adds 1 XP per 10 points up to the distance XP', async () => {
   await run(0.5) // uses up today's attendance so later rewards are pure run XP
   const seen = new Set()
   for (let i = 0; i < 6; i++) {
    const growth = (await run(5)).run.details.growth
    assert.ok(growth.distanceXp >= 50 && growth.distanceXp <= 500, `distance XP ${growth.distanceXp}`)
    assert.equal(growth.scoreXp, 0); assert.equal(growth.completionXp, 0)
    seen.add(growth.distanceXp)
   }
   assert.ok(seen.size > 1, 'per-km XP should vary between runs')
   const partial = (await run(0.3)).run.details.growth
   assert.ok(partial.distanceXp >= 3 && partial.distanceXp <= 30)
   const scored = (await run(5, { score: 250 })).run.details.growth
   assert.equal(scored.scoreXp, Math.min(25, scored.distanceXp))
   const capped = (await run(1, { score: 100000 })).run.details.growth
   assert.equal(capped.scoreXp, capped.distanceXp)
   assert.equal(capped.xpEarned, capped.distanceXp * 2)
   assert.equal((await run(2, { score: 'lots' })).run.details.growth.scoreXp, 0)
   const done = (await run(1, { completed: true, score: 30 }, 1)).run.details.growth
   assert.equal(done.completionXp, Math.floor(done.distanceXp * .2))
   assert.equal(done.xpEarned, done.distanceXp + done.completionXp + done.scoreXp)
   const practice = (await run(5, { practice: true, score: 900 })).run.details.growth
   assert.equal(practice.xpEarned, 0); assert.equal(practice.scoreXp, 0)
  })

  await t.test('admins save 100 rising levels; bad tables and ranges are rejected', async () => {
   await identity(admin)
   await root(); const version = Number(await scalar('select version value from public.game_settings')); await identity(admin)
   const good = structuredClone(DEFAULT_SETTINGS)
   good.xpPerKmMin = 20; good.xpPerKmMax = 80
   const reject = async (value, pattern) => assert.rejects(db.query('select public.admin_save_settings($1,$2)', [JSON.stringify(value), version]), pattern)
   await reject({ ...good, levels: good.levels.slice(0, 50) }, /100개 레벨/)
   await reject({ ...good, xpPerKmMin: 90, xpPerKmMax: 40 }, /최소 경험치/)
   await reject({ ...good, autoLevel: 0 }, /autoLevel/)
   await reject({ ...good, levels: good.levels.map(row => row.level === 10 ? { ...row, xp: 1 } : row) }, /누적 경험치/)
   await reject({ ...good, levels: good.levels.map(row => row.level === 1 ? { ...row, xp: 5 } : row) }, /누적 경험치/)
   const { xp, ...noXp } = good.levels[3]
   await reject({ ...good, levels: good.levels.map((row, i) => i === 3 ? noXp : row) }, /레벨 설정/)
   assert.equal(await scalar('select public.admin_save_settings($1,$2) value', [JSON.stringify(good), version]), version + 1)
   await root()
   assert.equal((await scalar('select public.current_game_settings() value')).xpPerKmMax, 80)
  })
 } finally { await db.close() }
})
