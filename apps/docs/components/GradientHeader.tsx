'use client'

import { useColorScheme } from '../contexts/ColorSchemeContext'
import { useMemo } from 'react'

interface GradientHeaderProps {
  children: React.ReactNode
  className?: string
}

export function GradientHeader({ children, className = '' }: GradientHeaderProps) {
  const { colors } = useColorScheme()

  const gradientStyle = useMemo(() => ({
    backgroundImage: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary}, ${colors.tertiary})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    color: 'transparent',
    display: 'inline-block',
  }), [colors.primary, colors.secondary, colors.tertiary])

  return (
    <h1
      className={`font-mono font-bold gradient-text ${className}`}
      style={gradientStyle}
    >
      {children}
    </h1>
  )
}

