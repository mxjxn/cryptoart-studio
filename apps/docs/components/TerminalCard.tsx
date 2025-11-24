'use client'

import { ReactNode } from 'react'
import { useColorScheme } from '../contexts/ColorSchemeContext'

interface TerminalCardProps {
  children: ReactNode
  className?: string
  title?: string
}

export function TerminalCard({ children, className = '', title }: TerminalCardProps) {
  const { colors } = useColorScheme()

  return (
    <div
      className={`font-mono border-2 p-4 ${className}`}
      style={{
        borderColor: colors.border,
        backgroundColor: colors.background,
        color: colors.text,
      }}
    >
      {title && (
        <div
          className="mb-3 pb-2 border-b-2 font-bold uppercase text-sm"
          style={{ borderColor: colors.border }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  )
}

