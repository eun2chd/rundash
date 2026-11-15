import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { xpForLevel } from '../src/lib/progression.js'

test('custom pace is limited by level, presets and the free-pace unlock', async t => {
 const db = new PGlite()
 const low='11111111-1111-4111-8111-111111111111', high='22222222-2222-4222-8222-222222222222'
 let n = 0
 const rid = () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++n).padStart(12, '0')}`
 const scalar=async(sql,args=[]) => (await db.query(sql,args)).rows[0]?.value
 const identity=async(id) => { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{\"is_anonymous\":false}',false)",[id]) }
 const start=async(user, intensity, pace) => { await identity(user); return scalar('select public.start_training_run(p_run_id => $1, p_target_km => 1, p_intensity => $2, p_pace_sec => $3) value',[rid(), intensity, pace]) }
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key,email text,is_anonymous boolean default false,created_at timestamptz default now(),last_sign_in_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
   grant usage on schema auth to anon,authenticated;`)
  const directory=new URL('../supabase/migrations/',import.meta.url)
  for(const file of (await readdir(directory)).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file,directory),'utf8'))
  for(const [id,nickname] of [[low,'Rookie'],[high,'Veteran']]) {
   await db.query('insert into auth.users(id,email) values($1,$2)',[id,nickname+'@private.test'])
   await db.query("insert into public.profiles(id,nickname,color,skin) values($1,$2,'#e07b39','#f6d1b0')",[id,nickname])
  }
  await db.query('insert into public.runner_progress(user_id,xp) values($1,$2)',[high, xpForLevel(20)])

  await t.test('Lv.1 can pick unlocked presets only',async()=>{
   assert.equal(Number((await start(low,'custom',540)).paceSec), 540)
   assert.equal(Number((await start(low,'custom',720)).paceSec), 720)
   await assert.rejects(start(low,'custom',510), /고를 수 없는 페이스/)
   await assert.rejects(start(low,'custom',545), /고를 수 없는 페이스/)
   await assert.rejects(start(low,'custom',905), /고를 수 없는 페이스/)
  })
  await t.test('Lv.20 may set any 5 second step down to its fastest pace',async()=>{
   assert.equal(Number((await start(high,'custom',365)).paceSec), 365)
   assert.equal(Number((await start(high,'custom',360)).paceSec), 360)
   await assert.rejects(start(high,'custom',355), /고를 수 없는 페이스/)
   await assert.rejects(start(high,'custom',362), /고를 수 없는 페이스/)
  })
  await t.test('the three intensities still work without a pace and report it',async()=>{
   await identity(low)
   const ticket=await scalar("select public.start_training_run(p_run_id => $1, p_target_km => 1, p_intensity => 'easy') value",[rid()])
   assert.equal(Number(ticket.paceSec), 690)
   await assert.rejects(start(low,'sprint',null), /러닝 설정/)
   await root()
   assert.equal(await scalar("select intensity value from public.training_sessions where id=$1",[ticket.id]), 'easy')
  })
 } finally { await db.close() }
 async function root() { await db.exec('reset role') }
})
