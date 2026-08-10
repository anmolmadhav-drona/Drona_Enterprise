'use client'

import { Loader2 } from 'lucide-react'

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <div className="text-sm">{label}</div>
    </div>
  )
}

export function EmptyState({ title, desc, icon }: { title: string; desc?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground border border-dashed rounded-lg">
      {icon}
      <div className="text-sm font-medium text-foreground">{title}</div>
      {desc && <div className="text-xs max-w-sm text-center">{desc}</div>}
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2 text-destructive border border-destructive/30 rounded-lg bg-destructive/5">
      <div className="text-sm font-medium">Failed to load</div>
      <div className="text-xs">{message}</div>
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
