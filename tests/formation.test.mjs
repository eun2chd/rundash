import test from 'node:test'
import assert from 'node:assert/strict'
import { formationOffset } from '../src/lib/formation.js'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('four companion seats form two rows of two without changing run distances',()=>{
 const seats=[0,1,2,3].map(formationOffset)
 assert.equal(new Set(seats.map(s=>`${s.distance}:${s.lane}`)).size,4)
 assert.equal(seats.filter(s=>s.distance>0).length,2)
 assert.equal(seats.filter(s=>s.distance<0).length,2)
 assert.equal(seats[0].distance,seats[1].distance)
 assert.equal(seats[2].distance,seats[3].distance)
 assert(seats[0].lane<0&&seats[1].lane>0)
 assert.deepEqual(formationOffset(undefined),{distance:0,lane:0})
 assert.deepEqual(formationOffset(4),{distance:0,lane:0})
})
test('group roster renders 2/4 or 4/4 and all member nicknames, including self',async()=>{
 const result=await build({entryPoints:[new URL('../src/components/GroupRoster.jsx',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')],bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',external:['react','react/jsx-runtime']})
 const module={exports:{}}
 new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports)
 const GroupRoster=module.exports.default
 for(const count of [2,4]) {
  const members=['은총','달리미','토끼','거북'].slice(0,count).map((nickname,slot)=>({id:String(slot),nickname,slot}))
  const html=renderToStaticMarkup(createElement(GroupRoster,{group:{memberCount:count,members},userId:'0'}))
  assert(html.includes(`${count}/4`));assert(html.includes('은총 (나)'))
  for(const member of members)assert(html.includes(member.nickname))
  assert.equal((html.match(/<li>/g)||[]).length,count)
 }
})
