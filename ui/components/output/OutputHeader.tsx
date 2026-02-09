import React from 'react';
import { Eye, Code, Monitor, Smartphone, Download, Github, Globe, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

interface OutputHeaderProps {
    activeTab: 'preview' | 'code';
    setActiveTab: (tab: 'preview' | 'code') => void;
    device: 'desktop' | 'mobile';
    setDevice: (device: 'desktop' | 'mobile') => void;
    isSidebarCollapsed: boolean;
    onToggleSidebar: () => void;
}

export const OutputHeader: React.FC<OutputHeaderProps> = ({
    activeTab,
    setActiveTab,
    device,
    setDevice,
    isSidebarCollapsed,
    onToggleSidebar
}) => {
    return (
        <header className="h-14 flex items-center justify-between px-3 border-b border-white/5 bg-[#0A0A0A]/50 backdrop-blur-sm shrink-0 z-10">
            
            {/* Left: Sidebar Toggle & View Mode */}
            <div className="flex items-center gap-3">
                <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={onToggleSidebar}
                    className={cn(
                        isSidebarCollapsed && "text-white bg-white/5"
                    )}
                    title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    <PanelLeft size={18} />
                </Button>

                <div className="w-px h-4 bg-white/10" />

                <SegmentedControl 
                    value={activeTab}
                    onChange={setActiveTab}
                    options={[
                        { value: 'preview', label: 'Preview', icon: Eye },
                        { value: 'code', label: 'Code', icon: Code },
                    ]}
                />
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
                
                {/* Device Toggles */}
                <SegmentedControl 
                    value={device}
                    onChange={setDevice}
                    options={[
                        { value: 'desktop', icon: Monitor },
                        { value: 'mobile', icon: Smartphone },
                    ]}
                />

                <div className="w-px h-4 bg-white/10" />

                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" title="Download Code">
                        <Download size={16} />
                    </Button>
                    <Button variant="ghost" size="icon" title="Sync to GitHub">
                        <Github size={16} />
                    </Button>
                    
                    <Button 
                        variant="primary" 
                        size="sm"
                        className="ml-1 shadow-lg shadow-white/5"
                    >
                        <Globe size={14} className="mr-2" />
                        Publish
                    </Button>
                </div>
            </div>
        </header>
    );
};