'use client'

import { useTheme } from '../theme/ThemeProvider'
import { THEME_MODES } from '../theme/colorScheme'
import type { ThemeModeName } from '../theme/ThemeProvider'

interface ThemeSelectorProps {
  className?: string
}

export function ThemeSelector({ className = '' }: ThemeSelectorProps) {
  const { themeMode, setThemeMode, availableModes } = useTheme()

  return (
    <div className={`flex items-center gap-2 font-mono text-xs ${className}`}>
      <label htmlFor="theme-selector" className="uppercase whitespace-nowrap" style={{ color: 'var(--color-text)' }}>
        THEME
      </label>
      <select
        id="theme-selector"
        value={themeMode}
        onChange={(e) => setThemeMode(e.target.value as ThemeModeName)}
        className="border-2 px-2 py-1 uppercase"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-background)',
          color: 'var(--color-text)',
        }}
      >
        {availableModes.map((mode) => (
          <option key={mode} value={mode}>
            {THEME_MODES[mode].name}
          </option>
        ))}
      </select>
    </div>
  )
}

