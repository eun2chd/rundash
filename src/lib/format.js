// Every number shown to people gets thousands separators (1,234,567). `digits` fixes the decimals
// (num(1234.5, 2) -> "1,234.50"); without it, up to `max` decimals are kept as needed.
// Intl.NumberFormat is costly to build and the HUD formats several numbers per frame, so one
// formatter per decimal setting is cached and reused.
const formatters = new Map()
const formatter = (min, max) => {
  const key = min + ':' + max
  let cached = formatters.get(key)
  if (!cached) formatters.set(key, cached = new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max }))
  return cached
}
export function num(value, digits, max = 2) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return digits === undefined ? formatter(0, max).format(n) : formatter(digits, digits).format(n)
}

// Text typed into a NumberInput: keeps one leading minus and one decimal point, adds commas to the
// whole part, and leaves the decimals as typed so "1,234." can still become "1,234.5".
export function groupDigits(text) {
  const clean = String(text ?? '').replace(/[^\d.-]/g, '')
  const negative = clean.startsWith('-')
  const [whole = '', ...rest] = clean.replace(/-/g, '').split('.')
  const grouped = whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (negative ? '-' : '') + grouped + (rest.length ? '.' + rest.join('') : '')
}

// The number a NumberInput's text stands for, or '' while it is empty or only "-" / ".".
export function parseGrouped(text) {
  const clean = String(text ?? '').replace(/,/g, '')
  if (clean === '' || clean === '-' || clean === '.' || clean === '-.') return ''
  const n = Number(clean)
  return Number.isFinite(n) ? n : ''
}
