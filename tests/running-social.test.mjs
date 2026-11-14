import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('social RPCs enforce location consent, invite ownership, exclusivity, blocking and checkpoint ownership', async t => {
 const db = new PGlite()
 const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222', c='33333333-3333-4333-8333-333333333333'
 const runs=['aaaaaaaa-aaaa-4aaa-8aaa-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-000000000003']
 const scalar=async(sql,args=[]) => (await db.query(sql,args)).rows[0]?.value
 const identity=async(id) => { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{\"is_anonymous\":false}',false)",[id]) }
 const tick=(run,visible=false,allow=true) => scalar('select public.running_social_tick($1,10,1.5,false,$2,$3) value',[run,visible,allow])
 const invite=id => scalar('select public.invite_running_friend($1) value',[id])
 const respond=(id,action) => scalar('select public.respond_running_invite($1,$2) value',[id,action])
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key,email text,is_anonymous boolean default false,created_at timestamptz default now(),last_sign_in_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
   grant usage on schema auth to anon,authenticated;`)
  const directory=new URL('../supabase/migrations/',import.meta.url)
  for(const file of (await readdir(directory)).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file,directory),'utf8'))
  for(const [id,nickname] of [[a,'Alice'],[b,'Bobby'],[c,'Carol']]) {
   await db.query('insert into auth.users(id,email) values($1,$2)',[id,nickname+'@private.test'])
   await db.query("insert into public.profiles(id,nickname,color,skin) values($1,$2,'#e07b39','#f6d1b0')",[id,nickname])
  }
  for(let i=0;i<3;i++) { await identity([a,b,c][i]); await scalar("select public.start_training_run($1,1,'steady') value",[runs[i]]); await tick(runs[i]) }

  await t.test('private by default; no raw table access or email leakage',async()=>{
   await identity(a)
   assert.equal((await tick(runs[0])).peers.length,0)
   assert.equal(await scalar('select public.locate_running_friend($1) value',[b]),null)
   await assert.rejects(db.query('select * from public.runner_locations'),/permission denied/)
   await assert.rejects(db.query("update public.running_invites set status='accepted'"),/permission denied/)
   const found=await scalar("select public.search_running_friends('Bob') value")
   assert.equal(found[0].nickname,'Bobby'); assert.equal(found[0].location_public,false)
   assert(!JSON.stringify(found).includes('@private.test'))
   await identity(b); await tick(runs[1],true)
   await identity(a); assert.equal((await tick(runs[0])).peers[0].id,b)
   assert.equal((await scalar('select public.locate_running_friend($1) value',[b])).nickname,'Bobby')
   await identity(b); await tick(runs[1],false)
  })
  let invitation
  await t.test('only recipient accepts; no movement/XP before acceptance; third party rejected',async()=>{
   await identity(a); invitation=await invite(b)
   await assert.rejects(respond(invitation,'accept'),/상대방/)
   assert.equal((await tick(runs[0])).pair,null)
   await identity(c); await assert.rejects(respond(invitation,'accept'),/초대/)
   await identity(b); assert.equal((await tick(runs[1])).invites[0].incoming,true)
   await respond(invitation,'accept')
   const social=await tick(runs[1]); assert(social.pair); assert(social.peers.some(p=>p.id===a&&p.paired))
   assert.equal((await scalar('select public.locate_running_friend($1) value',[a])).paired,true)
   assert.equal(await scalar('select xp value from public.runner_progress where user_id=$1',[b]),0)
   await assert.rejects(respond(invitation,'accept'),/처리/)
   await identity(c); await assert.rejects(invite(a),/동행/)
  })
  await t.test('either member can leave; blocking ends visibility and invites',async()=>{
   await identity(b); await db.query('select public.end_running_pair()')
   assert.equal((await tick(runs[1])).pair,null)
   await identity(a); assert.equal((await tick(runs[0])).pair,null)
   await db.query('select public.block_running_friend($1,true)',[b])
   assert.equal((await scalar("select public.search_running_friends('Bob') value")).length,0)
   await identity(b); assert.equal((await scalar("select public.search_running_friends('Alice') value")).length,0)
   await assert.rejects(invite(a),/초대/)
   await identity(a); assert.equal((await scalar('select public.list_running_blocks() value'))[0].id,b)
   await db.query('select public.block_running_friend($1,false)',[b])
  })
  await t.test('invites can expire, decline or cancel; opt-out and self-invites rejected',async()=>{
   await db.exec('reset role;'); await db.exec("update public.running_invites set created_at=now()-interval '10 seconds'")
   await identity(a); const id=await invite(b)
   await db.exec('reset role;'); await db.query("update public.running_invites set expires_at=now()-interval '1 second' where id=$1",[id])
   await identity(b); await respond(id,'accept'); assert.equal((await tick(runs[1])).pair,null)
   await db.exec('reset role;'); await db.exec("update public.running_invites set created_at=now()-interval '10 seconds'")
   await identity(a); const declined=await invite(b)
   await identity(b); await respond(declined,'decline')
   await tick(runs[1],false,false)
   await db.exec('reset role;'); await db.exec("update public.running_invites set created_at=now()-interval '10 seconds'")
   await identity(a); await assert.rejects(invite(b),/허용/); await assert.rejects(invite(a),/초대/)
   await identity(b); await tick(runs[1],false,true)
   await identity(a); const cancelled=await invite(b); await respond(cancelled,'cancel')
   await identity(b); await assert.rejects(respond(cancelled,'accept'),/처리/)
  })
  await t.test('checkpoints are scoped to the active owner and bounded; stale run cannot overwrite',async()=>{
   await identity(a)
   await db.query('select public.save_running_checkpoint($1,$2)',[runs[0],JSON.stringify({version:1,sim:{dist:10}})])
   assert.equal((await scalar('select public.load_running_checkpoint() value')).session.id,runs[0])
   await identity(b)
   assert.equal((await scalar('select public.load_running_checkpoint() value')).payload,null)
   await assert.rejects(db.query('select public.save_running_checkpoint($1,$2)',[runs[0],'{}']),/활성/)
   await identity(a)
   await assert.rejects(db.query('select public.save_running_checkpoint($1,$2)',[runs[0],JSON.stringify({junk:'x'.repeat(210000)})]),/형식/)
   await scalar("select public.start_training_run('aaaaaaaa-aaaa-4aaa-8aaa-000000000004',1,'steady') value")
   await assert.rejects(db.query('select public.save_running_checkpoint($1,$2)',[runs[0],'{}']),/활성/)
   await assert.rejects(tick(runs[0]),/활성/)
  })

  await t.test('offline and completed sessions end pair consent and clean recovery data',async()=>{
   await db.exec('reset role;'); await db.exec("update public.running_invites set created_at=now()-interval '10 seconds'")
   await identity(a); await tick('aaaaaaaa-aaaa-4aaa-8aaa-000000000004')
   await identity(c); await tick(runs[2])
   await identity(a); const id=await invite(c)
   await identity(c); await respond(id,'accept')
   await db.exec('reset role;'); await db.query("update public.runner_locations set updated_at=now()-interval '70 seconds' where user_id=$1",[a])
   await identity(c); assert.equal((await tick(runs[2])).pair,null)
   assert.equal(await scalar('select public.locate_running_friend($1) value',[a]),null)
   await identity(a); await tick('aaaaaaaa-aaaa-4aaa-8aaa-000000000004')
   await db.exec('reset role;'); await db.exec("update public.running_invites set created_at=now()-interval '10 seconds'")
   await identity(a); const next=await invite(c)
   await identity(c); await respond(next,'accept')
   await identity(a)
   await db.query('select public.save_running_checkpoint($1,$2)',['aaaaaaaa-aaaa-4aaa-8aaa-000000000004','{}'])
   await db.exec('reset role;'); await db.query("update public.training_sessions set started_at=now()-interval '610 seconds' where id=$1",['aaaaaaaa-aaaa-4aaa-8aaa-000000000004'])
   await identity(a); await scalar('select public.finish_training_run($1,$2) value',['aaaaaaaa-aaaa-4aaa-8aaa-000000000004',JSON.stringify({distanceKm:1,elapsedSec:600,completed:true})])
   assert.equal(await scalar('select public.load_running_checkpoint() value'),null)
   await identity(c); assert.equal((await tick(runs[2])).pair,null)
   assert.equal(await scalar('select public.locate_running_friend($1) value',[a]),null)
  })

  await t.test('four-member groups show canonical names and seats; fifth acceptance is rejected; members can leave independently',async()=>{
   const d='44444444-4444-4444-8444-444444444444',e='55555555-5555-4555-8555-555555555555'
   const ra='aaaaaaaa-aaaa-4aaa-8aaa-000000000005',rd='aaaaaaaa-aaaa-4aaa-8aaa-000000000006',re='aaaaaaaa-aaaa-4aaa-8aaa-000000000007'
   const cooldown=async()=>{await db.exec('reset role;');await db.exec("update public.running_invites set created_at=now()-interval '10 seconds'")}
   await db.exec('reset role;')
   for(const [id,name] of [[d,'Daisy'],[e,'Erin']]) {
    await db.query('insert into auth.users(id) values($1)',[id]);await db.query("insert into public.profiles(id,nickname,color,skin) values($1,$2,'#e07b39','#f6d1b0')",[id,name])
   }
   for(const [id,run] of [[a,ra],[d,rd],[e,re]]) {await identity(id);await scalar("select public.start_training_run($1,1,'steady') value",[run]);await tick(run)}
   await identity(b);await tick(runs[1]);await identity(c);await tick(runs[2])
   await cooldown();await identity(a);const ab=await invite(b);await identity(b);await respond(ab,'accept')
   let group=(await tick(runs[1])).pair;assert.equal(group.memberCount,2);assert.deepEqual(group.members.map(m=>m.nickname),['Alice','Bobby']);assert.deepEqual(group.members.map(m=>m.slot),[0,1])
   await cooldown();await identity(a);const ac=await invite(c);await identity(c);await respond(ac,'accept');assert.equal((await tick(runs[2])).pair.memberCount,3)
   await cooldown();await identity(a);const ad=await invite(d)
   await cooldown();await identity(a);const ae=await invite(e)
   await identity(d);await respond(ad,'accept');group=(await tick(rd)).pair
   assert.equal(group.memberCount,4);assert.deepEqual(group.members.map(m=>m.slot),[0,1,2,3]);assert.deepEqual(group.members.map(m=>m.nickname),['Alice','Bobby','Carol','Daisy'])
   await identity(e);await assert.rejects(respond(ae,'accept'),/최대 4명/);assert.equal((await tick(re)).pair,null)
   await identity(b);await assert.rejects(invite(e),/최대 4명/)
   await identity(a);await db.query('select public.end_running_pair()')
   await identity(b);group=(await tick(runs[1])).pair;assert.equal(group.memberCount,3);assert.deepEqual(group.members.map(m=>m.slot),[0,1,2]);assert.equal(group.leader_id,b)
   await cooldown();await identity(b);const be=await invite(e);await identity(e);await respond(be,'accept');assert.equal((await tick(re)).pair.memberCount,4)
   await identity(c);await db.query('select public.block_running_friend($1,true)',[d]);assert.equal((await tick(runs[2])).pair,null)
   await identity(b);assert.equal((await tick(runs[1])).pair.memberCount,3)
   await db.exec('reset role;');await db.query("update public.runner_locations set updated_at=now()-interval '70 seconds' where user_id=$1",[d])
   await identity(b);group=(await tick(runs[1])).pair;assert.equal(group.memberCount,2);assert.deepEqual(group.members.map(m=>m.slot),[0,1])
   assert.equal(await scalar('select xp value from public.runner_progress where user_id=$1',[b]),0)
  })
 } finally { await db.close() }
})
