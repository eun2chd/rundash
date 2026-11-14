import assert from 'node:assert/strict'
import test from 'node:test'
import { placeCloud } from './activityLayout.js'
const hit = (a,b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
test('four nearby clouds avoid all names and each other on mobile', () => {
  const names = [130,160,190,220].map((top,i) => ({left:90+i*12,top,right:210+i*12,bottom:top+24}))
  const obstacles = [...names]
  for (const name of names) {
    const cloud = placeCloud(name,112,52,obstacles,{width:390,height:844})
    assert.ok(cloud)
    assert.ok(!obstacles.some(other => hit(cloud,other)))
    assert.ok(cloud.left >= 8 && cloud.right <= 382 && cloud.top >= 8 && cloud.bottom <= 836)
    obstacles.push(cloud)
  }
})
test('no room never places a cloud over a name', () => {
  assert.equal(placeCloud({left:0,top:0,right:100,bottom:100},112,52,[{left:0,top:0,right:390,bottom:844}],{width:390,height:844}),null)
})
