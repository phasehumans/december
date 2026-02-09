import React, { useState } from 'react';
import { 
    Home, 
    PanelLeftClose, 
    PanelLeftOpen, 
    Settings, 
    MessageSquarePlus,
    Clock,
    Star,
    LayoutGrid,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';
import { SidebarItem } from './sidebar/SidebarItem';
import { SidebarGroup } from './sidebar/SidebarGroup';
import { Button } from '@/components/ui/Button';

interface SidebarProps {
    onLogout: () => void;
    isCollapsed: boolean;
    toggleCollapse: () => void;
    currentView: string;
    onNavigate: (view: 'home' | 'projects' | 'docs' | 'settings') => void;
    onNewProject: () => void;
}

const SidebarSection = ({ children }: { children?: React.ReactNode }) => (
    <div className="mb-4 space-y-0.5">
        {children}
    </div>
);

export const Sidebar: React.FC<SidebarProps> = ({ 
    onLogout, 
    isCollapsed, 
    toggleCollapse, 
    currentView,
    onNavigate,
    onNewProject
}) => {
  const [isRecentOpen, setIsRecentOpen] = useState(true);
  const [isStarredOpen, setIsStarredOpen] = useState(true);

  return (
    <aside 
        className={cn(
            "fixed left-0 top-0 bottom-0 border-r border-white/5 bg-black/50 backdrop-blur-xl z-40 flex flex-col pt-4 pb-6 px-3 shadow-[5px_0_30px_rgba(0,0,0,0.5)] transition-[width] duration-300 ease-in-out",
            isCollapsed ? "w-[70px]" : "w-[260px]"
        )}
    >
        {/* Toggle Collapse & Logo */}
        <div className={cn("mb-8 flex items-center min-h-[44px] transition-all duration-300 ease-in-out", isCollapsed ? "justify-center" : "justify-between px-2")}>
             
             <div className={cn(
                 "overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out flex items-center",
                 isCollapsed ? "w-0 opacity-0 -translate-x-4" : "w-auto opacity-100 translate-x-0"
             )}>
                <Logo className="scale-90 origin-left" />
             </div>

             <Button
                variant="ghost"
                size="icon"
                onClick={toggleCollapse}
                className="text-neutral-400"
             >
                {isCollapsed ? <PanelLeftOpen size={18} strokeWidth={1.5} /> : <PanelLeftClose size={18} strokeWidth={1.5} />}
             </Button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <SidebarSection>
                <SidebarItem 
                    icon={Home} 
                    label="Home" 
                    active={currentView === 'home' || currentView === 'output'} 
                    collapsed={isCollapsed} 
                    onClick={() => onNavigate('home')}
                />
                <SidebarItem 
                    icon={MessageSquarePlus} 
                    label="New Project" 
                    collapsed={isCollapsed} 
                    onClick={onNewProject}
                />
            </SidebarSection>
            
            <SidebarSection>
                 {/* Recent Group */}
                 <SidebarGroup 
                    icon={Clock} 
                    label="Recent" 
                    isOpen={isRecentOpen} 
                    onToggle={() => setIsRecentOpen(!isRecentOpen)}
                    isCollapsed={isCollapsed}
                 >
                    <div className="text-[13px] text-neutral-600 font-medium py-1 truncate cursor-default select-none pl-2">
                        No recent projects
                    </div>
                 </SidebarGroup>

                 {/* Starred Group */}
                 <SidebarGroup 
                    icon={Star} 
                    label="Starred" 
                    isOpen={isStarredOpen} 
                    onToggle={() => setIsStarredOpen(!isStarredOpen)}
                    isCollapsed={isCollapsed}
                 >
                    <div className="text-[13px] text-neutral-600 font-medium py-1 truncate cursor-default select-none pl-2">
                        No starred projects
                    </div>
                 </SidebarGroup>

                 {/* All Projects */}
                 <SidebarItem 
                    icon={LayoutGrid} 
                    label="All projects" 
                    active={currentView === 'projects'}
                    collapsed={isCollapsed} 
                    onClick={() => onNavigate('projects')}
                />
            </SidebarSection>
        </div>

        {/* Footer Actions */}
        <div className="mt-auto pt-4 border-t border-white/5 space-y-1">
            <SidebarItem 
                icon={Settings} 
                label="Settings" 
                active={currentView === 'settings'}
                collapsed={isCollapsed} 
                onClick={() => onNavigate('settings')} 
            />
        </div>
    </aside>
  );
};