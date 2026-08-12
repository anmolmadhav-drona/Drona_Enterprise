'use client'

import React from 'react'

export function DronaNetworkPattern({ className = '', opacity = 0.08 }: { className?: string; opacity?: number }) {
  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`} style={{ opacity }}>
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <defs>
          <pattern id="drona-grid-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#08B6D8" strokeWidth="0.8" strokeDasharray="2,4" />
            <circle cx="0" cy="0" r="1.5" fill="#08B6D8" />
            <circle cx="60" cy="0" r="1.5" fill="#08B6D8" />
            <circle cx="0" cy="60" r="1.5" fill="#08B6D8" />
            <circle cx="60" cy="60" r="1.5" fill="#08B6D8" />
          </pattern>
          <linearGradient id="network-fade" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0B2148" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#08B6D8" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#102B63" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        <rect width="100%" height="100%" fill="url(#drona-grid-pattern)" />
        
        {/* Geometric Network Connectors */}
        <g stroke="url(#network-fade)" strokeWidth="1.5" fill="none">
          <path d="M 100 150 Q 250 80 400 200 T 700 100" className="animate-network-pulse" />
          <path d="M 200 450 Q 500 300 800 500" strokeDasharray="6,6" />
          <path d="M 50 600 L 300 400 L 550 550 L 850 350" />
        </g>

        {/* Nodes */}
        <g fill="#08B6D8">
          <circle cx="250" cy="115" r="4" />
          <circle cx="400" cy="200" r="5" />
          <circle cx="700" cy="100" r="4" />
          <circle cx="300" cy="400" r="4" />
          <circle cx="550" cy="550" r="5" fill="#16C4E8" />
        </g>
      </svg>
    </div>
  )
}
