'use client'

import React, { useState, useSyncExternalStore } from 'react'
import { DronaNetworkPattern } from './DronaNetworkPattern'
import { DronaLogoMark } from './DronaLogoMark'
import { ShieldCheck, Cpu, Network, TrendingUp } from 'lucide-react'

const subscribeToReducedMotion = (callback: () => void) => {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

  mediaQuery.addEventListener('change', callback)

  return () => {
    mediaQuery.removeEventListener('change', callback)
  }
}

const getReducedMotion = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const getServerReducedMotion = () => false

export function DronaVideoHero({ className = '' }: { className?: string }) {
  const [videoError, setVideoError] = useState(false)
  
  const prefersReducedMotion = useSyncExternalStore(
  subscribeToReducedMotion,
  getReducedMotion,
  getServerReducedMotion
)

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-[#08B6D8]/40 bg-[#0B2148] shadow-2xl drona-glow ${className}`}>
      <div className="relative aspect-video w-full flex items-center justify-center overflow-hidden">
        {!videoError && !prefersReducedMotion ? (
          <video
            src="/brand/drona-promo.mp4"
            poster="/brand/drona-promo-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setVideoError(true)}
            className="w-full h-full object-cover relative z-0"
          />
        ) : (
          /* Live Animated Network Video Background Fallback */
          <div className="absolute inset-0 bg-gradient-to-br from-[#0B2148] via-[#102B63] to-[#071426] z-0">
            <DronaNetworkPattern opacity={0.35} />
          </div>
        )}

        {/* Video Overlay Content */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B2148] via-[#0B2148]/30 to-transparent p-5 flex flex-col justify-between z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 bg-[#0B2148]/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <DronaLogoMark size="sm" />
              <span className="text-[11px] font-extrabold tracking-wider text-[#08B6D8] uppercase">Drona Operations Video</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold bg-[#08B6D8]/20 text-[#16C4E8] backdrop-blur px-2.5 py-1 rounded-full border border-[#08B6D8]/40">
              <ShieldCheck className="h-3 w-3 text-[#08B6D8]" /> Connected Ecosystem
            </div>
          </div>

          <div>
            <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[#08B6D8]" /> Connected Logistics & Operations
            </h3>
            <div className="flex items-center justify-between text-[10px] text-slate-300 border-t border-white/15 pt-2 mt-2">
              <span className="flex items-center gap-1 font-semibold text-[#08B6D8]">
                <Network className="h-3 w-3" /> Logistics Data Nodes
              </span>
              <span className="flex items-center gap-1 text-[#16C4E8] font-bold">
                <TrendingUp className="h-3 w-3" /> Profit Margin Intelligence
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
