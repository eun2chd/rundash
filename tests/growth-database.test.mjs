import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { trainingFor, xpForLevel } from '../src/lib/progression.js'

test('growth SQL: ownership, reward integrity, retry safety, practice and level parity', async (t) => {
  const db = new PGlite()
  const alice = '11111111-1111-4111-8111-111111111111'
  const bob = '22222222-2222-4222-8222-222222222222'
  const anon = '33333333-3333-4333-8333-333333333333'
  const runId = (n) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`
  const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value
  const identity = async (id, anonymous = false) => {
    await db.exec('reset role; set role authenticated;')
    await db.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)`, [id, JSON.stringify({ is_anonymous: anonymous })])
  }
  const start = (id, target = 1, intensity = 'steady') => scalar('select public.start_training_run($1,$2,$3) as value', [id, target, intensity])
  const finish = (id, details) => scalar('select public.finish_training_run($1,$2) as value', [id, JSON.stringify(details)])
  const ageRun = async (id, seconds) => {
    await db.exec('reset role;')
    await db.query(`update public.training_sessions set started_at = clock_timestamp() - ($2::text || ' seconds')::interval where id=$1`, [id, seconds])
    await identity(alice)
  }
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
      grant usage on schema auth to anon, authenticated;
    `)
    for (const file of ['202611140001_initial.sql', '202611140002_signup_nickname_check.sql', '202611140003_runner_outfit.sql', '202611140004_runner_growth.sql', '202611140005_runner_chat.sql']) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
    }
    await db.query('insert into auth.users(id) values ($1), ($2), ($3)', [alice, bob, anon])
    for (const [id, nickname] of [[alice, 'Alice'], [bob, 'Bobby'], [anon, 'Guest']]) await db.query(`insert into public.profiles(id,nickname,color,skin) values ($1,$2,'#e07b39','#f6d1b0')`, [id, nickname])

    await t.test('client cannot set XP, insert fake runs, or use another account session', async () => {
      await identity(alice)
      await start(runId(1))
      await assert.rejects(db.query('update public.runner_progress set xp=999999 where user_id=$1', [alice]), /permission denied/)
      await assert.rejects(db.query(`insert into public.runs(user_id,details) values ($1,'{}')`, [alice]), /permission denied/)
      await identity(bob)
      assert.equal((await db.query('select * from public.runner_progress')).rows.length, 0)
      await assert.rejects(start(runId(1)), /러닝/)
      await assert.rejects(finish(runId(1), { distanceKm: 1, elapsedSec: 600 }), /러닝/)
      await identity(anon, true)
      await assert.rejects(start(runId(2)), /정식 계정/)
    })

    await t.test('real-time completion awards once and a retry returns the original result', async () => {
      await identity(alice)
      await ageRun(runId(1), 610)
      const result = await finish(runId(1), { distanceKm: 1, elapsedSec: 600, completed: true, growth: { xpEarned: 999999 } })
      assert.equal(result.run.details.growth.xpEarned, 120)
      assert.equal(result.progression.xp, 120)
      assert.equal(result.run.details.growth.levelAfter, 2)
      const retry = await finish(runId(1), { distanceKm: 1, elapsedSec: 600, completed: true })
      assert.equal(retry.progression.xp, 120)
      assert.equal(retry.run.id, result.run.id)
      assert.equal((await db.query('select * from public.runs')).rows.length, 1)
    })

    await t.test('server clock catches accelerated results; returning to 1x cannot remove practice', async () => {
      await start(runId(3))
      const fast = await finish(runId(3), { distanceKm: 1, elapsedSec: 600, completed: true, practice: false })
      assert.equal(fast.run.details.practice, true)
      assert.equal(fast.run.details.growth.xpEarned, 0)
      assert.equal(fast.progression.xp, 120)
      await start(runId(4))
      await db.query('select public.mark_training_practice($1)', [runId(4)])
      await ageRun(runId(4), 600)
      const marked = await finish(runId(4), { distanceKm: 1, elapsedSec: 585, completed: true, practice: false })
      assert.equal(marked.run.details.practice, true)
      assert.equal(marked.progression.xp, 120)
    })

    await t.test('partial runs earn distance XP and session target cannot be forged', async () => {
      await start(runId(5))
      await ageRun(runId(5), 310)
      const result = await finish(runId(5), { distanceKm: .5, elapsedSec: 300, completed: true, targetKm: .5 })
      assert.equal(result.run.details.completed, false)
      assert.equal(result.run.details.targetKm, 1)
      assert.equal(result.run.details.growth.xpEarned, 50)
      assert.equal(result.progression.xp, 170)
      assert.equal(Number(result.progression.total_distance_km), 1.5)
    })

    await t.test('a newer session invalidates an old one; SQL and JS level curves agree', async () => {
      await start(runId(6))
      await start(runId(7))
      await assert.rejects(finish(runId(6), { distanceKm: 0, elapsedSec: 0 }), /다른 창/)
      await db.exec('reset role;')
      for (let level = 1; level <= 50; level++) {
        assert.equal(await scalar('select public.training_level($1) as value', [xpForLevel(level)]), level)
        for (const intensity of ['easy', 'steady', 'challenge']) assert.equal(await scalar('select public.training_pace($1,$2) as value', [level, intensity]), trainingFor(xpForLevel(level), intensity).paceSec)
      }
    })

    await t.test('a legitimate unlocked booster can earn XP without being misclassified as accelerated', async () => {
      await db.query('update public.runner_progress set xp=$1 where user_id=$2', [xpForLevel(5), alice])
      await identity(alice)
      const ticket = await start(runId(8))
      assert.equal(ticket.xp, xpForLevel(5))
      await ageRun(runId(8), 12)
      const boostedDistance = 8 * 1.5 / trainingFor(ticket.xp, 'steady').paceSec
      const result = await finish(runId(8), { distanceKm: boostedDistance, elapsedSec: 8, completed: false, boostUses: 1 })
      assert.equal(result.run.details.practice, false)
      assert.equal(result.run.details.growth.xpEarned, Math.floor(boostedDistance * 100))
    })

    await t.test('chat sender identity, length limit and server rate limiting cannot be bypassed', async () => {
      await identity(alice)
      const sent = await scalar('select public.send_race_message($1,$2) as value', ['Hello runners', 'FakeName'])
      assert.equal(sent.nickname, 'Alice')
      assert.equal(sent.user_id, alice)
      assert.equal(sent.is_anonymous, false)
      await assert.rejects(scalar('select public.send_race_message($1,$2) as value', ['Again', 'Alice']), /2초/)
      await assert.rejects(scalar('select public.send_race_message($1,$2) as value', [' ', 'Alice']), /1~300/)
      await assert.rejects(scalar('select public.send_race_message($1,$2) as value', ['x'.repeat(301), 'Alice']), /1~300/)
      await assert.rejects(db.query(`insert into public.race_messages(user_id,nickname,is_anonymous,message) values ($1,'Fake',false,'forged')`, [bob]), /permission denied/)
      await assert.rejects(db.query('update public.race_chat_limits set last_sent_at=now()'), /permission denied/)
      await identity(bob)
      assert.equal((await db.query('select * from public.race_messages')).rows.length, 1)
      await identity(anon, true)
      await assert.rejects(scalar('select public.send_race_message($1,$2) as value', ['Hi', 'Alice']), /사용 중/)
      const anonymousMessage = await scalar('select public.send_race_message($1,$2) as value', ['<script>text only</script>', 'AnonRunner'])
      assert.equal(anonymousMessage.is_anonymous, true)
      assert.equal(anonymousMessage.message, '<script>text only</script>')
      await db.exec('reset role; set role anon;')
      await assert.rejects(db.query('select * from public.race_messages'), /permission denied/)
      await assert.rejects(scalar('select public.send_race_message($1,$2) as value', ['Hi', 'Unknown']), /permission denied/)
    })
  } finally { await db.close() }
})
