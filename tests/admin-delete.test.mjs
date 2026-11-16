import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('admins delete member and anonymous accounts with a reason, never admins or themselves', async t => {
 const db = new PGlite()
 const boss='11111111-1111-4111-8111-111111111111', a='22222222-2222-4222-8222-222222222222', b='33333333-3333-4333-8333-333333333333', anon='44444444-4444-4444-8444-444444444444', boss2='55555555-5555-4555-8555-555555555555'
 const runs=['aaaaaaaa-aaaa-4aaa-8aaa-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-000000000002']
 const scalar=async(sql,args=[]) => (await db.query(sql,args)).rows[0]?.value
 const identity=async(id) => { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{\"is_anonymous\":false}',false)",[id]) }
 const remove=(id, confirm='삭제', reason='운영 정책 위반') => db.query('select public.admin_delete_member($1,$2,$3)',[id, confirm, reason])
 const count=async(sql,args=[]) => { await db.exec('reset role'); return Number(await scalar(`select count(*) value from ${sql}`,args)) }
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key,email text,is_anonymous boolean default false,created_at timestamptz default now(),last_sign_in_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
   grant usage on schema auth to anon,authenticated;`)
  const directory=new URL('../supabase/migrations/',import.meta.url)
  for(const file of (await readdir(directory)).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file,directory),'utf8'))
  for(const [id,nickname] of [[boss,'Boss'],[a,'Alice'],[b,'Bobby'],[boss2,'Second']]) {
   await db.query('insert into auth.users(id,email) values($1,$2)',[id,nickname+'@private.test'])
   await db.query("insert into public.profiles(id,nickname,color,skin) values($1,$2,'#e07b39','#f6d1b0')",[id,nickname])
  }
  await db.query('insert into auth.users(id,is_anonymous) values($1,true)',[anon])
  await db.query('insert into public.admin_members(user_id) values($1),($2)',[boss,boss2])

  await t.test('only admins may delete, with reason and confirmation; admins and self are protected',async()=>{
   await identity(a); await assert.rejects(remove(b),/관리자/)
   await identity(boss)
   await assert.rejects(remove(boss),/내 계정/)
   await assert.rejects(remove(boss2),/관리자 계정은 삭제/)
   await assert.rejects(remove(a,'삭제',' '),/사유/)
   await assert.rejects(remove(a,'Alice'),/확인 문구/)
   await assert.rejects(remove('99999999-9999-4999-8999-999999999999'),/이미 삭제/)
   assert.equal(await count('auth.users where id=$1',[a]),1)
  })
  await t.test('a member running in a group is fully removed and the deletion is audited',async()=>{
   for(let i=0;i<2;i++) { await identity([a,b][i]); await scalar("select public.start_training_run(p_run_id => $1, p_target_km => 1, p_intensity => 'steady') value",[runs[i]]); await scalar('select public.running_social_tick($1,10,1.5,false,false,true) value',[runs[i]]) }
   await identity(a); const invitation=await scalar('select public.invite_running_friend($1) value',[b])
   await identity(b); await scalar('select public.accept_running_invite($1,$2,$3) value',[invitation,JSON.stringify({ id: runs[1], distanceKm: 0, elapsedSec: 0, completed: false }),'aaaaaaaa-aaaa-4aaa-8aaa-000000000003'])
   await identity(a); await scalar("select public.send_race_message('안녕',null) value")
   await identity(boss); await remove(a)
   for(const table of ['auth.users where id=$1','public.profiles where id=$1','public.training_sessions where user_id=$1','public.race_messages where user_id=$1','public.running_pair_members where user_id=$1'])
    assert.equal(await count(table,[a]),0,table)
   assert.equal(await count('public.profiles where id=$1',[b]),1)
   await db.exec('reset role')
   const audit=(await db.query("select actor_id, details from public.admin_audit where action='account_deleted' and target=$1",[a])).rows[0]
   assert.equal(audit.actor_id, boss); assert.equal(audit.details.by,'admin'); assert.equal(audit.details.reason,'운영 정책 위반'); assert.equal(audit.details.nickname,'Alice')
  })
  await t.test('anonymous accounts can be deleted too',async()=>{
   await identity(boss); await remove(anon,'삭제','익명 계정 정리')
   assert.equal(await count('auth.users where id=$1',[anon]),0)
   await db.exec('reset role; set role anon'); await assert.rejects(remove(b),/permission denied/)
  })
 } finally { await db.close() }
})
