'use client'

import { useColorScheme } from '../contexts/ColorSchemeContext'

export function ThemeToggle() {
  const { theme, setTheme } = useColorScheme()

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <button
      onClick={toggleTheme}
      className="font-mono text-xs uppercase border-2 px-3 py-1 hover:opacity-80 transition-opacity"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-text)',
      }}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  )
}

