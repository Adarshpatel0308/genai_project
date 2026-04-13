import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { CloudSun, Search, Droplets, Bug, Droplet, AlertTriangle, MapPin, Wind } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'
import { weatherAPI } from '../services/api'

const WMO_ICONS: Record<string, string> = {
  'Clear sky': '☀️', 'Mainly clear': '🌤️', 'Partly cloudy': '⛅', 'Overcast': '☁️',
  'Foggy': '🌫️', 'Light drizzle': '🌦️', 'Moderate drizzle': '🌧️',
  'Slight rain': '🌧️', 'Moderate rain': '🌧️', 'Heavy rain': '⛈️',
  'Thunderstorm': '⛈️', 'Slight showers': '🌦️',
}
const PEST_COLORS: Record<string, string> = { low: '#60a5fa', medium: '#f59e0b', high: '#ef4444' }

interface Suggestion {
  display_name: string
  label: string
  sublabel: string
  lat: string
  lon: string
  type?: string
}

export default function WeatherPage() {
  const { t } = useTranslation()
  const [location, setLocation] = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [locating, setLocating] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Auto-detect current location on mount
  useEffect(() => {
    if (!navigator.geolocation) { setLocating(false); return }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        // Reverse geocode to get location name
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
            { headers: { 'User-Agent': 'PRAGATI-AgriApp/1.0' } }
          )
          const json = await res.json()
          const a = json.address || {}
          const name = a.village || a.town || a.city || a.county || 'Current Location'
          const parts = [a.village || a.town || a.city, a.county || a.district, a.state].filter(Boolean)
          const displayName = [...new Set(parts)].join(', ')
          setLocation(displayName)
          fetchWeather(`${latitude},${longitude}`, displayName)
        } catch {
          fetchWeather(`${latitude},${longitude}`, 'Current Location')
        } finally {
          setLocating(false)
        }
      },
      () => setLocating(false), // Permission denied — show empty state
      { timeout: 8000 }
    )
  }, [])

  // Outside click handler
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchSuggestions = async (query: string) => {
    if (query.length < 2) { setSuggestions([]); return }
    setSuggestLoading(true)
    try {
      // Search with multiple strategies for better village/tehsil matching
      const searches = [
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=in&format=json&limit=8&addressdetails=1&featuretype=settlement`,
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ' India')}&format=json&limit=6&addressdetails=1`,
      ]

      const results = await Promise.any(
        searches.map(url => fetch(url, { headers: { 'User-Agent': 'PRAGATI-AgriApp/1.0' } }).then(r => r.json()))
      )

      const mapped: Suggestion[] = results.map((item: any) => {
        const a = item.address || {}
        const name = a.village || a.hamlet || a.suburb || a.town || a.city || a.county || item.name
        // Full hierarchy: village → tehsil/block → district → state
        const parts = [
          a.village || a.hamlet || a.suburb,
          a.city_district || a.town,
          a.county || a.district,
          a.state
        ].filter(Boolean)
        const unique = [...new Set(parts)]
        const sublabel = unique.join(', ')
        return {
          display_name: item.display_name,
          label: name,
          sublabel,
          lat: item.lat,
          lon: item.lon,
          type: item.type,
        }
      }).filter((s: Suggestion) => s.label && s.sublabel)

      // Deduplicate by lat/lon proximity
      const seen = new Set<string>()
      const unique = mapped.filter((s: Suggestion) => {
        const key = `${parseFloat(s.lat).toFixed(2)},${parseFloat(s.lon).toFixed(2)}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      setSuggestions(unique.slice(0, 7))
      setShowSuggestions(true)
    } catch {
      setSuggestions([])
    } finally {
      setSuggestLoading(false)
    }
  }

  const handleInputChange = (val: string) => {
    setLocation(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 350)
  }

  // When user selects a suggestion, pass the full sublabel for accurate geocoding
  const selectSuggestion = (s: Suggestion) => {
    setLocation(s.sublabel)
    setShowSuggestions(false)
    setSuggestions([])
    // Pass lat/lon directly as query so backend geocodes exactly right
    fetchWeather(`${s.lat},${s.lon}`, s.sublabel)
  }

  const fetchWeather = async (loc?: string, displayName?: string) => {
    const q = (loc || location).trim()
    if (!q) return
    setLoading(true)
    setShowSuggestions(false)
    try {
      const res = await weatherAPI.forecast(q)
      if (res.data?.error) {
        toast.error(res.data.error)
        return
      }
      if (displayName && res.data) res.data.location = displayName
      setData(res.data)
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Could not fetch weather. Try selecting from suggestions.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const chartData = data?.forecast?.map((d: any) => ({
    date: d.date.slice(5), max: d.max_temp, min: d.min_temp, rain: d.rainfall_mm,
  })) || []

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display font-bold text-2xl text-white flex items-center gap-3">
          <CloudSun className="text-brand-400" size={28} />
          {t('weather.title')}
        </h1>
        <p className="text-gray-400 text-sm mt-1">{t('weather.subtitle')}</p>
      </div>

      {/* Search */}
      <div className="relative max-w-lg" ref={wrapperRef}>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input value={location} onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  // Auto-select first suggestion if available
                  if (suggestions.length > 0) {
                    selectSuggestion(suggestions[0])
                  } else {
                    fetchWeather()
                  }
                }
                if (e.key === 'ArrowDown' && suggestions.length > 0) {
                  setShowSuggestions(true)
                }
              }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Type village, tehsil or district name..."
              className="input-field w-full pr-8" autoComplete="off" />
            {suggestLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
            )}
          </div>
          <button onClick={() => fetchWeather()} disabled={loading} className="btn-primary px-5 flex items-center gap-2">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={18} />}
            {t('weather.get_forecast')}
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-1">💡 Select from suggestions for accurate results. Example: type <span className="text-gray-500">"Chandon"</span> → select <span className="text-gray-500">"Chandon, Bankhedi, Narmadapuram, Madhya Pradesh"</span></p>

        {/* Suggestions */}
        <AnimatePresence>
          {showSuggestions && suggestions.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
              className="absolute top-full left-0 right-0 mt-1 glass-card p-2 space-y-1 z-50"
              style={{ maxHeight: 280, overflowY: 'auto' }}>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => selectSuggestion(s)}
                  className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(29,78,216,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                  <MapPin size={14} className="text-brand-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium">{s.label}</p>
                    <p className="text-xs text-gray-500 truncate">{s.sublabel}</p>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Locating spinner */}
      {locating && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl max-w-lg"
          style={{ background: 'rgba(29,78,216,0.1)', border: '1px solid rgba(29,78,216,0.2)' }}>
          <div className="w-4 h-4 border-2 border-brand-500/30 border-t-brand-400 rounded-full animate-spin flex-shrink-0" />
          <span className="text-sm text-brand-300">Detecting your current location...</span>
        </motion.div>
      )}

      {loading && !locating && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl max-w-lg"
          style={{ background: 'rgba(29,78,216,0.08)', border: '1px solid rgba(29,78,216,0.15)' }}>
          <div className="w-4 h-4 border-2 border-brand-500/30 border-t-brand-400 rounded-full animate-spin flex-shrink-0" />
          <span className="text-sm text-gray-400">Fetching weather data...</span>
        </motion.div>
      )}

      {!locating && !loading && !data && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <CloudSun size={48} className="text-gray-600" />
          <p className="text-gray-400 text-sm">Allow location access or search for a location above</p>
        </motion.div>
      )}

      <AnimatePresence>
        {data && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Current conditions */}
            {data.current && (
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-brand-400" />
                      <span className="text-white font-semibold">{data.location}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{data.local_time}</p>
                  </div>
                  {data.air_quality && (
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                      data.air_quality.index <= 2 ? 'text-green-400' : data.air_quality.index <= 3 ? 'text-amber-400' : 'text-red-400'
                    }`} style={{ background: data.air_quality.index <= 2 ? 'rgba(16,185,129,0.1)' : data.air_quality.index <= 3 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)' }}>
                      AQI: {data.air_quality.label}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center">
                    <p className="text-4xl mb-1">{data.current.condition_icon}</p>
                    <p className="text-2xl font-bold text-white">{data.current.temp_c}°C</p>
                    <p className="text-xs text-gray-500">{data.current.condition}</p>
                  </div>
                  <div className="flex flex-col gap-2 justify-center">
                    <div className="flex items-center gap-2">
                      <Droplets size={14} className="text-blue-400" />
                      <span className="text-sm text-gray-300">Humidity: {data.current.humidity}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wind size={14} className="text-gray-400" />
                      <span className="text-sm text-gray-300">Wind: {data.current.wind_kph} km/h</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 justify-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Feels like</span>
                      <span className="text-sm text-white">{data.current.feels_like}°C</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">UV Index</span>
                      <span className="text-sm text-white">{data.current.uv_index}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 justify-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Visibility</span>
                      <span className="text-sm text-white">{data.current.visibility_km} km</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Pressure</span>
                      <span className="text-sm text-white">{data.current.pressure_mb} mb</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Alerts */}
            {data.alerts?.length > 0 && (
              <div className="space-y-2">
                {data.alerts.map((alert: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
                    <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
                    <span className="text-sm text-amber-300">{alert.message} — {alert.date}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 7-day forecast */}
            <div>
              <h2 className="font-semibold text-white mb-3">7-Day Forecast</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {data.forecast?.map((day: any, i: number) => (
                  <motion.div key={day.date} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card p-4 text-center transition-colors"
                    style={{ cursor: 'default' }}>
                    <p className="text-xs text-gray-500 mb-2">{day.date.slice(5)}</p>
                    <div className="text-2xl mb-2">{day.condition_icon || '🌡️'}</div>
                    <p className="text-white font-semibold text-sm">{day.max_temp}°</p>
                    <p className="text-gray-500 text-xs">{day.min_temp}°</p>
                    <div className="mt-2 flex items-center justify-center gap-1">
                      <Droplets size={10} className="text-blue-400" />
                      <span className="text-xs text-blue-400">{day.rain_probability}%</span>
                    </div>
                    <div className="mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ color: PEST_COLORS[day.pest_risk], background: `${PEST_COLORS[day.pest_risk]}20` }}>
                        <Bug size={8} className="inline mr-1" />{day.pest_risk}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Temperature chart */}
            <div className="glass-card p-6">
              <h2 className="font-semibold text-white mb-4">Temperature & Rainfall Trend</h2>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#374151" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis stroke="#374151" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: 12 }} />
                  <Area type="monotone" dataKey="max" stroke="#1d4ed8" fill="url(#tempGrad)" strokeWidth={2} name="Max Temp °C" />
                  <Area type="monotone" dataKey="rain" stroke="#60a5fa" fill="url(#rainGrad)" strokeWidth={2} name="Rainfall mm" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Irrigation plan */}
            <div className="glass-card p-6">
              <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Droplet size={18} className="text-blue-400" />
                {t('weather.irrigation')}
              </h2>
              <div className="space-y-2">
                {data.irrigation_advice?.map((adv: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: '#162040' }}>
                    <span className="text-sm text-gray-300">{adv.date}</span>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium
                      ${adv.action === 'skip' ? 'bg-blue-500/20 text-blue-400'
                        : adv.action === 'irrigate_morning' ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-brand-500/20 text-brand-300'}`}>
                      {adv.action.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-gray-500">{adv.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
