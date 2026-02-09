import React from 'react';
import { cn } from '@/lib/utils';

interface SidebarItemProps {
    icon: any;
    label: string;
    active?: boolean;
    collapsed?: boolean;
    onClick?: () => void;
    badge?: string;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({ 
    icon: Icon, 
    label, 
    active = false, 
    collapsed = false,
    onClick,
    badge
}) => (
    <button 
        onClick={onClick}
        className={cn(
            "flex items-center w-full p-2 rounded-lg text-sm font-medium transition-all duration-200 group relative outline-none focus-visible:ring-2 focus-visible:ring-white/20",
            active 
                ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/5" 
                : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5 border border-transparent",
            collapsed ? "justify-center" : ""
        )}
    >
        <Icon size={18} strokeWidth={1.5} className={cn("shrink-0 transition-colors", active ? "text-white" : "text-neutral-500 group-hover:text-neutral-300")} />
        
        <div className={cn(
            "flex items-center overflow-hidden transition-all duration-300 ease-in-out",
            !collapsed ? "w-full opacity-100 ml-3" : "w-0 opacity-0 ml-0"
        )}>
             <span className="truncate tracking-wide whitespace-nowrap font-medium">{label}</span>
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
);