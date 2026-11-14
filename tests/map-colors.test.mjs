import test from 'node:test'
import assert from 'node:assert/strict'
import { runnerMapColors, RUNNER_MAP_COLORS, SELF_MAP_COLOR, STATION_MAP_COLOR } from '../src/lib/mapColors.js'

test('nearby runners get distinct colors even when their avatars all have the same outfit',()=>{
 const users=Array.from({length:8},(_,i)=>({id:`runner-${i}`,color:'#f08a5d'}))
 const colors=runnerMapColors(users)
 assert.equal(new Set(colors.values()).size,8)
 for(const color of colors.values()) {
  assert(RUNNER_MAP_COLORS.includes(color));assert.notEqual(color,SELF_MAP_COLOR);assert.notEqual(color,STATION_MAP_COLOR)
 }
 assert.deepEqual(colors,runnerMapColors([...users].reverse()))
 assert.equal(runnerMapColors([{id:'same'},{id:'same'}]).size,1)
 assert.equal(runnerMapColors([]).size,0)
})
