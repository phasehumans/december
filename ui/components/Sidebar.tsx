import React from 'react'
import {
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  History,
  BookOpen,
  PlusCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from './Logo'

interface SidebarProps {
  onLogout: () => void
  isCollapsed: boolean
  toggleCollapse: () => void
  currentView: string
  onNavigate: (view: 'home' | 'history' | 'docs' | 'settings') => void
  onNewProject: () => void
}

const SidebarItem = ({
  icon: Icon,
  label,
  active = false,
  collapsed = false,
  onClick,
  badge,
}: {
  icon: any
  label: string
  active?: boolean
  collapsed?: boolean
  onClick?: () => void
  badge?: string
}) => (
  <button
    onClick={onClick}
    className={cn(
      'flex items-center w-full p-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative outline-none focus-visible:ring-2 focus-visible:ring-white/20',
      active
        ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/5'
        : 'text-neutral-500 hover:text-neutral-200 hover:bg-white/5 border border-transparent',
      collapsed ? 'justify-center' : ''
    )}
  >
    <Icon
      size={18}
      strokeWidth={2}
      className={cn(
        'shrink-0 transition-colors',
        active ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-300'
      )}
    />

    <div
      className={cn(
        'flex items-center overflow-hidden transition-all duration-300 ease-in-out',
        !collapsed ? 'w-full opacity-100 ml-3' : 'w-0 opacity-0 ml-0'
      )}
    >
      <span className="truncate tracking-wide whitespace-nowrap">{label}</span>
      {badge && (
        <span className="ml-auto text-[10px] bg-white/10 text-neutral-300 px-1.5 py-0.5 rounded-md font-mono">
          {badge}
        </span>
      )}
    </div>

    {collapsed && (
      <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#0A0A0A] border border-white/10 rounded-lg text-xs font-medium text-white opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl translate-x-2 group-hover:translate-x-0 transition-all delay-100">
        {label}
      </div>
    )}
  </button>
)

const SidebarSection = ({
  title,
  children,
  collapsed,
}: {
  title: string
  children?: React.ReactNode
  collapsed: boolean
}) => (
  <div className="mb-6">
    <div
      className={cn(
        'px-3 mb-2 text-[10px] font-bold text-neutral-600 uppercase tracking-widest font-mono overflow-hidden transition-all duration-300 ease-in-out whitespace-nowrap',
        collapsed ? 'h-0 opacity-0 mb-0' : 'h-4 opacity-100'
      )}
    >
      {title}
    </div>
    <div className="space-y-1">{children}</div>
  </div>
)

export const Sidebar: React.FC<SidebarProps> = ({
  onLogout,
  isCollapsed,
  toggleCollapse,
  currentView,
  onNavigate,
  onNewProject,
}) => {
  return (
    <aside
      className={cn(
        'fixed left-0 top-0 bottom-0 border-r border-white/5 bg-black/50 backdrop-blur-xl z-40 flex flex-col pt-4 pb-6 px-3 shadow-[5px_0_30px_rgba(0,0,0,0.5)] transition-[width] duration-300 ease-in-out',
        isCollapsed ? 'w-[70px]' : 'w-[260px]'
      )}
    >
      {/* Toggle Collapse & Logo */}
      <div
        className={cn(
          'mb-6 flex items-center min-h-[44px] transition-all duration-300 ease-in-out',
          isCollapsed ? 'justify-center' : 'justify-between px-2'
        )}
      >
        <div
          className={cn(
            'overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out flex items-center',
            isCollapsed
              ? 'w-0 opacity-0 -translate-x-4'
              : 'w-auto opacity-100 translate-x-0'
          )}
        >
          <Logo className="scale-90 origin-left" />
        </div>

        <button
          onClick={toggleCollapse}
          className="p-2 text-neutral-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 outline-none focus-visible:ring-2 focus-visible:ring-white/20"
        >
          {isCollapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <SidebarSection title="Menu" collapsed={isCollapsed}>
          <SidebarItem
            icon={Home}
            label="Home"
            active={currentView === 'home' || currentView === 'output'}
            collapsed={isCollapsed}
            onClick={() => onNavigate('home')}
          />
          <SidebarItem
            icon={PlusCircle}
            label="New Project"
            collapsed={isCollapsed}
            onClick={onNewProject}
          />
          <SidebarItem
            icon={History}
            label="History"
            active={currentView === 'history'}
            collapsed={isCollapsed}
            onClick={() => onNavigate('history')}
          />
        </SidebarSection>
      </div>

      {/* Footer Actions */}
      <div className="mt-auto pt-4 border-t border-white/5 space-y-2">
        <div className="px-1">
          <SidebarItem
            icon={Settings}
            label="Settings"
            active={currentView === 'settings'}
            collapsed={isCollapsed}
            onClick={() => onNavigate('settings')}
          />
        </div>
      </div>
    </aside>
  )
}
