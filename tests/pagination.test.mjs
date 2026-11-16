import test from 'node:test'
import assert from 'node:assert/strict'
import { pageWindow, rowNumber } from '../src/lib/pagination.js'

test('ten page numbers per block with block jumps', () => {
  const first = pageWindow({ page: 0, total: 235 })
  assert.equal(first.pageCount, 24)
  assert.deepEqual(first.pages, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  assert.equal(first.prevBlock, null); assert.equal(first.nextBlock, 10)
  const middle = pageWindow({ page: 13, total: 235 })
  assert.deepEqual(middle.pages, [10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
  assert.equal(middle.prevBlock, 0); assert.equal(middle.nextBlock, 20)
  const last = pageWindow({ page: 23, total: 235 })
  assert.deepEqual(last.pages, [20, 21, 22, 23])
  assert.equal(last.nextBlock, null); assert.equal(last.prevBlock, 10)
})

test('small and empty lists, and running row numbers', () => {
  assert.deepEqual(pageWindow({ page: 0, total: 7 }).pages, [0])
  assert.equal(pageWindow({ page: 5, total: 0 }).pageCount, 1)
  assert.deepEqual(pageWindow({ page: 9, total: 25 }).pages, [0, 1, 2])
  assert.equal(rowNumber(0, 0), 1); assert.equal(rowNumber(2, 4), 25)
})
