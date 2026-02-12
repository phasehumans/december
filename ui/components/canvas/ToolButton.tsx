import React from 'react'
import { cn } from '@/lib/utils'

interface ToolButtonProps {
  icon: any
  label: string
  onClick: () => void
  active?: boolean
}

export const ToolButton: React.FC<ToolButtonProps> = ({
  icon: Icon,
  label,
  onClick,
  active,
}) => (
  <button
    onClick={onClick}
    className={cn(
      'group relative p-2.5 rounded-xl transition-all duration-200 border border-transparent',
      active
        ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]'
        : 'text-neutral-400 hover:text-white hover:bg-white/10 hover:border-white/5'
    )}
    title={label}
  >
    <Icon size={18} strokeWidth={2} />
  </button>
)
