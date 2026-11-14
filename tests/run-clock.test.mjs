import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceElapsed, restoreSimulation, validCheckpoint } from '../src/lib/runClock.js'
import { advanceSimulation } from '../src/lib/simulation.js'
import { trainingFor } from '../src/lib/progression.js'
import { drainPerKm } from '../src/lib/stamina.js'
const state=()=>{
 const c=trainingFor(0,'steady')
 return { ...c,elapsed:0,dist:0,totalM:5000,speed:1000/c.paceSec,drain:drainPerKm(c.paceSec)*c.drainMultiplier,stamina:c.maxStamina,recoverTo:c.maxStamina*.4,resting:false,restLeft:0,restSec:0,exhaust:0,paused:false,finished:false,timeScale:1,boostLeft:0,boostCooldownLeft:0,boostUses:0,practice:false }
}
test('a delayed/background tick matches normal steps across exhaustion and recovery',()=>{
 const normal=state(), delayed=state()
 for(let i=0;i<20000;i++) advanceSimulation(normal,.1)
 advanceElapsed(delayed,2000)
 assert(Math.abs(normal.dist-delayed.dist)<1e-6)
 assert.equal(normal.exhaust,delayed.exhaust)
 assert(Math.abs(normal.stamina-delayed.stamina)<1e-6)
 const frozen={...delayed,paused:true},copy={...frozen}; advanceElapsed(frozen,3600); assert.deepEqual(frozen,copy)
})
test('checkpoint restoration counts offline running once and preserves paused state and practice',()=>{
 const base=state(); advanceElapsed(base,50)
 const payload={version:1,runId:'run',savedAt:100000,sim:base,items:[],stations:[],closedStations:[],stats:{}}
 assert(validCheckpoint(payload,'run')); assert(!validCheckpoint(payload,'other'))
 const expected={...base}; advanceElapsed(expected,100)
 const actual=restoreSimulation(state(),payload,200000)
 assert(Math.abs(actual.dist-expected.dist)<1e-6)
 payload.sim={...base,paused:true,practice:true,timeScale:60}
 const paused=restoreSimulation(state(),payload,200000)
 assert.equal(paused.dist,base.dist); assert.equal(paused.practice,true); assert.equal(paused.timeScale,1)
 payload.sim.elapsed=NaN; assert(!validCheckpoint(payload,'run'))
})
test('long catch-up finishes once; invalid time does not change state',()=>{
 const s=state(); advanceElapsed(s,86400); assert.equal(s.dist,s.totalM); assert(s.finished)
 const copy={...s}; advanceElapsed(s,86400); assert.deepEqual(s,copy)
 const fresh=state(), original={...fresh}; advanceElapsed(fresh,NaN); advanceElapsed(fresh,-10); assert.deepEqual(fresh,original)
})
