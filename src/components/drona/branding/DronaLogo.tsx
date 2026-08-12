'use client'

import React from 'react'
import { DronaLogoMark } from './DronaLogoMark'

type DronaLogoProps = {
  className?: string
  variant?: 'light' | 'dark'
  compact?: boolean
}

export function DronaLogo({ className = '', variant = 'light', compact = false }: DronaLogoProps) {
  const isDark = variant === 'dark'

  if (compact) {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <DronaLogoMark size="sm" />
        <div className="leading-tight">
          <span className={`block font-black tracking-tight text-sm ${isDark ? 'text-white' : 'text-[#0B2148]'}`}>
            DRONA
          </span>
          <span className="block text-[9px] font-bold tracking-widest text-[#08B6D8] uppercase">
            ENTERPRISES
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <DronaLogoMark size="lg" />
      <div className="leading-none">
        <span className={`block font-black text-xl tracking-tight ${isDark ? 'text-white' : 'text-[#0B2148]'}`}>
          DRONA
        </span>
        <span className="block text-[10px] font-extrabold tracking-[0.2em] text-[#08B6D8] uppercase mt-1">
          ENTERPRISES
        </span>
      </div>
    </div>
  )
}
