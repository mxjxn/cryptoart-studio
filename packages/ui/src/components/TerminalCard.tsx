'use client'

import React from 'react'
import { useTheme } from '../theme/ThemeProvider'

interface TerminalCardProps {
  children: React.ReactNode
  className?: string
  title?: string
}

export function TerminalCard({ children, className = '', title }: TerminalCardProps) {
  const { colors } = useTheme()

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

