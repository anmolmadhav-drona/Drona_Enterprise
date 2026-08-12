'use client'

import React from 'react'

type DronaLogoMarkProps = {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function DronaLogoMark({ className = '', size = 'md' }: DronaLogoMarkProps) {
  const sizeMap = {
    sm: 'h-8 w-8',
    md: 'h-9 w-9',
    lg: 'h-11 w-11',
  }

  const svgMap = {
    sm: 'w-6 h-6',
    md: 'w-7 h-7',
    lg: 'w-8 h-8',
  }

  return (
    <div className={`relative ${sizeMap[size]} rounded-xl bg-white p-1 shadow-md flex items-center justify-center border border-slate-200/80 ${className}`}>
      <svg className={svgMap[size]} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="drona-mark-gradient-comp" x1="10" y1="90" x2="90" y2="10" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0B2148" />
            <stop offset="45%" stopColor="#102B63" />
            <stop offset="80%" stopColor="#08B6D8" />
            <stop offset="100%" stopColor="#16C4E8" />
          </linearGradient>
        </defs>

        <g stroke="url(#drona-mark-gradient-comp)" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 22 15 L 22 85 L 55 85 C 75 85 88 72 88 50 C 88 28 75 15 55 15 Z" strokeWidth="3.5" fill="none" />
          <path d="M 22 15 L 42 35 L 22 50 L 45 65 L 22 85" strokeWidth="1.8" opacity="0.85" />
          <path d="M 42 35 L 62 20 L 55 15" strokeWidth="1.8" opacity="0.85" />
          <path d="M 62 20 L 78 35 L 88 50 L 75 68 L 55 85" strokeWidth="1.8" opacity="0.85" />
          <path d="M 42 35 L 55 50 L 78 35" strokeWidth="1.8" opacity="0.85" />
          <path d="M 22 50 L 55 50 L 45 65 L 65 78 L 55 85" strokeWidth="1.8" opacity="0.85" />
          <path d="M 55 50 L 75 68" strokeWidth="1.8" opacity="0.85" />
          <path d="M 26 70 L 42 42 L 55 58 L 78 26" stroke="url(#drona-mark-gradient-comp)" strokeWidth="4.5" fill="none" />
        </g>

        <g fill="#08B6D8">
          <circle cx="22" cy="15" r="3" fill="#0B2148" />
          <circle cx="22" cy="50" r="3" fill="#0B2148" />
          <circle cx="22" cy="85" r="3" fill="#0B2148" />
          <circle cx="42" cy="35" r="3" fill="#102B63" />
          <circle cx="62" cy="20" r="3" fill="#08B6D8" />
          <circle cx="78" cy="35" r="3.5" fill="#16C4E8" />
          <circle cx="88" cy="50" r="3" fill="#08B6D8" />
          <circle cx="75" cy="68" r="3" fill="#08B6D8" />
          <circle cx="55" cy="85" r="3" fill="#102B63" />
          <circle cx="45" cy="65" r="3" fill="#102B63" />
          <circle cx="55" cy="50" r="3.5" fill="#08B6D8" />
          <circle cx="65" cy="78" r="3" fill="#08B6D8" />
          <circle cx="26" cy="70" r="3.5" fill="#0B2148" />
          <circle cx="42" cy="42" r="3.5" fill="#102B63" />
          <circle cx="55" cy="58" r="3.5" fill="#08B6D8" />
          <circle cx="78" cy="26" r="4" fill="#16C4E8" />
        </g>
      </svg>
    </div>
  )
}
