'use client'

import React, { createContext, useContext, useState, useEffect, useMemo, useLayoutEffect } from 'react'
import { generateColorScheme, ColorScheme, DEFAULT_HUE, DEFAULT_THEME_MODE, THEME_MODES, ThemeMode } from './colorScheme'

export type ThemeModeName = keyof typeof THEME_MODES

interface ThemeContextType {
  hue: number
  setHue: (hue: number) => void
  themeMode: ThemeModeName
  setThemeMode: (mode: ThemeModeName) => void
  colors: ColorScheme
  availableModes: ThemeModeName[]
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const STORAGE_KEY_HUE = 'cryptoart-theme-hue'
const STORAGE_KEY_THEME_MODE = 'cryptoart-theme-mode'

interface ThemeProviderProps {
  children: React.ReactNode
  storagePrefix?: string
  defaultHue?: number
  defaultThemeMode?: ThemeModeName
}

export function ThemeProvider({ 
  children, 
  storagePrefix = 'cryptoart',
  defaultHue = DEFAULT_HUE,
  defaultThemeMode = DEFAULT_THEME_MODE 
}: ThemeProviderProps) {
  const [hue, setHueState] = useState<number>(defaultHue)
  const [themeMode, setThemeModeState] = useState<ThemeModeName>(defaultThemeMode)
  const [mounted, setMounted] = useState(false)

  const storageKeyHue = `${storagePrefix}-theme-hue`
  const storageKeyThemeMode = `${storagePrefix}-theme-mode`

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true)
    const storedHue = localStorage.getItem(storageKeyHue)
    if (storedHue) {
      const parsed = parseInt(storedHue, 10)
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 360) {
        setHueState(parsed)
      }
    }
    const storedThemeMode = localStorage.getItem(storageKeyThemeMode)
    if (storedThemeMode && storedThemeMode in THEME_MODES) {
      setThemeModeState(storedThemeMode as ThemeModeName)
    }
  }, [storageKeyHue, storageKeyThemeMode])

  // Update localStorage when hue changes
  const setHue = (newHue: number) => {
    const normalized = Math.max(0, Math.min(360, newHue))
    setHueState(normalized)
    if (mounted) {
      localStorage.setItem(storageKeyHue, normalized.toString())
    }
  }

  // Update localStorage when theme mode changes
  const setThemeMode = (newMode: ThemeModeName) => {
    if (newMode in THEME_MODES) {
      setThemeModeState(newMode)
      if (mounted) {
        localStorage.setItem(storageKeyThemeMode, newMode)
      }
    }
  }

  const mode = THEME_MODES[themeMode]
  
  // Memoize colors to prevent unnecessary re-renders and conflicts with Emotion's useInsertionEffect
  const colors = useMemo(() => generateColorScheme(hue, mode), [hue, mode])

  // Apply CSS variables synchronously using useLayoutEffect to avoid conflicts with Emotion's style insertion
  useLayoutEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      root.style.setProperty('--color-primary', colors.primary)
      root.style.setProperty('--color-secondary', colors.secondary)
      root.style.setProperty('--color-tertiary', colors.tertiary)
      root.style.setProperty('--color-success', colors.success)
      root.style.setProperty('--color-warning', colors.warning)
      root.style.setProperty('--color-error', colors.error)
      root.style.setProperty('--color-background', colors.background)
      root.style.setProperty('--color-background-gradient', colors.backgroundGradient)
      root.style.setProperty('--color-text', colors.text)
      root.style.setProperty('--color-border', colors.border)
      root.style.setProperty('--color-accent', colors.accent)
    }
  }, [colors])

  return (
    <ThemeContext.Provider 
      value={{ 
        hue, 
        setHue, 
        themeMode, 
        setThemeMode, 
        colors,
        availableModes: Object.keys(THEME_MODES) as ThemeModeName[]
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

