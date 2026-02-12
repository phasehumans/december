import React from 'react'
import { cn } from '@/lib/utils'

interface IntegrationCardProps {
  icon: any
  name: string
  description: string
  connected: boolean
  username?: string
  colorClass?: string
}

export const IntegrationCard: React.FC<IntegrationCardProps> = ({
  icon: Icon,
  name,
  description,
  connected,
  username,
  colorClass,
}) => (
  <div className="flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-[#09090b] hover:border-white/10 transition-all hover:bg-[#0c0c0e] group">
    <div className="flex items-center gap-4">
      <div
        className={cn(
          'p-2.5 rounded-xl border transition-colors flex items-center justify-center w-10 h-10',
          colorClass
            ? colorClass
            : connected
              ? 'bg-white text-black border-white'
              : 'bg-white/5 text-neutral-400 border-white/5 group-hover:text-white'
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h4 className="text-sm font-medium text-white flex items-center gap-2">
          {name}
          {connected && username && (
            <span className="text-[10px] font-normal text-neutral-500 bg-white/5 px-1.5 py-0.5 rounded">
              @{username}
            </span>
          )}
        </h4>
        <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
      </div>
    </div>
    <button
      className={cn(
        'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border',
        connected
          ? 'bg-white/5 text-neutral-400 border-white/5 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
          : 'bg-white text-black border-white hover:bg-neutral-200'
      )}
    >
      {connected ? 'Connected' : 'Connect'}
    </button>
  </div>
)
