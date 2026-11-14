import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { trainingFor, xpForLevel } from '../src/lib/progression.js'
import { configureSettings, DEFAULT_SETTINGS } from '../src/lib/settings.js'

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
      create table auth.users(id uuid primary key,email text,is_anonymous boolean default false,created_at timestamptz default now(),last_sign_in_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
      grant usage on schema auth to anon, authenticated;
    `)
    for (const file of ['202611140001_initial.sql', '202611140002_signup_nickname_check.sql', '202611140003_runner_outfit.sql', '202611140004_runner_growth.sql', '202611140005_runner_chat.sql', '202611140006_account_profile.sql', '202611140007_admin_support_settings.sql', '202611140008_course_chat_settings.sql', '202611140009_admin_member_details.sql']) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
    }
    await db.query('insert into auth.users(id) values ($1), ($2), ($3)', [alice, bob, anon])
    for (const [id, nickname] of [[alice, 'Alice'], [bob, 'Bobby'], [anon, 'Guest']]) await db.query(`insert into public.profiles(id,nickname,color,skin) values ($1,$2,'#e07b39','#f6d1b0')`, [id, nickname])

    await t.test('profile photo is private and validated; nickname stays immutable', async () => {
      await identity(alice)
      await db.query('update public.profiles set avatar_image=$1 where id=$2', ['data:image/jpeg;base64,/9j/AA==', alice])
      assert.equal(await scalar('select avatar_image as value from public.profiles where id=$1', [alice]), 'data:image/jpeg;base64,/9j/AA==')
      await assert.rejects(db.query('update public.profiles set avatar_image=$1 where id=$2', ['https://example.com/a.svg', alice]), /profiles_avatar_image_valid/)
      await assert.rejects(db.query('update public.profiles set nickname=$1 where id=$2', ['Changed', alice]), /Nickname cannot be changed/)
      await identity(bob)
      assert.equal((await db.query('select avatar_image from public.profiles where id=$1', [alice])).rows.length, 0)
      assert.equal((await db.query('update public.profiles set avatar_image=null where id=$1 returning id', [alice])).rows.length, 0)
      await identity(alice)
      await db.query('update public.profiles set avatar_image=null where id=$1', [alice])
      assert.equal(await scalar('select avatar_image as value from public.profiles where id=$1', [alice]), null)
    })

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
    await t.test('admin APIs reject forged roles and preserve support privacy, limits and replies', async () => {
      await identity(alice)
      assert.equal(await scalar('select public.is_admin() as value'), false)
      await assert.rejects(scalar('select public.admin_members_list() as value'), /관리자/)
      await assert.rejects(scalar('select public.admin_member_runs($1) as value',[bob]), /관리자/)
      await assert.rejects(db.query('insert into public.admin_members(user_id) values($1)', [alice]), /permission denied/)
      const id = await scalar('select public.submit_support($1,$2,$3) as value', ['bug','Test bug','Detailed reproduction steps'])
      await assert.rejects(scalar('select public.submit_support($1,$2,$3) as value', ['feature','New feature','Another detailed feature suggestion']), /1분/)
      await identity(bob)
      assert.equal((await db.query('select * from public.support_tickets')).rows.length, 0)
      await db.exec('reset role;')
      await db.query('insert into public.admin_members(user_id) values($1)', [bob])
      await identity(bob)
      const list = await scalar('select public.admin_support() as value')
      assert.equal((await scalar('select public.admin_members_list() as value')).total, 3)
      assert.ok((await scalar('select public.admin_member_runs($1) as value',[alice])).total > 0)
      assert.equal(list.items[0].id, id)
      await db.query('select public.admin_reply_support($1,$2,$3)', [id,'resolved','Fixed this issue'])
      await identity(alice)
      assert.equal((await db.query('select reply from public.support_tickets')).rows[0].reply, 'Fixed this issue')
      await assert.rejects(db.query("update public.support_tickets set reply='forged'"), /permission denied/)
    })
    await t.test('settings are versioned, validated and snapshotted across an active run', async () => {
      await identity(alice)
      const ticket = await start(runId(90))
      assert.equal(ticket.settings.xpPerKm, 100)
      await identity(bob)
      const next = structuredClone(DEFAULT_SETTINGS)
      next.xpPerKm = 200; next.xpBase = 150; next.levels[0].pace = 570; next.chatMaxLength = 20; next.chatInterval = 5
      await assert.rejects(db.query('select public.admin_save_settings($1,1)', [JSON.stringify({ ...next, stationEveryM: 0 })]), /Invalid setting/)
      const bad = structuredClone(next); bad.levels[0].pace = null
      await assert.rejects(db.query('select public.admin_save_settings($1,1)', [JSON.stringify(bad)]), /레벨 설정/)
      assert.equal(await scalar('select public.admin_save_settings($1,1) as value', [JSON.stringify(next)]), 2)
      await identity(alice)
      await assert.rejects(scalar('select public.send_race_message($1,$2) as value',['x'.repeat(21),'Alice']), /1~20/)
      await assert.rejects(scalar('select public.send_race_message($1,$2) as value',['Too soon','Alice']), /5초/)
      await identity(bob)
      await assert.rejects(db.query('select public.admin_save_settings($1,1)', [JSON.stringify(next)]), /다른 관리자/)
      configureSettings(next)
      await db.exec('reset role;')
      assert.equal(await scalar('select public.training_level($1) as value', [120]), 1)
      assert.equal(await scalar("select public.training_pace(1,'steady') as value"), trainingFor(0,'steady').paceSec)
      await ageRun(runId(90), 1000)
      const old = await finish(runId(90), { distanceKm: 1, elapsedSec: 1000, completed: true })
      assert.equal(old.run.details.growth.xpEarned, 120)
      await start(runId(91)); await ageRun(runId(91), 1000)
      const updated = await finish(runId(91), { distanceKm: 1, elapsedSec: 1000, completed: true })
      assert.equal(updated.run.details.growth.xpEarned, 240)
      await identity(bob)
      const reset = await scalar('select public.admin_save_settings($1,2) as value', [JSON.stringify(DEFAULT_SETTINGS)])
      assert.equal(reset, 3)
      configureSettings(DEFAULT_SETTINGS)
    })
    await t.test('suspension blocks existing-session writes; admin XP actions are audited', async () => {
      await identity(bob)
      await assert.rejects(db.query('select public.admin_update_member($1,$2,$3,$4)', [bob,'suspend',null,'test reason']), /관리자 계정/)
      await db.query('select public.admin_update_member($1,$2,$3,$4)', [alice,'suspend',null,'test reason'])
      await identity(alice)
      await assert.rejects(start(runId(92)), /이용이 제한/)
      await assert.rejects(db.query('update public.profiles set avatar_image=null where id=$1', [alice]), /이용이 제한/)
      await db.exec('reset role; update public.race_chat_limits set last_sent_at=now()-interval \'5 seconds\';')
      await identity(alice)
      await assert.rejects(scalar('select public.send_race_message($1,$2) as value', ['Cannot chat','Alice']), /이용이 제한/)
      await identity(bob)
      await db.query('select public.admin_update_member($1,$2,$3,$4)', [alice,'restore',null,'restored'])
      await db.query('select public.admin_update_member($1,$2,$3,$4)', [alice,'xp',1000,'reward adjustment'])
      assert.ok((await scalar('select public.admin_audit_list() as value')).items.some(item => item.action === 'xp'))
      await identity(alice)
      assert.equal(Number(await scalar('select xp as value from public.runner_progress where user_id=$1',[alice])),1000)
    })
  } finally { configureSettings(DEFAULT_SETTINGS); await db.close() }
})
