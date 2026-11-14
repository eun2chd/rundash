import test from 'node:test'
import assert from 'node:assert/strict'
import { socialErrorMessage } from '../src/lib/socialErrors.js'

test('friend actions never display raw SQL or API error details to players', () => {
  const fallback = '지금은 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
  for (const message of ['Could not find function public.list_running_blocks', 'permission denied for table runner_locations', '네트워크 내부 오류: SQL select password', '', null]) {
    assert.equal(socialErrorMessage({ message }), fallback)
  }
  assert.equal(socialErrorMessage({ message: '이미 동행 중이에요.' }), '이미 동행 중이에요.')
  assert.equal(socialErrorMessage(null), fallback)
})
