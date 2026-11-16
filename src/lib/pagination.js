// Page math for <Pagination>. Pages are 0-based; a block is `blockSize` consecutive page numbers.
export function pageWindow({ page, total, pageSize = 10, blockSize = 10 }) {
  const pageCount = Math.max(1, Math.ceil((Number(total) || 0) / pageSize))
  const current = Math.min(Math.max(0, page), pageCount - 1)
  const blockStart = Math.floor(current / blockSize) * blockSize
  const blockEnd = Math.min(pageCount, blockStart + blockSize)
  return {
    pageCount,
    pages: Array.from({ length: blockEnd - blockStart }, (_, i) => blockStart + i),
    // « goes to the first page of the previous block, » to the first page of the next.
    prevBlock: blockStart > 0 ? blockStart - blockSize : null,
    nextBlock: blockEnd < pageCount ? blockEnd : null,
  }
}

// Running row number across pages (1-based).
export const rowNumber = (page, index, pageSize = 10) => page * pageSize + index + 1
