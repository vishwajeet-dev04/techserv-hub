import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
      className={`w-9 h-9 rounded-xl border border-line text-muted hover:text-ink hover:bg-canvas flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand shrink-0 ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4" strokeWidth={2} aria-hidden />
      ) : (
        <Moon className="w-4 h-4" strokeWidth={2} aria-hidden />
      )}
    </button>
  )
}
