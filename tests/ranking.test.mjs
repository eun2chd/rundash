import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('weekly ranking and monthly attendance calendar', async t => {
 const db = new PGlite()
 const users = { a: '11111111-1111-4111-8111-111111111111', b: '22222222-2222-4222-8222-222222222222', c: '33333333-3333-4333-8333-333333333333', d: '44444444-4444-4444-8444-444444444444' }
 const scalar=async(sql,args=[]) => (await db.query(sql,args)).rows[0]?.value
 const identity=async(id) => { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{\"is_anonymous\":false}',false)",[id]) }
 const root=() => db.exec('reset role')
 const thisWeek = "now()"
 const lastWeek = "(date_trunc('week', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') - interval '1 day'"
 const addRun=(user, km, when, practice=false) => db.query(`insert into public.runs(user_id,details,created_at) values($1,$2,${when})`,[user,JSON.stringify({ distanceKm: km, practice })])
 const ranking=async(user, offset=0) => { await identity(user); return scalar('select public.weekly_ranking($1) value',[offset]) }
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key,email text,is_anonymous boolean default false,created_at timestamptz default now(),last_sign_in_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
   grant usage on schema auth to anon,authenticated;`)
  const directory=new URL('../supabase/migrations/',import.meta.url)
  for(const file of (await readdir(directory)).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file,directory),'utf8'))
  // Fixed 100 XP per km so rewards are exact; production rolls 10~100 per km.
  await db.exec(`update public.game_settings set value=value||'{"xpPerKmMin":100,"xpPerKmMax":100,"attendanceMinKm":0.5}'`)
  for(const [key,id] of Object.entries(users)) {
   await db.query('insert into auth.users(id,email) values($1,$2)',[id,key+'@private.test'])
   await db.query("insert into public.profiles(id,nickname,color,skin) values($1,$2,'#e07b39','#f6d1b0')",[id,'Runner'+key.toUpperCase()])
  }
  await db.query('insert into public.runner_progress(user_id,xp) values($1,900)',[users.a])

  await t.test('sums this week, excludes practice, last week and suspended runners',async()=>{
   await addRun(users.a, 3, thisWeek); await addRun(users.a, 2.5, thisWeek)
   await addRun(users.b, 7, thisWeek); await addRun(users.b, 50, thisWeek, true)
   await addRun(users.c, 20, lastWeek); await addRun(users.c, 1, thisWeek)
   await addRun(users.d, 99, thisWeek)
   await db.query('insert into public.account_controls(user_id,suspended,reason) values($1,true,$2)',[users.d,'test'])
   const board=await ranking(users.a)
   assert.deepEqual(board.items.map(row => [row.rank, row.nickname, Number(row.km), row.runs]), [[1,'RunnerB',7,1],[2,'RunnerA',5.5,2],[3,'RunnerC',1,1]])
   assert.equal(board.participants, 3)
   assert.equal(board.me.rank, 2); assert.equal(board.items[1].me, true); assert.equal(board.items[0].me, false)
   assert.equal(board.items[1].level, 5)
   assert(!JSON.stringify(board).includes('@private.test')); assert(!JSON.stringify(board).includes(users.b))
  })
  await t.test('last week has its own board and ties go to whoever got there first',async()=>{
   const last=await ranking(users.c, 1)
   assert.deepEqual(last.items.map(row => [row.nickname, Number(row.km)]), [['RunnerC', 20]])
   assert.equal(last.me.rank, 1)
   assert.equal((await ranking(users.a, 1)).me, null)
   await root(); await db.query("insert into public.runs(user_id,details,created_at) values($1,$2,now()-interval '1 minute')",[users.c,JSON.stringify({ distanceKm: 6 })])
   const tie=await ranking(users.a)
   assert.deepEqual(tie.items.slice(0, 2).map(row => [row.rank, row.nickname]), [[1,'RunnerB'],[2,'RunnerC']])
   await assert.rejects(ranking(users.a, 2), /지난주/)
  })
  await t.test('calendar returns only my check-ins for the month',async()=>{
   await root()
   await db.query("insert into public.runner_attendance(user_id,day,run_id,streak,xp_awarded) values($1,'2026-11-03',gen_random_uuid(),1,50),($1,'2026-11-04',gen_random_uuid(),2,50),($1,'2026-10-31',gen_random_uuid(),9,50),($2,'2026-11-03',gen_random_uuid(),1,50)",[users.a,users.b])
   await identity(users.a)
   const month=await scalar('select public.attendance_month(2026,11) value')
   assert.deepEqual(month.days.map(day => [day.day, day.streak]), [['2026-11-03',1],['2026-11-04',2]])
   assert.equal(month.longestStreak, 9)
   assert.equal((await scalar('select public.attendance_month(2026,12) value')).days.length, 0)
   await assert.rejects(db.query('select public.attendance_month(2026,13)'), /날짜/)
   await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub','',false)")
   await assert.rejects(db.query('select public.weekly_ranking(0)'), /로그인/)
  })
  const board=async(user, kind, offset=0) => { await identity(user); return scalar('select public.runner_ranking($1,$2) value',[kind, offset]) }
  const admin='55555555-5555-4555-8555-555555555555'
  await t.test('admins never appear on any board and are told why',async()=>{
   await root()
   await db.query("insert into auth.users(id,email) values($1,'admin@private.test')",[admin])
   await db.query("insert into public.profiles(id,nickname,color,skin) values($1,'Boss','#e07b39','#f6d1b0')",[admin])
   await db.query('insert into public.admin_members(user_id) values($1)',[admin])
   await db.query("insert into public.runner_progress(user_id,xp,total_distance_km,run_count) values($1,999999,999,99)",[admin])
   await addRun(admin, 100, thisWeek)
   for(const kind of ['week','month','total','level']) {
    const result=await board(admin, kind)
    assert(!result.items.some(row => row.nickname === 'Boss'), kind)
    assert.equal(result.me, null); assert.equal(result.excluded, true)
   }
   assert.equal((await board(users.a,'week')).excluded, false)
   assert(!(await ranking(users.a)).items.some(row => row.nickname === 'Boss'))
  })
  await t.test('monthly board covers the calendar month and last month separately',async()=>{
   await root(); await db.query("insert into public.runs(user_id,details,created_at) values($1,$2,(date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') - interval '1 hour')",[users.b,JSON.stringify({ distanceKm: 40 })])
   const month=await board(users.a,'month')
   assert(month.items.some(row => row.nickname === 'RunnerA'))
   assert.equal(month.items.find(row => row.nickname === 'RunnerB').km, 7)
   const last=await board(users.a,'month',1)
   assert.equal(last.items.find(row => row.nickname === 'RunnerB').km, 40)
   assert.ok(month.resetsAt); assert.equal(last.resetsAt, null)
   assert.match(month.periodStart, /^\d{4}-\d{2}-01$/)
  })
  await t.test('all-time distance and level boards rank by progress',async()=>{
   await root()
   await db.query("insert into public.runner_progress(user_id,xp,total_distance_km,run_count) values($1,300,12,4),($2,900,30,8) on conflict(user_id) do update set xp=excluded.xp,total_distance_km=excluded.total_distance_km,run_count=excluded.run_count",[users.b,users.c])
   await db.query("update public.runner_progress set total_distance_km=5.5,run_count=2,updated_at=now()-interval '1 day' where user_id=$1",[users.a])
   const total=await board(users.a,'total')
   assert.deepEqual(total.items.map(row => [row.nickname, Number(row.km), row.runs]), [['RunnerC',30,8],['RunnerB',12,4],['RunnerA',5.5,2]])
   const level=await board(users.b,'level')
   assert.deepEqual(level.items.map(row => [row.rank, row.nickname, row.level]), [[1,'RunnerA',5],[2,'RunnerC',5],[3,'RunnerB',3]])
   assert.equal(level.me.rank, 3); assert.equal(level.resetsAt, null)
   await assert.rejects(board(users.a,'level',1), /지난 기간/)
   await assert.rejects(board(users.a,'speed'), /종류/)
  })
 } finally { await db.close() }
})
