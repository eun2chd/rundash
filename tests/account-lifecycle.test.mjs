import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('account deletion, chat reports, moderation and retention purge', async t => {
 const db = new PGlite()
 const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222', c='33333333-3333-4333-8333-333333333333', admin='44444444-4444-4444-8444-444444444444', anon='55555555-5555-4555-8555-555555555555'
 const runs=['aaaaaaaa-aaaa-4aaa-8aaa-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-000000000003']
 const scalar=async(sql,args=[]) => (await db.query(sql,args)).rows[0]?.value
 const identity=async(id,anonymous=false) => { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[id,JSON.stringify({ is_anonymous: anonymous })]) }
 const root=() => db.exec('reset role')
 const tick=(run) => scalar('select public.running_social_tick($1,10,1.5,false,false,true) value',[run])
 const send=(text,nickname=null) => scalar('select public.send_race_message($1,$2) value',[text,nickname])
 const count=async(sql,args=[]) => { await root(); return Number(await scalar(`select count(*) value from ${sql}`,args)) }
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key,email text,is_anonymous boolean default false,created_at timestamptz default now(),last_sign_in_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
   grant usage on schema auth to anon,authenticated;`)
  const directory=new URL('../supabase/migrations/',import.meta.url)
  for(const file of (await readdir(directory)).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file,directory),'utf8'))
  for(const [id,nickname] of [[a,'Alice'],[b,'Bobby'],[c,'Carol'],[admin,'Boss']]) {
   await db.query('insert into auth.users(id,email) values($1,$2)',[id,nickname+'@private.test'])
   await db.query("insert into public.profiles(id,nickname,color,skin) values($1,$2,'#e07b39','#f6d1b0')",[id,nickname])
  }
  await db.query('insert into public.admin_members(user_id) values($1)',[admin])
  await db.query('insert into auth.users(id,is_anonymous,last_sign_in_at) values($1,true,now())',[anon])

  let message
  await t.test('anyone else can report a message once; authors and raw table access are blocked',async()=>{
   await identity(a); message=await send('나쁜 말')
   await assert.rejects(scalar('select public.report_race_message($1,$2)',[message.id,'abuse']),/내 메시지/)
   await identity(b); await db.query('select public.report_race_message($1,$2)',[message.id,'abuse'])
   await db.query('select public.report_race_message($1,$2)',[message.id,'spam'])
   await assert.rejects(db.query('select public.report_race_message($1,$2)',[message.id,'nope']),/사유/)
   await assert.rejects(db.query('select * from public.race_message_reports'),/permission denied/)
   await identity(anon,true); await db.query('select public.report_race_message($1,$2)',[message.id,'sexual'])
   assert.equal(await count('public.race_message_reports'),2)
  })
  await t.test('only admins review and remove reported messages; snapshot survives removal',async()=>{
   await identity(b); await assert.rejects(db.query("select public.admin_chat_reports('open',0)"),/관리자/)
   await assert.rejects(db.query("select public.admin_resolve_chat_report($1,'remove','욕설')",[message.id]),/관리자/)
   await identity(admin)
   const reports=await scalar("select public.admin_chat_reports('open',0) value")
   assert.equal(reports.total,1); assert.equal(reports.items[0].report_count,2); assert.equal(reports.items[0].author_id,a)
   await assert.rejects(db.query("select public.admin_resolve_chat_report($1,'remove','')",[message.id]),/사유/)
   await db.query("select public.admin_resolve_chat_report($1,'remove','욕설 확인')",[message.id])
   assert.equal(await count('public.race_messages where id=$1',[message.id]),0)
   await identity(admin); const removed=await scalar("select public.admin_chat_reports('removed',0) value")
   assert.equal(removed.items[0].message,'나쁜 말'); assert.equal(removed.items[0].message_exists,false)
   await assert.rejects(db.query("select public.admin_resolve_chat_report($1,'dismiss','재처리')",[message.id]),/처리할 신고/)
   assert.equal(await count("public.admin_audit where action='chat_remove'"),1)
  })
  await t.test('deleting an account removes its data even while running in a group',async()=>{
   for(let i=0;i<3;i++) { await identity([a,b,c][i]); await scalar("select public.start_training_run($1,1,'steady') value",[runs[i]]); await tick(runs[i]) }
   await identity(a); const invitation=await scalar('select public.invite_running_friend($1) value',[b])
   await identity(b); await scalar('select public.accept_running_invite($1,$2,$3) value',[invitation,JSON.stringify({ id: runs[1], distanceKm: 0, elapsedSec: 0, completed: false }),'aaaaaaaa-aaaa-4aaa-8aaa-000000000004'])
   await root(); await db.exec("update public.running_invites set created_at=now()-interval '10 seconds'")
   await identity(b); await scalar('select public.invite_running_friend($1) value',[c])
   assert.equal(await count('public.running_invites where group_id is not null'),1)
   await root(); await db.exec("update public.race_chat_limits set last_sent_at='1970-01-01'")
   await identity(a); await send('곧 탈퇴해요')
   await assert.rejects(db.query("select public.delete_my_account('아무거나')"),/확인 문구/)
   await db.query("select public.delete_my_account('Alice')")
   assert.equal(await count('auth.users where id=$1',[a]),0)
   for(const table of ['public.profiles where id=$1','public.training_sessions where user_id=$1','public.runner_progress where user_id=$1','public.race_messages where user_id=$1','public.running_pair_members where user_id=$1'])
    assert.equal(await count(table,[a]),0,table)
   assert.equal(await count('public.running_invites where group_id is not null'),0)
   assert.equal(await count('public.profiles where id=$1',[b]),1)
   assert.equal(await count("public.admin_audit where action='account_deleted' and target=$1 and actor_id is null",[a]),1)
   await identity(admin); await assert.rejects(db.query("select public.delete_my_account('탈퇴')"),/관리자/)
   await identity(c); await db.query("select public.delete_my_account('탈퇴')")
   assert.equal(await count('auth.users where id=$1',[c]),0)
  })
  await t.test('purge honours the retention periods and is not callable by users',async()=>{
   await identity(b); await assert.rejects(db.query('select public.purge_expired_data()'),/permission denied/)
   const fresh=await send('최근 메시지')
   await root()
   const old=(await db.query("insert into public.race_messages(user_id,nickname,is_anonymous,message,created_at) values($1,'Bobby',false,'오래된 메시지',now()-interval '91 days') returning id",[b])).rows[0].id
   const held=(await db.query("insert into public.race_messages(user_id,nickname,is_anonymous,message,created_at) values($1,'Bobby',false,'조사 중',now()-interval '91 days') returning id",[b])).rows[0].id
   await db.query("insert into public.race_message_reports(message_id,reporter_id,author_id,author_nickname,message,message_created_at,reason) values($1,$2,$3,'Bobby','조사 중',now(),'abuse')",[held,admin,b])
   await db.exec("update public.race_message_reports set resolved_at=now()-interval '91 days' where status<>'open'")
   const stale='66666666-6666-4666-8666-666666666666'
   await db.query("insert into auth.users(id,is_anonymous,created_at,last_sign_in_at) values($1,true,now()-interval '40 days',now()-interval '31 days')",[stale])
   await db.query("update public.admin_audit set created_at=now()-interval '366 days' where target=$1",[a])
   const result=await scalar('select public.purge_expired_data() value')
   assert.deepEqual(result,{ anonymous_users: 1, messages: 1, reports: 2, audit_rows: 1 })
   assert.equal(await count('public.race_messages where id=$1',[old]),0)
   assert.equal(await count('public.race_messages where id=$1',[held]),1)
   assert.equal(await count('public.race_messages where id=$1',[fresh.id]),1)
   assert.equal(await count('auth.users where id=$1',[anon]),1)
   assert.equal(await count("public.admin_audit where target=$1",[c]),1)
  })
 } finally { await db.close() }
})
