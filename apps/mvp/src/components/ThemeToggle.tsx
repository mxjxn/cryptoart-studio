'use client'

import { useColorScheme } from '../contexts/ColorSchemeContext'

export function ThemeToggle() {
  const { mode, setMode } = useColorScheme()

  const toggleMode = () => {
    setMode(mode === 'minimal' ? 'colorful' : 'minimal')
  }

  return (
    <button
      onClick={toggleMode}
      className="flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-[#1a1a1a] transition-colors w-full text-left"
      aria-label={`Switch to ${mode === 'minimal' ? 'colorful' : 'minimal'} mode`}
    >
      <span className="text-base">{mode === 'minimal' ? '🎨' : '⚫'}</span>
      <span>{mode === 'minimal' ? 'Colorful Mode' : 'Minimal Mode'}</span>
    </button>
  )
}

