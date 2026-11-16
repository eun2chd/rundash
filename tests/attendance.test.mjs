import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('daily attendance from saved runs: once per day, streaks, bonus XP and no practice', async t => {
 const db = new PGlite()
 const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222'
 let n = 0
 const rid = () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++n).padStart(12, '0')}`
 const scalar=async(sql,args=[]) => (await db.query(sql,args)).rows[0]?.value
 const identity=async(id) => { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{\"is_anonymous\":false}',false)",[id]) }
 const root=() => db.exec('reset role')
 // Starts a 1km run, ages it so the distance is physically possible, then saves it.
 const run=async(user, distanceKm, extra={}) => {
  const id = rid()
  await identity(user); await scalar("select public.start_training_run($1,1,'steady') value",[id])
  await root(); await db.query("update public.training_sessions set started_at=clock_timestamp()-interval '3600 seconds' where id=$1",[id])
  await identity(user); return scalar('select public.finish_training_run($1,$2) value',[id,JSON.stringify({ distanceKm, elapsedSec: 3000, completed: false, ...extra })])
 }
 const xp=async(user) => { await root(); return Number(await scalar('select xp value from public.runner_progress where user_id=$1',[user]) ?? 0) }
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key,email text,is_anonymous boolean default false,created_at timestamptz default now(),last_sign_in_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
   grant usage on schema auth to anon,authenticated;`)
  const directory=new URL('../supabase/migrations/',import.meta.url)
  for(const file of (await readdir(directory)).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file,directory),'utf8'))
  // Fixed 100 XP per km so rewards are exact; production rolls 10~100 per km.
  await db.exec(`update public.game_settings set value=value||'{"xpPerKmMin":100,"xpPerKmMax":100}'`)
  for(const [id,nickname] of [[a,'Alice'],[b,'Bobby']]) {
   await db.query('insert into auth.users(id,email) values($1,$2)',[id,nickname+'@private.test'])
   await db.query("insert into public.profiles(id,nickname,color,skin) values($1,$2,'#e07b39','#f6d1b0')",[id,nickname])
  }

  await t.test('short or practice runs do not check in',async()=>{
   const short=await run(a,0.4)
   assert.equal(short.attendance.checked,false); assert.equal(short.attendance.xp,0)
   const practice=await run(a,0.8,{ practice: true })
   assert.equal(practice.attendance.checked,false)
   await identity(a); assert.equal((await scalar('select public.attendance_status() value')).checkedToday,false)
  })
  await t.test('first 0.5km run checks in once, adds XP and reports it in progression',async()=>{
   const before=await xp(a)
   const saved=await run(a,0.5)
   assert.deepEqual({ checked: saved.attendance.checked, isNew: saved.attendance.new, streak: saved.attendance.streak, xp: saved.attendance.xp }, { checked: true, isNew: true, streak: 1, xp: 50 })
   assert.equal(await xp(a), before + 50 + 50)
   assert.equal(Number(saved.progression.xp), before + 50 + 50)
   const again=await run(a,0.9)
   assert.equal(again.attendance.new,false); assert.equal(again.attendance.xp,0)
   assert.equal(await xp(a), before + 100 + 90)
   const retried=await identity(a).then(()=>scalar('select public.finish_training_run($1,$2) value',[saved.run.id,'{}']))
   assert.equal(retried.attendance.xp,50); assert.equal(retried.attendance.new,false)
   assert.equal(await xp(a), before + 190)
   await identity(a); const status=await scalar('select public.attendance_status() value')
   assert.equal(status.checkedToday,true); assert.equal(status.streak,1); assert.equal(status.week.length,7); assert.equal(status.week[6].checked,true)
  })
  await t.test('consecutive days build a streak and every 7th day pays the bonus',async()=>{
   await root()
   for(let back=6;back>=1;back--) await db.query("insert into public.runner_attendance(user_id,day,run_id,streak,xp_awarded) values($1,public.attendance_today()-$2::int,$3,$4,50)",[b,back,rid(),7-back])
   const before=await xp(b)
   const saved=await run(b,1)
   assert.equal(saved.attendance.streak,7); assert.equal(saved.attendance.xp,350)
   assert.equal(await xp(b), before + 100 + 350)
   await identity(b); const status=await scalar('select public.attendance_status() value')
   assert.equal(status.streak,7); assert(status.week.every(day=>day.checked)); assert.equal(Number(status.total),7)
  })
  await t.test('a gap resets the streak and others cannot read or write attendance',async()=>{
   await root(); await db.query('delete from public.runner_attendance where user_id=$1',[a])
   await db.query("insert into public.runner_attendance(user_id,day,run_id,streak,xp_awarded) values($1,public.attendance_today()-2,$2,5,50)",[a,rid()])
   await identity(a); const status=await scalar('select public.attendance_status() value')
   assert.equal(status.streak,0); assert.equal(status.checkedToday,false)
   const saved=await run(a,0.6); assert.equal(saved.attendance.streak,1)
   await identity(b); assert.equal(Number(await scalar('select count(*) value from public.runner_attendance where user_id=$1',[a])),0)
   await assert.rejects(db.query("insert into public.runner_attendance(user_id,day,run_id,streak,xp_awarded) values($1,current_date+1,$2,1,9999)",[b,rid()]),/permission denied/)
   await assert.rejects(db.query("select public.apply_run_attendance($1,'{}')",[b]),/permission denied/)
  })
 } finally { await db.close() }
})
