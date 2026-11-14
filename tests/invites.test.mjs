import test from 'node:test'
import assert from 'node:assert/strict'
import {takeNewInvites} from '../src/lib/invites.js'
test('invite notifications are incoming-only and are not repeated by polling',()=>{
 const seen=new Set(),incoming={id:'one',incoming:true,nickname:'친구'},outgoing={id:'out',incoming:false}
 assert.deepEqual(takeNewInvites([incoming,outgoing],seen),[incoming])
 assert.deepEqual(takeNewInvites([incoming,outgoing],seen),[])
 assert.equal(takeNewInvites([{id:'two',incoming:true}],seen).length,1)
 takeNewInvites(Array.from({length:150},(_,i)=>({id:`new-${i}`,incoming:true})),seen)
 assert.equal(seen.size,100)
})
