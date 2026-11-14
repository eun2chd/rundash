import { LuSun, LuCloud, LuCloudRain, LuSnowflake, LuFlame, LuWind, LuDroplets, LuThermometer } from 'react-icons/lu'
import { WEATHER_INTERVAL_MS } from '../lib/weather'

const ICONS = { clear: LuSun, cloudy: LuCloud, rain: LuCloudRain, heavy_rain: LuCloudRain, snow: LuSnowflake, blizzard: LuSnowflake, heat: LuFlame, cold: LuWind }
export default function WeatherDashboard({ weather, timestamp }) {
  if (!weather) return null
  const Icon = ICONS[weather.id] || LuCloud
  const extra = Math.round((weather.drainMultiplier-1)*100)
  const seconds = Math.max(0, Math.ceil((weather.changesAt-timestamp)/1000))
  return <section className={`weather-card weather-${weather.tone}`} aria-label="현재 코스 날씨">
    <div className="weather-heading"><span>코스 날씨</span></div>
    <div className="weather-main"><div className="weather-condition"><Icon aria-hidden="true" /><strong>{weather.label}</strong></div><strong className="weather-temperature">{weather.temperature}<small>°C</small></strong></div>
    <div className="weather-details"><span><LuDroplets /> 습도 <b>{weather.humidity}%</b></span><span><LuThermometer />{weather.precipitation ? `${weather.precipitation === 'rain' ? '비' : '눈'} ${weather.intensity === 'heavy' ? '강함' : '약함'}` : '강수 없음'}</span></div>
    <div className={`weather-impact ${extra ? 'severe' : ''}`}>{extra ? <>체력 소모 <strong>+{extra}%</strong></> : '체력 소모 기본'}</div>
    <div className="weather-next"><span>다음 날씨까지</span><time>{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</time></div>
    <div className="weather-timer" aria-hidden="true"><span style={{ width: `${Math.max(0,Math.min(100,(weather.changesAt-timestamp)/WEATHER_INTERVAL_MS*100))}%` }} /></div>
  </section>
}
