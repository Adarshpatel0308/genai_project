import { useState, useRef, useEffect, useCallback } from 'react'
import { MapPin, Navigation, Search, Loader2, Wheat, ChevronDown, ChevronUp, Info, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { marketAPI } from '../../services/api'

const OPENCAGE_KEY = '8ba30e651d604e6abedf377faafb2fd4'

// ── Types ─────────────────────────────────────────────────────────────────────
interface LocationForm {
  village:     string
  subDistrict: string
  district:    string
  state:       string
  pincode:     string
}

interface Suggestion {
  label:    string
  sublabel: string
  lat:      number
  lng:      number
  state?:   string
  district?: string
  subDistrict?: string
  village?: string
  pincode?: string
}

interface MandiPrice {
  commodity:   string
  min_price:   number
  max_price:   number
  modal_price: number
}

interface Mandi {
  name:        string
  state:       string
  district:    string
  distance_km: number
  prices:      MandiPrice[]
}

interface Result {
  mandis:               Mandi[]
  recommendation:       string
  total_mandis_checked: number
}

const EMPTY_FORM: LocationForm = {
  village: '', subDistrict: '', district: '', state: '', pincode: ''
}

// ── OpenCage fetch helper ─────────────────────────────────────────────────────
async function fetchOpenCage(q: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(q + ', India')}&key=${OPENCAGE_KEY}&countrycode=in&limit=6&no_annotations=1&language=en`
    )
    const data = await res.json()
    return (data.results || []).filter((r: any) =>
      r.components?.country_code === 'in'
    )
  } catch {
    return []
  }
}

function parseSuggestion(r: any): Suggestion {
  const c = r.components || {}
  const label =
    c.village || c.hamlet || c.suburb || c.town ||
    c.city    || c.county || r.formatted.split(',')[0]
  return {
    label,
    sublabel:    r.formatted,
    lat:         r.geometry.lat,
    lng:         r.geometry.lng,
    state:       c.state            || '',
    district:    c.state_district   || c.county || '',
    subDistrict: c.city_district    || c.town   || '',
    village:     c.village          || c.hamlet || '',
    pincode:     c.postcode         || '',
  }
}

// ── Autocomplete hook ─────────────────────────────────────────────────────────
function useAutocomplete(query: string, contextQuery: string) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading]         = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setSuggestions([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const combined = contextQuery ? `${q}, ${contextQuery}` : q
      const results  = await fetchOpenCage(combined)
      const seen     = new Set<string>()
      const parsed   = results
        .map(parseSuggestion)
        .filter(s => {
          const key = `${s.lat.toFixed(3)},${s.lng.toFixed(3)}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      setSuggestions(parsed)
      setLoading(false)
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, contextQuery])

  return { suggestions, loading, clear: () => setSuggestions([]) }
}

// ── Single autocomplete field ─────────────────────────────────────────────────
function AutoField({
  label, placeholder, value, onChange, onSelect, contextQuery, required
}: {
  label:        string
  placeholder:  string
  value:        string
  onChange:     (v: string) => void
  onSelect:     (s: Suggestion) => void
  contextQuery: string
  required?:    boolean
}) {
  const [open, setOpen]   = useState(false)
  const wrapRef           = useRef<HTMLDivElement>(null)
  const { suggestions, loading, clear } = useAutocomplete(value, contextQuery)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => { if (suggestions.length > 0) setOpen(true) }, [suggestions])

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-xs text-gray-400 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div className="relative">
        <input
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true) }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="input-field text-sm py-2 pr-7 w-full"
          autoComplete="off"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {loading
            ? <Loader2 size={12} className="animate-spin text-gray-500" />
            : value
              ? <button onMouseDown={() => { onChange(''); clear() }}>
                  <X size={12} className="text-gray-500 hover:text-white" />
                </button>
              : null
          }
        </div>
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden shadow-2xl"
          style={{ background: '#1a1030', border: '1px solid #2d1f4a', maxHeight: 200, overflowY: 'auto' }}>
          {suggestions.map((s, i) => (
            <li key={i}
              onMouseDown={() => { onSelect(s); setOpen(false); clear() }}
              className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-brand-500/20 transition-colors">
              <MapPin size={12} className="text-brand-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">{s.label}</p>
                <p className="text-xs text-gray-500 truncate">{s.sublabel}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NearestMandiFinder() {
  const [form, setForm]               = useState<LocationForm>(EMPTY_FORM)
  const [coords, setCoords]           = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading]         = useState(false)
  const [geoLoading, setGeoLoading]   = useState(false)
  const [resolving, setResolving]     = useState(false)
  const [result, setResult]           = useState<Result | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0)
  const [priceFilter, setPriceFilter] = useState('')

  const update = (k: keyof LocationForm, v: string) =>
    setForm(f => ({ ...f, [k]: v }))

  // When a suggestion is selected for any field, auto-fill related fields
  const handleSelect = (s: Suggestion, field: keyof LocationForm) => {
    setForm(f => ({
      ...f,
      [field]:      s.label,
      state:        s.state       || f.state,
      district:     s.district    || f.district,
      subDistrict:  s.subDistrict || f.subDistrict,
      village:      field === 'village' ? (s.village || s.label) : f.village,
      pincode:      s.pincode     || f.pincode,
    }))
    setCoords({ lat: s.lat, lng: s.lng })
  }

  // Build context query for each field from already-filled fields
  const ctx = (exclude: keyof LocationForm) =>
    [form.district, form.state]
      .filter((v, i) => {
        const keys: (keyof LocationForm)[] = ['district', 'state']
        return keys[i] !== exclude && v.trim()
      })
      .join(', ')

  // Resolve coordinates from form if not already set
  const resolveCoords = useCallback(async (): Promise<{ lat: number; lng: number } | null> => {
    if (coords) return coords

    // Build query from most specific to least specific
    const parts = [
      form.village, form.subDistrict, form.district, form.state, form.pincode
    ].filter(Boolean)

    if (parts.length === 0) return null

    setResolving(true)
    // Try progressively shorter queries
    for (let i = 0; i < parts.length; i++) {
      const q = parts.slice(i).join(', ')
      const results = await fetchOpenCage(q)
      if (results.length > 0) {
        const c = { lat: results[0].geometry.lat, lng: results[0].geometry.lng }
        setCoords(c)
        setResolving(false)
        return c
      }
    }
    setResolving(false)
    return null
  }, [coords, form])

  const handleSearch = async () => {
    const hasInput = Object.values(form).some(v => v.trim())
    if (!hasInput) { setError('Please fill at least one field.'); return }

    setError(null)
    setResult(null)

    const c = await resolveCoords()
    if (!c) {
      setError('Could not determine coordinates. Try filling district and state.')
      return
    }

    setLoading(true)
    try {
      const res = await marketAPI.nearestMandis({
        lat:      c.lat,
        lon:      c.lng,
        state:    form.state    || undefined,
        district: form.district || undefined,
        top:      5,
      })
      if (res.data.error) { setError(res.data.error); return }
      setResult(res.data)
      setExpandedIdx(0)
    } catch {
      setError('Failed to fetch mandi data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fetchByGeo = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return }
    setGeoLoading(true)
    setError(null)
    setResult(null)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lon } = pos.coords
        setCoords({ lat, lng: lon })
        setLoading(true)
        setGeoLoading(false)
        try {
          const res = await marketAPI.nearestMandis({
            lat, lon,
            state:    form.state    || undefined,
            district: form.district || undefined,
            top: 5,
          })
          if (res.data.error) { setError(res.data.error); return }
          setResult(res.data)
          setExpandedIdx(0)
        } catch {
          setError('Failed to fetch mandi data.')
        } finally {
          setLoading(false)
        }
      },
      () => { setError('Location access denied.'); setGeoLoading(false) }
    )
  }

  const clearAll = () => {
    setForm(EMPTY_FORM)
    setCoords(null)
    setResult(null)
    setError(null)
  }

  const isLoading = loading || geoLoading || resolving

  const filteredMandis = result?.mandis.map(m => ({
    ...m,
    prices: priceFilter
      ? m.prices.filter(p => p.commodity.toLowerCase().includes(priceFilter.toLowerCase()))
      : m.prices,
  })) ?? []

  return (
    <div className="glass-card p-5 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-amber-400" />
          <h2 className="font-semibold text-white text-sm">Nearest Mandi Finder</h2>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <span className="text-xs text-gray-500">{result.total_mandis_checked} mandis checked</span>
          )}
          <button onClick={fetchByGeo} disabled={isLoading} title="Use GPS"
            className="btn-ghost px-2 py-1.5 flex items-center gap-1 text-xs">
            {geoLoading
              ? <Loader2 size={13} className="animate-spin" />
              : <Navigation size={13} className="text-brand-400" />}
            GPS
          </button>
        </div>
      </div>

      {/* Structured form */}
      <div className="grid grid-cols-2 gap-3">
        <AutoField
          label="Village / Town"
          placeholder="e.g. Chandon, Bankhedi"
          value={form.village}
          onChange={v => { update('village', v); setCoords(null) }}
          onSelect={s => handleSelect(s, 'village')}
          contextQuery={ctx('village')}
        />
        <AutoField
          label="Sub-District / Tehsil"
          placeholder="e.g. Bankhedi"
          value={form.subDistrict}
          onChange={v => { update('subDistrict', v); setCoords(null) }}
          onSelect={s => handleSelect(s, 'subDistrict')}
          contextQuery={ctx('subDistrict')}
        />
        <AutoField
          label="District" required
          placeholder="e.g. Narmadapuram"
          value={form.district}
          onChange={v => { update('district', v); setCoords(null) }}
          onSelect={s => handleSelect(s, 'district')}
          contextQuery={form.state}
        />
        <AutoField
          label="State" required
          placeholder="e.g. Madhya Pradesh"
          value={form.state}
          onChange={v => { update('state', v); setCoords(null) }}
          onSelect={s => handleSelect(s, 'state')}
          contextQuery=""
        />
        <div>
          <label className="block text-xs text-gray-400 mb-1">Pincode</label>
          <input
            value={form.pincode}
            onChange={e => { update('pincode', e.target.value); setCoords(null) }}
            placeholder="e.g. 461990"
            className="input-field text-sm py-2 w-full"
            maxLength={6}
          />
        </div>
        <div className="flex items-end">
          <button onClick={clearAll} className="btn-ghost text-xs px-3 py-2 w-full">
            Clear All
          </button>
        </div>
      </div>

      {/* Resolved coords badge */}
      {coords && !isLoading && (
        <p className="text-xs text-brand-300">
          📍 Coordinates resolved: <span className="text-gray-400">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
        </p>
      )}

      {/* Search button */}
      <button
        onClick={handleSearch}
        disabled={isLoading || !Object.values(form).some(v => v.trim())}
        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isLoading
          ? <><Loader2 size={16} className="animate-spin" />
              {resolving ? 'Resolving location...' : 'Finding nearest mandis...'}
            </>
          : <><Search size={16} /> Find Nearest Mandis</>
        }
      </button>

      {/* Error */}
      {error && !isLoading && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm text-red-300"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <Info size={15} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Recommendation */}
      {result && !isLoading && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm text-amber-300"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <Info size={15} className="flex-shrink-0 mt-0.5 text-amber-400" />
          {result.recommendation}
        </div>
      )}

      {/* Crop filter */}
      {result && result.mandis.length > 0 && !isLoading && (
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={priceFilter}
            onChange={e => setPriceFilter(e.target.value)}
            placeholder="Filter by crop (e.g. wheat, onion)..."
            className="input-field text-xs py-1.5 pl-8 w-full"
          />
        </div>
      )}

      {/* Mandi results */}
      {!isLoading && filteredMandis.length > 0 && (
        <div className="space-y-2">
          {filteredMandis.map((mandi, idx) => (
            <div key={idx} className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e3a5f' }}>
              <button
                onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-brand-500/5 transition-colors"
                style={{ background: '#162040' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg">📍</span>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{mandi.name}</p>
                    <p className="text-xs text-gray-500">{mandi.district}, {mandi.state}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-semibold text-brand-300 bg-brand-500/10 px-2 py-0.5 rounded-full">
                    {mandi.distance_km} km
                  </span>
                  {mandi.prices.length > 0 && (
                    <span className="text-xs text-gray-500 hidden sm:inline">{mandi.prices.length} crops</span>
                  )}
                  {expandedIdx === idx
                    ? <ChevronUp size={14} className="text-gray-400" />
                    : <ChevronDown size={14} className="text-gray-400" />}
                </div>
              </button>

              {expandedIdx === idx && (
                <div className="px-4 py-3 space-y-2" style={{ background: '#0f1629' }}>
                  {mandi.prices.length > 0 ? (
                    <>
                      <div className="flex justify-between text-xs text-gray-600 pb-1 border-b border-gray-800">
                        <span>Commodity</span>
                        <div className="flex gap-4"><span>Min</span><span>Modal</span><span>Max</span></div>
                      </div>
                      {mandi.prices.map((p, pi) => (
                        <div key={pi} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-gray-300">
                            <Wheat size={11} className="text-amber-400 flex-shrink-0" />
                            <span className="capitalize">{p.commodity}</span>
                          </div>
                          <div className="flex items-center gap-4 text-right">
                            <span className="text-gray-400 w-14">₹{p.min_price}</span>
                            <span className="text-white font-semibold w-14">₹{p.modal_price}</span>
                            <span className="text-green-400 w-14">₹{p.max_price}</span>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="text-xs text-gray-600 text-center py-2">No price data for this mandi</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && !result && (
        <p className="text-xs text-gray-600 text-center py-2">
          Fill your location details above and click "Find Nearest Mandis"
        </p>
      )}
    </div>
  )
}
