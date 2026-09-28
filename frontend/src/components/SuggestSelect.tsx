import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { fieldClass, labelClass } from './Modal'

export default function SuggestSelect({
  label,
  value,
  options,
  onChange,
  error,
  required,
  placeholder = 'Type or choose…',
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
  error?: string
  required?: boolean
  placeholder?: string
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return [...options]
    return options.filter((item) => item.toLowerCase().includes(q))
  }, [options, value])

  useEffect(() => {
    setHighlight(0)
  }, [value, open])

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const pick = (item: string) => {
    onChange(item)
    setOpen(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      if (filtered.length === 0) return
      setHighlight((i) => (i + 1) % filtered.length)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (filtered.length === 0) return
      setHighlight((i) => (i - 1 + filtered.length) % filtered.length)
      return
    }
    if (event.key === 'Enter' && open && filtered[highlight]) {
      event.preventDefault()
      pick(filtered[highlight])
      return
    }
    if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <label className={labelClass}>{label}</label>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className={`${fieldClass}${error ? ' border-danger' : ''}`}
        value={value}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
      />
      {open && filtered.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-line bg-surface shadow-lg"
        >
          {filtered.map((item, index) => (
            <li key={item} role="option" aria-selected={index === highlight}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-sm ${
                  index === highlight ? 'bg-brand-soft text-ink' : 'text-ink hover:bg-canvas'
                }`}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  pick(item)
                }}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && value.trim() && filtered.length === 0 ? (
        <p className="absolute z-20 mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-muted shadow-lg">
          No matches — your custom value will be saved.
        </p>
      ) : null}
      {error ? <p className="text-xs text-danger mt-1">{error}</p> : null}
    </div>
  )
}
