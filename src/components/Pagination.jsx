import { useEffect, useState } from 'react'
import { LuChevronLeft, LuChevronRight, LuChevronsLeft, LuChevronsRight } from 'react-icons/lu'
import { pageWindow } from '../lib/pagination'

// Shared list pagination: pages are 0-based internally and shown 1-based. Shows `blockSize`
// page numbers at a time; « » jump a whole block, ‹ › move one page, and the input jumps to
// any page directly.
export default function Pagination({ page, total, pageSize = 10, blockSize = 10, disabled = false, onChange, label = '목록 페이지' }) {
  const { pageCount, pages, prevBlock, nextBlock } = pageWindow({ page, total, pageSize, blockSize })
  const [jump, setJump] = useState(String(page + 1))
  useEffect(() => { setJump(String(page + 1)) }, [page])
  if (!total) return null
  const go = (next) => { if (!disabled && next !== page && next >= 0 && next < pageCount) onChange(next) }
  const submitJump = (event) => {
    event.preventDefault()
    const target = Math.round(Number(jump))
    if (Number.isFinite(target)) go(Math.min(pageCount, Math.max(1, target)) - 1)
    setJump(String(Math.min(pageCount, Math.max(1, target || page + 1))))
  }
  return <nav className="pagination" aria-label={label}>
    <div className="pagination-pages">
      <button type="button" className="pagination-arrow" aria-label={`이전 ${blockSize}페이지`} disabled={disabled || prevBlock === null} onClick={() => go(prevBlock)}><LuChevronsLeft /></button>
      <button type="button" className="pagination-arrow" aria-label="이전 페이지" disabled={disabled || page === 0} onClick={() => go(page - 1)}><LuChevronLeft /></button>
      <ol>
        {pages.map(number => <li key={number}><button type="button" className={`pagination-number${number === page ? ' current' : ''}`} aria-current={number === page ? 'page' : undefined} aria-label={`${number + 1}페이지`} disabled={disabled && number !== page} onClick={() => go(number)}>{number + 1}</button></li>)}
      </ol>
      <button type="button" className="pagination-arrow" aria-label="다음 페이지" disabled={disabled || page >= pageCount - 1} onClick={() => go(page + 1)}><LuChevronRight /></button>
      <button type="button" className="pagination-arrow" aria-label={`다음 ${blockSize}페이지`} disabled={disabled || nextBlock === null} onClick={() => go(nextBlock)}><LuChevronsRight /></button>
    </div>
    <form className="pagination-jump" onSubmit={submitJump}>
      <label htmlFor={`${label}-jump`} className="sr-only">이동할 페이지 번호</label>
      <input id={`${label}-jump`} type="number" inputMode="numeric" min={1} max={pageCount} value={jump} disabled={disabled} onChange={e => setJump(e.target.value)} />
      <span>/ {pageCount}</span>
      <button type="submit" className="btn ghost" disabled={disabled}>이동</button>
    </form>
  </nav>
}
