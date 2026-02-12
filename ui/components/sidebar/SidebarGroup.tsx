import React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarGroupProps {
  icon: any
  label: string
  isOpen: boolean
  onToggle: () => void
  isCollapsed: boolean
  children?: React.ReactNode
}

export const SidebarGroup: React.FC<SidebarGroupProps> = ({
  icon: Icon,
  label,
  isOpen,
  onToggle,
  isCollapsed,
  children,
}) => {
  // When collapsed, show icon only (as a button that acts as a tooltip/indicator)
  if (isCollapsed) {
    return (
      <button className="flex items-center justify-center w-full p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors group relative">
        <Icon size={18} strokeWidth={1.5} />
        <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#0A0A0A] border border-white/10 rounded-lg text-xs font-medium text-white opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl translate-x-2 group-hover:translate-x-0 transition-all delay-100">
          {label}
        </div>
      </button>
    )
  }

  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="flex items-center w-full p-2 rounded-lg text-sm font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-all group select-none"
      >
        <Icon
          size={18}
          strokeWidth={1.5}
          className="shrink-0 mr-3 text-neutral-500 group-hover:text-neutral-300"
        />
        <span className="flex-1 text-left truncate">{label}</span>
        <div className="text-neutral-600 group-hover:text-neutral-400 transition-colors">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </button>

      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-in-out',
          isOpen ? 'max-h-[500px] opacity-100 mt-1 pb-2' : 'max-h-0 opacity-0'
        )}
      >
        <div className="relative pl-9 pr-2">
          {/* Vertical line connector */}
          <div className="absolute left-[26px] top-0 bottom-2 w-px bg-white/5" />
          {children}
        </div>
      </div>
    </div>
  )
}
