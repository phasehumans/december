import React, { useState } from 'react'
import {
    Monitor,
    Smartphone,
    Tablet,
    Download,
    Github,
    Globe,
    RefreshCw,
    ArrowUpRight,
    ChevronRight,
    ChevronLeft,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/components/ui/Button'
import { motion, AnimatePresence } from 'framer-motion'
import type { OutputHeaderProps } from '@/features/preview/types'

export const OutputHeader: React.FC<OutputHeaderProps> = ({
    activeTab,
    setActiveTab,
    device,
    setDevice,
    isSidebarCollapsed,
    onToggleSidebar,
    onOpenNewTab,
    onBack,
}) => {
    const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState(false)

    return (
        <header className="h-12 flex items-center justify-between px-3 bg-[#1F1F1F] backdrop-blur-sm shrink-0 z-10">
            {/* Left: View Mode Toggles */}
            <div className="flex items-center gap-2">
                {/* Mobile Back Button */}
                <button
                    onClick={onBack}
                    className="md:hidden p-1.5 text-[#91908F] hover:text-white mr-2"
                >
                    <ChevronLeft size={20} />
                </button>

                {/* Desktop Sidebar Toggle */}
                <div className="hidden md:block">
                    {isSidebarCollapsed && (
                        <button
                            onClick={onToggleSidebar}
                            className="p-1.5 text-[#91908F] hover:text-white hover:bg-white/5 rounded-md mr-1"
                            title="Open Sidebar"
                        >
                            <ChevronRight size={18} />
                        </button>
                    )}
                </div>

                {/* Desktop: Preview/Code/Canvas Tabs */}
                <div className="hidden md:flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab('preview')}
                        className={cn(
                            'flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all border',
                            activeTab === 'preview'
                                ? 'bg-[#27272A] text-white border-white/10'
                                : 'text-[#91908F] border-transparent hover:text-white hover:bg-white/5'
                        )}
                    >
                        Preview
                    </button>
                    <button
                        onClick={() => setActiveTab('code')}
                        className={cn(
                            'flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all border',
                            activeTab === 'code'
                                ? 'bg-[#27272A] text-white border-white/10'
                                : 'text-[#91908F] border-transparent hover:text-white hover:bg-white/5'
                        )}
                    >
                        Code
                    </button>
                    <button
                        onClick={() => setActiveTab('canvas')}
                        className={cn(
                            'flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all border',
                            activeTab === 'canvas'
                                ? 'bg-[#27272A] text-white border-white/10'
                                : 'text-[#91908F] border-transparent hover:text-white hover:bg-white/5'
                        )}
                    >
                        Canvas
                    </button>
                </div>
            </div>

            {/* Center: Device URL Bar & Mobile Toggle */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                {/* Mobile: Chat/Preview Toggle */}
                <div className="md:hidden flex items-center bg-[#27272A] rounded-full p-1 border border-white/5">
                    <button
                        onClick={() => {
                            if (isSidebarCollapsed) onToggleSidebar()
                        }}
                        className={cn(
                            'px-4 py-1.5 rounded-full text-xs font-medium transition-all',
                            !isSidebarCollapsed
                                ? 'bg-[#3F3F46] text-white shadow-sm'
                                : 'text-[#91908F] hover:text-white'
                        )}
                    >
                        Chat
                    </button>
                    <button
                        onClick={() => {
                            if (!isSidebarCollapsed) onToggleSidebar()
                        }}
                        className={cn(
                            'px-4 py-1.5 rounded-full text-xs font-medium transition-all',
                            isSidebarCollapsed
                                ? 'bg-[#3F3F46] text-white shadow-sm'
                                : 'text-[#91908F] hover:text-white'
                        )}
                    >
                        Preview
                    </button>
                </div>

                {/* Desktop URL Bar */}
                <div className="hidden md:flex items-center bg-[#1C1C1C] rounded-lg border border-white/5 h-9 px-1.5 relative group focus-within:border-white/20 transition-colors min-w-[320px]">
                    <div className="relative">
                        <button
                            onClick={() => setIsDeviceMenuOpen(!isDeviceMenuOpen)}
                            className="flex items-center gap-2 px-1.5 h-7 rounded hover:bg-white/5 text-[#91908F] hover:text-white transition-colors"
                        >
                            {device === 'desktop' && <Monitor size={14} />}
                            {device === 'mobile' && <Smartphone size={14} />}
                            {device === 'tablet' && <Tablet size={14} />}
                        </button>

                        <AnimatePresence>
                            {isDeviceMenuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 5 }}
                                    className="absolute top-full left-0 mt-2 w-48 bg-[#1C1C1C] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 p-1"
                                >
                                    <button
                                        onClick={() => {
                                            setDevice('desktop')
                                            setIsDeviceMenuOpen(false)
                                        }}
                                        className="flex items-center gap-3 w-full px-3 py-2 text-sm text-[#D6D5D4] hover:bg-white/5 rounded-lg transition-colors"
                                    >
                                        <Monitor size={14} />
                                        <span>Current screen size</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDevice('mobile')
                                            setIsDeviceMenuOpen(false)
                                        }}
                                        className="flex items-center gap-3 w-full px-3 py-2 text-sm text-[#D6D5D4] hover:bg-white/5 rounded-lg transition-colors"
                                    >
                                        <Smartphone size={14} />
                                        <span>Mobile</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDevice('tablet')
                                            setIsDeviceMenuOpen(false)
                                        }}
                                        className="flex items-center gap-3 w-full px-3 py-2 text-sm text-[#D6D5D4] hover:bg-white/5 rounded-lg transition-colors"
                                    >
                                        <Tablet size={14} />
                                        <span>Tablet</span>
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="text-[#525150] select-none mx-2 text-lg font-light">/</div>

                    <div className="flex-1 text-sm text-[#91908F] truncate font-mono opacity-60 text-center">
                        {/* sample text here local host */}
                    </div>

                    <div className="flex items-center gap-1 pl-2">
                        <button className="p-1.5 text-[#91908F] hover:text-white hover:bg-white/5 rounded transition-colors">
                            <RefreshCw size={12} />
                        </button>
                        <button
                            onClick={onOpenNewTab}
                            className="p-1.5 text-[#91908F] hover:text-white hover:bg-white/5 rounded transition-colors"
                            title="Open in new tab"
                        >
                            <ArrowUpRight size={12} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        title="Download Code"
                        className="text-[#91908F] hover:text-white hidden md:flex"
                    >
                        <Download size={16} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        title="Sync to GitHub"
                        className="text-[#91908F] hover:text-white hidden md:flex"
                    >
                        <Github size={16} />
                    </Button>

                    <Button
                        variant="primary"
                        size="sm"
                        className="ml-1 shadow-lg shadow-white/5 bg-white hover:bg-neutral-200 text-black border-none rounded-xl font-semibold hidden md:flex"
                    >
                        <Globe size={14} className="mr-2" />
                        Publish
                    </Button>
                </div>
            </div>
        </header>
    )
}


