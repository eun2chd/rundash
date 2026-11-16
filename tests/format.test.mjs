import test from 'node:test'
import assert from 'node:assert/strict'
import { num, groupDigits, parseGrouped } from '../src/lib/format.js'

test('numbers get thousands separators', () => {
  assert.equal(num(3400000), '3,400,000')
  assert.equal(num(1234.5, 2), '1,234.50')
  assert.equal(num(0.05), '0.05')
  assert.equal(num(26219.84, undefined, 1), '26,219.8')
  assert.equal(num('x'), '0')
})

test('typed numbers keep commas while editing and parse back', () => {
  assert.equal(groupDigits('1730510'), '1,730,510')
  assert.equal(groupDigits('1,2345.'), '12,345.')
  assert.equal(groupDigits('0.05'), '0.05')
  assert.equal(groupDigits('-12a34'), '-1,234')
  assert.equal(parseGrouped('1,730,510'), 1730510)
  assert.equal(parseGrouped('12,345.5'), 12345.5)
  assert.equal(parseGrouped(''), '')
  assert.equal(parseGrouped('-'), '')
})
