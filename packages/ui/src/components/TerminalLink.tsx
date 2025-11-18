'use client'

import Link from 'next/link'
import { useTheme } from '../theme/ThemeProvider'

interface TerminalLinkProps {
  href: string
  children: React.ReactNode
  className?: string
  external?: boolean
}

export function TerminalLink({ href, children, className = '', external = false }: TerminalLinkProps) {
  const { colors } = useTheme()

  const linkProps = external
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {}

  return (
    <Link
      href={href}
      className={`font-mono underline-offset-2 hover:underline transition-colors ${className}`}
      style={{
        color: colors.primary,
      }}
      {...linkProps}
    >
      {children}
    </Link>
  )
}

