import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('admin directory filters before pagination, has global counts, and rejects non-admins', async () => {
  const db = new PGlite()
  const boss='11111111-1111-4111-8111-111111111111', runner='22222222-2222-4222-8222-222222222222'
  const who=async id => { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]) }
  const list=async(query='',page=0,type='',status='') => (await db.query('select public.admin_member_directory($1,$2,$3,$4) value',[query,page,type,status])).rows[0].value
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key,email text,is_anonymous boolean default false,created_at timestamptz default now(),last_sign_in_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select '{"is_anonymous":false}'::jsonb $$;
      grant usage on schema auth to anon,authenticated;`)
    const dir=new URL('../supabase/migrations/',import.meta.url)
    const files=(await readdir(dir)).filter(f=>f.endsWith('.sql')).sort()
    for (const f of files) await db.exec(await readFile(new URL(f,dir),'utf8'))
    await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)',[boss,'boss@example.test',runner,'runner@example.test'])
    await db.query('insert into public.admin_members(user_id) values($1)',[boss])
    await db.query("insert into public.profiles(id,nickname,color,skin) values($1,'달리는회원','#e07b39','#f6d1b0')",[runner])
    await db.query("insert into public.account_controls(user_id,suspended,reason) values($1,true,'테스트')",[runner])
    await db.exec("insert into auth.users(id,is_anonymous,created_at) select gen_random_uuid(),true,now()+n*interval '1 second' from generate_series(1,30) n")
    await who(runner)
    await assert.rejects(list(),/관리자/)
    await who(boss)
    const all=await list()
    assert.equal(all.total,32)
    assert.equal(all.items.length,10)
    // Registered members come before anonymous runners, even though the anonymous ones are newer.
    assert.deepEqual(all.items.slice(0,2).map(item => item.is_anonymous),[false,false])
    assert(all.items.slice(2).every(item => item.is_anonymous))
    // Administrators are listed first, even when a regular member signed up later.
    await db.exec("reset role; update auth.users set created_at=now()+interval '1 hour' where email='runner@example.test'"); await who(boss)
    assert.deepEqual((await list()).items.slice(0,2).map(item => [item.id,item.admin]),[[boss,true],[runner,false]])
    assert.deepEqual(all.summary,{total:32,members:2,anonymous:30,suspended:1,test:0})
    assert.equal((await list('',1)).items.length,10)
    assert.equal((await list('',3)).items.length,2)
    const suspended=await list('',0,'member','suspended')
    assert.equal(suspended.total,1)
    assert.equal(suspended.items[0].id,runner)
    assert.deepEqual(suspended.summary,all.summary)
    assert.equal((await list('달리는')).items[0].id,runner)
    assert.equal((await list('runner@example.test')).total,1)
    assert.equal((await list('',0,'anonymous','active')).total,30)
    assert.equal((await list('no-match')).items.length,0)
    await assert.rejects(list('',0,'invalid'),/필터/)
    await db.exec('reset role; set role anon')
    await assert.rejects(list(),/permission denied/)
  } finally { await db.close() }
})
