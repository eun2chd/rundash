import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('admins create confirmed test accounts that stay out of rankings, and manage the admin role', async t => {
 const db = new PGlite()
 const boss='11111111-1111-4111-8111-111111111111', member='22222222-2222-4222-8222-222222222222', anon='33333333-3333-4333-8333-333333333333'
 const scalar=async(sql,args=[]) => (await db.query(sql,args)).rows[0]?.value
 const identity=async(id) => { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{\"is_anonymous\":false}',false)",[id]) }
 const create=(email, password='test-pass!1', nickname='테스터') => scalar('select public.admin_create_test_account($1,$2,$3) value',[email, password, nickname])
 const directory=(type='') => scalar("select public.admin_member_directory('',0,$1,'') value",[type])
 const setAdmin=(id, on, reason='운영 담당') => db.query('select public.admin_set_admin($1,$2,$3)',[id, on, reason])
 try {
  // Stand-ins for the parts of Supabase's auth schema and pgcrypto the function writes to.
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema extensions;
   create table auth.users(instance_id uuid, id uuid primary key, aud text, role text, email text, encrypted_password text, email_confirmed_at timestamptz,
     confirmation_token text, recovery_token text, email_change_token_new text, email_change text, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
     is_anonymous boolean default false, created_at timestamptz default now(), updated_at timestamptz, last_sign_in_at timestamptz);
   create table auth.identities(id uuid primary key, provider_id text, user_id uuid references auth.users(id) on delete cascade, identity_data jsonb, provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
   create function extensions.gen_salt(text) returns text language sql as 'select ''bf-salt''';
   create function extensions.crypt(text, text) returns text language sql as $$ select $2 || md5($1) $$;
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
   grant usage on schema auth to anon,authenticated;`)
  const directoryUrl=new URL('../supabase/migrations/',import.meta.url)
  for(const file of (await readdir(directoryUrl)).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file,directoryUrl),'utf8'))
  for(const [id,nickname] of [[boss,'Boss'],[member,'Member']]) {
   await db.query('insert into auth.users(id,email) values($1,$2)',[id,nickname.toLowerCase()+'@private.test'])
   await db.query("insert into public.profiles(id,nickname,color,skin) values($1,$2,'#e07b39','#f6d1b0')",[id,nickname])
  }
  await db.query('insert into auth.users(id,is_anonymous) values($1,true)',[anon])
  await db.query('insert into public.admin_members(user_id) values($1)',[boss])

  let testId
  await t.test('only admins create test accounts, with validated email, password and nickname',async()=>{
   await identity(member); await assert.rejects(create('qa1@example.com'),/관리자/)
   await identity(boss)
   await assert.rejects(create('not-an-email'),/이메일 형식/)
   await assert.rejects(create('qa1@example.com','short'),/비밀번호/)
   await assert.rejects(create('qa1@example.com','longenough1'),/비밀번호/)
   await assert.rejects(create('qa1@example.com','test-pass!1','x'),/닉네임/)
   await assert.rejects(create('member@private.test'),/이미 가입된 이메일/)
   await assert.rejects(create('qa1@example.com','test-pass!1','Member'),/이미 사용 중인 닉네임/)
   testId=await create(' QA1@Example.com ')
   await db.exec('reset role')
   const user=(await db.query('select * from auth.users where id=$1',[testId])).rows[0]
   assert.equal(user.email,'qa1@example.com'); assert.ok(user.email_confirmed_at); assert.equal(user.aud,'authenticated')
   assert.deepEqual([user.confirmation_token,user.recovery_token,user.email_change_token_new,user.email_change],['','','',''])
   assert.notEqual(user.encrypted_password,'test-pass!1'); assert.equal(user.raw_user_meta_data.nickname,'테스터')
   assert.equal(Number(await scalar("select count(*) value from auth.identities where user_id=$1 and provider='email'",[testId])),1)
   assert.equal(Number(await scalar('select count(*) value from public.test_accounts where user_id=$1',[testId])),1)
   assert.equal(Number(await scalar("select count(*) value from public.admin_audit where action='test_account_created' and target=$1",[testId])),1)
   await identity(boss); await assert.rejects(create('qa2@example.com','test-pass!1','테스터'),/이미 사용 중인 닉네임/)
  })
  await t.test('test accounts are listed separately and left out of member statistics',async()=>{
   await db.exec('reset role'); await db.query("insert into public.profiles(id,nickname,color,skin) values($1,'테스터','#e07b39','#f6d1b0')",[testId])
   await identity(boss)
   const all=await directory()
   assert.deepEqual(all.summary,{ total: 3, members: 2, anonymous: 1, suspended: 0, test: 1 })
   assert.deepEqual(all.items.map(item => [item.is_test, item.is_anonymous]), [[false,false],[false,false],[true,false],[false,true]])
   const tests=await directory('test'); assert.equal(tests.total,1); assert.equal(tests.items[0].id,testId)
   assert.equal((await directory('member')).total,2)
  })
  await t.test('test accounts never appear on any ranking board',async()=>{
   await db.exec('reset role')
   await db.query("insert into public.runs(user_id,details) values($1,$2),($3,$4)",[testId,JSON.stringify({ distanceKm: 50 }),member,JSON.stringify({ distanceKm: 3 })])
   await db.query("insert into public.runner_progress(user_id,xp,total_distance_km,run_count) values($1,99999,50,1),($2,300,3,1)",[testId,member])
   await identity(testId)
   for(const board of ['week','month','total','level']) {
    const result=await scalar('select public.runner_ranking($1,0) value',[board])
    assert(!result.items.some(row => row.nickname === '테스터'), board)
    assert.equal(result.me, null, board)
    assert(result.items.some(row => row.nickname === 'Member'), board)
   }
  })
  await t.test('admins grant and revoke the admin role for email members only',async()=>{
   await identity(member); await assert.rejects(setAdmin(member,true),/관리자/)
   await identity(boss)
   await assert.rejects(setAdmin(boss,false),/내 관리자 권한/)
   await assert.rejects(setAdmin(anon,true),/이메일로 가입한 회원/)
   await assert.rejects(setAdmin(member,true,' '),/사유/)
   await setAdmin(member,true)
   assert.equal((await directory()).items.find(item => item.id === member).admin, true)
   await identity(member); assert.equal(await scalar('select public.is_admin() value'), true)
   await identity(boss); await setAdmin(member,false)
   await identity(member); assert.equal(await scalar('select public.is_admin() value'), false)
   await db.exec('reset role')
   assert.deepEqual((await db.query("select action from public.admin_audit where target=$1 and action like 'admin_%' order by id",[member])).rows.map(r => r.action),['admin_grant','admin_revoke'])
   await db.query("insert into public.account_controls(user_id,suspended,reason) values($1,true,'test')",[member])
   await identity(boss); await assert.rejects(setAdmin(member,true),/이용 정지/)
  })
 } finally { await db.close() }
})
