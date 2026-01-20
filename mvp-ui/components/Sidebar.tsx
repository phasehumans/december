import React, { useState } from 'react';
import { 
    Home, 
    PanelLeftClose, 
    PanelLeftOpen, 
    Settings, 
    User, 
    History,
    Star,
    BookOpen,
    PlusCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarProps {
    onLogout: () => void;
    isCollapsed: boolean;
    toggleCollapse: () => void;
}

const SidebarItem = ({ 
    icon: Icon, 
    label, 
    active = false, 
    collapsed = false,
    onClick,
    badge
}: { 
    icon: any, 
    label: string, 
    active?: boolean, 
    collapsed?: boolean,
    onClick?: () => void,
    badge?: string
}) => (
    <button 
        onClick={onClick}
        className={cn(
            "flex items-center gap-3 w-full p-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
            active 
                ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/5" 
                : "text-neutral-500 hover:text-neutral-200 hover:bg-white/5 border border-transparent",
            collapsed ? "justify-center px-2" : "px-3"
        )}
    >
        <Icon size={18} strokeWidth={2} className={cn("shrink-0 transition-colors", active ? "text-white" : "text-neutral-500 group-hover:text-neutral-300")} />
        
        {!collapsed && (
            <span className="truncate tracking-wide">{label}</span>
        )}

        {!collapsed && badge && (
            <span className="ml-auto text-[10px] bg-white/10 text-neutral-300 px-1.5 py-0.5 rounded-md font-mono">
                {badge}
            </span>
        )}
        
        {collapsed && (
            <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#0A0A0A] border border-white/10 rounded-lg text-xs font-medium text-white opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl translate-x-2 group-hover:translate-x-0 transition-all">
                {label}
            </div>
        )}
    </button>
);

const SidebarSection = ({ title, children, collapsed }: { title: string, children?: React.ReactNode, collapsed: boolean }) => (
    <div className="mb-6">
        {!collapsed && (
            <div className="px-3 mb-2 text-[10px] font-bold text-neutral-600 uppercase tracking-widest font-mono">
                {title}
            </div>
        )}
        <div className="space-y-1">
            {children}
        </div>
    </div>
);

export const Sidebar: React.FC<SidebarProps> = ({ onLogout, isCollapsed, toggleCollapse }) => {
  return (
    <motion.aside 
        initial={false}
        animate={{ width: isCollapsed ? 70 : 260 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed left-0 top-0 bottom-0 border-r border-white/5 bg-black/50 backdrop-blur-xl z-40 flex flex-col pt-4 pb-6 px-3 shadow-[5px_0_30px_rgba(0,0,0,0.5)]"
    >
        {/* Toggle Collapse */}
        <div className={cn("mb-6 flex items-center min-h-[44px]", isCollapsed ? "justify-center" : "justify-end px-2")}>
             <button 
                onClick={toggleCollapse}
                className={cn(
                    "p-2 text-neutral-400 hover:text-white transition-colors rounded-lg hover:bg-white/5",
                )}
             >
                {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
             </button>
        </div>

        {/* Navigation - Added no-scrollbar utility classes */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <SidebarSection title="Menu" collapsed={isCollapsed}>
                <SidebarItem icon={Home} label="Home" active collapsed={isCollapsed} />
                <SidebarItem icon={PlusCircle} label="New Project" collapsed={isCollapsed} />
                <SidebarItem icon={History} label="History" collapsed={isCollapsed} />
            </SidebarSection>
            
            <SidebarSection title="Library" collapsed={isCollapsed}>
                <SidebarItem icon={Star} label="Favorites" collapsed={isCollapsed} />
                <SidebarItem icon={BookOpen} label="Docs" collapsed={isCollapsed} />
            </SidebarSection>

            <SidebarSection title="Settings" collapsed={isCollapsed}>
                <SidebarItem icon={Settings} label="Settings" collapsed={isCollapsed} />
            </SidebarSection>
        </div>

        {/* Footer Actions */}
        <div className="mt-auto pt-4 border-t border-white/5 space-y-2">
            <div className="px-1">
                <SidebarItem icon={User} label="Profile" collapsed={isCollapsed} onClick={onLogout} />
            </div>
        </div>
    </motion.aside>
  );
};