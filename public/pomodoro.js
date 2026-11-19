const timer = document.querySelector('[data-pomodoro]')
const modes = Array.from(timer.querySelectorAll('[data-mode]'))
const clock = timer.querySelector('[data-time]')
const toggle = timer.querySelector('[data-toggle]')
const reset = timer.querySelector('[data-reset]')
const count = timer.querySelector('[data-count]')
const status = timer.querySelector('[data-status]')
const [focusMode, shortBreak, longBreak] = modes

const duration = mode => Number(mode.dataset.minutes) * 60_000
let activeMode = focusMode
let remaining = duration(focusMode)
let deadline = null
let interval
let completed = 0

function showTime() {
  const seconds = Math.ceil(remaining / 1000)
  const minutesText = String(Math.floor(seconds / 60)).padStart(2, '0')
  const secondsText = String(seconds % 60).padStart(2, '0')
  const time = minutesText + ':' + secondsText
  if (clock.textContent !== time) clock.textContent = time
}

function stop() {
  clearInterval(interval)
  deadline = null
  toggle.textContent = '시작'
}

function selectMode(mode) {
  stop()
  activeMode.setAttribute('aria-pressed', 'false')
  activeMode = mode
  activeMode.setAttribute('aria-pressed', 'true')
  remaining = duration(mode)
  showTime()
}

function update() {
  if (deadline === null) return
  remaining = Math.max(0, deadline - Date.now())
  if (remaining > 0) return showTime()

  if (activeMode === focusMode) {
    completed += 1
    count.textContent = '완료한 집중 ' + completed + '회'
    const next = completed % 4 === 0 ? longBreak : shortBreak
    selectMode(next)
    status.textContent = '집중을 마쳤어요. 준비되면 시작을 눌러 휴식하세요.'
  } else {
    selectMode(focusMode)
    status.textContent = '휴식을 마쳤어요. 준비되면 다음 집중을 시작하세요.'
  }
}

for (const mode of modes) {
  mode.disabled = false
  mode.addEventListener('click', () => {
    if (mode === activeMode) return
    selectMode(mode)
    status.textContent = mode.textContent + ' 모드를 선택했어요.'
  })
}

toggle.disabled = false
toggle.addEventListener('click', () => {
  if (deadline !== null) {
    update()
    if (deadline === null) return
    stop()
    status.textContent = '일시정지했어요.'
    return
  }
  deadline = Date.now() + remaining
  toggle.textContent = '일시정지'
  status.textContent = '타이머를 시작했어요.'
  interval = setInterval(update, 250)
})

reset.disabled = false
reset.addEventListener('click', () => {
  selectMode(activeMode)
  status.textContent = '현재 타이머를 초기화했어요.'
})

document.addEventListener('visibilitychange', update)
