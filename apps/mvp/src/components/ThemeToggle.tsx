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
      className="flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-[#1a1a1a] transition-colors w-full text-left"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <span className="text-base">{theme === 'dark' ? '☀' : '☾'}</span>
      <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
    </button>
  )
}

