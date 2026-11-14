import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'

test('activity privacy, visible invite conditions, atomic matching and host-only group pause',async t=>{
 const db=new PGlite()
 const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555']
 const rid=n=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12,'0')}`
 const scalar=async(sql,args=[]) => (await db.query(sql,args)).rows[0]?.value
 const who=async i=>{await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{\"is_anonymous\":false}',false)",[ids[i]])}
 const pulse=(run,activity='coding',share=true)=>scalar('select public.running_social_tick($1,0,1,false,true,true,$2,$3) value',[run,activity,share])
 const cooldown=async()=>{await db.exec('reset role;');await db.exec("update public.running_invites set created_at=now()-interval '10 seconds'")}
 const invite=async target=>scalar('select public.invite_running_friend($1) value',[ids[target]])
 const accept=(id,old,n)=>scalar('select public.accept_running_invite($1,$2,$3) value',[id,JSON.stringify({id:old,distanceKm:0,elapsedSec:0,completed:false}),rid(n)])
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key,email text,is_anonymous boolean default false,created_at timestamptz default now(),last_sign_in_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
   grant usage on schema auth to anon,authenticated;`)
  const directory=new URL('../supabase/migrations/',import.meta.url)
  for(const f of (await readdir(directory)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(f,directory),'utf8'))
  for(let i=0;i<ids.length;i++){
   await db.exec('reset role;');await db.query('insert into auth.users(id) values($1)',[ids[i]])
   await db.query("insert into public.profiles(id,nickname,color,skin) values($1,$2,'#f08a5d','#f6d1b0')",[ids[i],'Runner'+i])
   await who(i);await scalar('select public.start_training_run($1,$2,$3) value',[rid(i+1),i===0?1.5:5,i===0?'challenge':'easy']);await pulse(rid(i+1))
  }
  await t.test('other runners see only deliberately shared activity clouds',async()=>{
   await who(1);await pulse(rid(2),'reading',true)
   await who(0);let peers=(await pulse(rid(1))).peers;assert.equal(peers.find(p=>p.id===ids[1]).activity,'reading')
   await who(1);await pulse(rid(2),'reading',false)
   await who(0);peers=(await pulse(rid(1))).peers;assert.equal(peers.find(p=>p.id===ids[1]).activity,null)
  })
  let ab
  await t.test('invitation displays the host pace/distance; stranger cannot accept; failed handover leaves the old run intact',async()=>{
   await who(0);ab=await invite(1)
   await who(1);const offered=(await pulse(rid(2))).invites.find(i=>i.id===ab)
   assert.equal(offered.offered_pace,540);assert.equal(Number(offered.offered_distance),1.5)
   await assert.rejects(db.query("select public.respond_running_invite($1,'accept')",[ab]),/새로고침/)
   await who(2);await assert.rejects(accept(ab,rid(3),30),/초대/)
   await who(1);await assert.rejects(accept(ab,rid(99),20),/현재 러닝/)
   assert.equal(await scalar('select active_run_id value from public.runner_progress where user_id=$1',[ids[1]]),rid(2))
  })
  await t.test('acceptance saves the old run once and starts exactly the offered pace and distance; stale unmount cannot leave the new group',async()=>{
   await who(1);const result=await accept(ab,rid(2),20)
   assert.equal(result.ticket.paceSec,540);assert.equal(Number(result.ticket.distanceKm),1.5)
   assert.equal(result.previousRun.run.details.distanceKm,0);assert.equal(result.previousRun.progression.run_count,1)
   assert.equal((await pulse(rid(20))).pair.memberCount,2)
   await db.query('select public.end_running_pair($1)',[rid(2)])
   assert.equal((await pulse(rid(20))).pair.memberCount,2)
   await accept(ab,rid(2),20)
   assert.equal(await scalar('select run_count value from public.runner_progress where user_id=$1',[ids[1]]),1)
   await assert.rejects(db.query('select public.respond_running_invite_base($1,$2)',[ab,'accept']),/permission denied/)
  })
  await t.test('only the current host can pause/resume, and every member reads that state',async()=>{
   await who(1);await assert.rejects(db.query('select public.pause_running_group(true)'),/방장만/)
   await who(2);await assert.rejects(db.query('select public.pause_running_group(true)'),/방장만/)
   await who(0);assert.equal(await scalar('select public.pause_running_group(true) value'),true)
   await who(1);assert.equal((await pulse(rid(20))).pair.paused,true)
   await who(0);await db.query('select public.pause_running_group(false)')
   await who(1);assert.equal((await pulse(rid(20))).pair.paused,false)
  })
  await t.test('group capacity rejects the fifth acceptance atomically without discarding that user\'s old run',async()=>{
   await cooldown();await who(0);const ac=await invite(2);await who(2);await accept(ac,rid(3),30);await pulse(rid(30))
   await cooldown();await who(0);const ad=await invite(3)
   await cooldown();await who(0);const ae=await invite(4)
   await who(3);await accept(ad,rid(4),40);assert.equal((await pulse(rid(40))).pair.memberCount,4)
   await who(4);await assert.rejects(accept(ae,rid(5),50),/최대 4명/)
   assert.equal(await scalar('select active_run_id value from public.runner_progress where user_id=$1',[ids[4]]),rid(5))
   assert.equal(await scalar('select run_count value from public.runner_progress where user_id=$1',[ids[4]]),0)
   await who(0);await db.query('select public.end_running_pair()')
   await assert.rejects(db.query('select public.pause_running_group(true)'),/방장만/)
   await who(1);await db.query('select public.pause_running_group(true)');assert.equal((await pulse(rid(20))).pair.paused,true)
  })
 }finally{await db.close()}
})
