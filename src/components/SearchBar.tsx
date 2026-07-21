import { useEffect, useRef, useState } from 'react'
import { PlaceResult, searchPlaces } from '../services/geocode'

interface SearchBarProps {
  onSelectLocation: (result: PlaceResult) => void
  activeLabel: string | null
  onClear: () => void
}

export default function SearchBar({ onSelectLocation, activeLabel, onClear }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current
      try {
        const places = await searchPlaces(trimmed)
        if (requestId !== requestIdRef.current) return // a newer keystroke superseded this request
        setResults(places)
        setIsLoading(false)
        if (places.length === 0) setError('No matches found.')
      } catch (err) {
        if (requestId !== requestIdRef.current) return
        setResults([])
        setIsLoading(false)
        setError('Search failed — check your connection and try again.')
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  function handleSelect(result: PlaceResult) {
    onSelectLocation(result)
    setQuery('')
    setResults([])
    setIsOpen(false)
  }

  function handleClear() {
    onClear()
    setQuery('')
    setResults([])
  }

  return (
    <div className="relative px-3 py-2 border-b border-ink-200 dark:border-night-600">
      <div className="flex items-center gap-2 bg-ink-100 dark:bg-night-700 rounded-lg px-3 py-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-400 dark:text-night-400 shrink-0">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={activeLabel ?? 'Search a place or ZIP code'}
          className="bg-transparent text-sm outline-none w-full text-ink-900 dark:text-night-100 placeholder:text-ink-400 dark:placeholder:text-night-400"
        />
        {activeLabel && !query && (
          <button
            onClick={handleClear}
            aria-label="Reset to current location"
            className="text-xs text-ink-400 dark:text-night-400 shrink-0"
          >
            Reset
          </button>
        )}
      </div>

      {isOpen && query.trim().length >= 2 && (
        <div className="absolute left-3 right-3 top-full mt-1 z-[1100] bg-white dark:bg-night-800 border border-ink-200 dark:border-night-600 rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {isLoading && (
            <p className="px-3 py-2 text-xs text-ink-400 dark:text-night-400">Searching…</p>
          )}
          {!isLoading && error && (
            <p className="px-3 py-2 text-xs text-ink-400 dark:text-night-400">{error}</p>
          )}
          {!isLoading &&
            !error &&
            results.map((result, i) => (
              <button
                key={`${result.lat}-${result.lng}-${i}`}
                onClick={() => handleSelect(result)}
                className="block w-full text-left px-3 py-2 text-xs text-ink-900 dark:text-night-100 hover:bg-ink-100 dark:hover:bg-night-700 border-b border-ink-200 dark:border-night-600 last:border-b-0"
              >
                {result.label}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
