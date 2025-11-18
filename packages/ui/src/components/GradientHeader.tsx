'use client'

import { useMemo } from 'react'
import { useTheme } from '../theme/ThemeProvider'

interface GradientHeaderProps {
  children: React.ReactNode
  className?: string
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

export function GradientHeader({ children, className = '', as: Component = 'h1' }: GradientHeaderProps) {
  const { colors } = useTheme()

  const gradientStyle = useMemo(() => ({
    backgroundImage: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary}, ${colors.tertiary})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    color: 'transparent',
    display: 'inline-block',
  }), [colors.primary, colors.secondary, colors.tertiary])

  return (
    <Component
      className={`font-mono font-bold gradient-text ${className}`}
      style={gradientStyle}
    >
      {children}
    </Component>
  )
}

