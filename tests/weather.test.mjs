import test from 'node:test'
import assert from 'node:assert/strict'
import { WEATHER_TYPES, WEATHER_INTERVAL_MS, weatherAt, weatherDrainAt } from '../src/lib/weather.js'
import { advanceSimulation } from '../src/lib/simulation.js'
import { advanceElapsed, restoreSimulation } from '../src/lib/runClock.js'
import { trainingFor } from '../src/lib/progression.js'
import { drainPerKm } from '../src/lib/stamina.js'

function runner(time) {
 const c=trainingFor(0,'steady')
 return {...c,weatherTimeMs:time,elapsed:0,dist:0,totalM:10000,speed:1000/c.paceSec,drain:drainPerKm(c.paceSec)*c.drainMultiplier,stamina:c.maxStamina,recoverTo:c.maxStamina*.4,resting:false,restLeft:0,restSec:0,exhaust:0,paused:false,finished:false,timeScale:1,boostLeft:0,boostCooldownLeft:0,boostUses:0,practice:false}
}
test('shared course weather is deterministic per five-minute interval and always within its temperature/humidity ranges',()=>{
 const seen=new Set()
 for(let epoch=0;epoch<1000;epoch++) {
  const w=weatherAt(epoch*WEATHER_INTERVAL_MS+1234),type=WEATHER_TYPES.find(t=>t.id===w.id)
  assert.deepEqual(w,weatherAt(epoch*WEATHER_INTERVAL_MS+9999))
  assert(w.temperature>=type.temperature[0]&&w.temperature<=type.temperature[1])
  assert(w.humidity>=type.humidity[0]&&w.humidity<=type.humidity[1]);seen.add(w.id)
 }
 assert.equal(seen.size,WEATHER_TYPES.length)
 assert.equal(WEATHER_TYPES.reduce((sum,w)=>sum+w.weight,0),100)
 assert.equal(weatherDrainAt(undefined),1)
})
test('only extreme weather increases stamina drain; recovery and pause do not drain extra stamina',()=>{
 for(const type of WEATHER_TYPES) {
  const normal=runner(0),affected=runner(0)
  advanceSimulation(normal,.1,1);advanceSimulation(affected,.1,type.drainMultiplier)
  assert(Math.abs((100-affected.stamina)-(100-normal.stamina)*type.drainMultiplier)<1e-8)
  if(['clear','cloudy','rain','snow'].includes(type.id))assert.equal(type.drainMultiplier,1)
  else assert(type.drainMultiplier>1)
 }
 const s=runner(0);s.paused=true;const stamina=s.stamina;advanceElapsed(s,900);assert.equal(s.stamina,stamina);assert.equal(s.dist,0);assert.equal(s.weatherTimeMs,900000)
})
test('background catch-up crosses weather boundaries identically to normal ticks; checkpoint restoration keeps the same course weather',()=>{
 const start=WEATHER_INTERVAL_MS*50-5000
 const normal=runner(start),background=runner(start)
 for(let i=0;i<4000;i++)advanceElapsed(normal,.1)
 advanceElapsed(background,400)
 assert(Math.abs(normal.dist-background.dist)<1e-6)
 assert(Math.abs(normal.stamina-background.stamina)<1e-6)
 const payload={version:1,runId:'test',savedAt:start,sim:runner(start),items:[],stations:[],closedStations:[],stats:{}}
 const restored=restoreSimulation(runner(start+400000),payload,start+400000)
 assert.equal(restored.dist,payload.sim.dist)
 assert.equal(weatherAt(restored.weatherTimeMs).id,weatherAt(background.weatherTimeMs).id)
})
