import React, { useState } from 'react'
import { Monitor, Smartphone, Tablet, RefreshCw, ArrowUpRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import type { PreviewDevice } from '@/features/preview/types'

interface OutputHeaderDevicePickerProps {
    device: PreviewDevice
    setDevice: (device: PreviewDevice) => void
    onOpenNewTab: () => void
}

export const OutputHeaderDevicePicker: React.FC<OutputHeaderDevicePickerProps> = ({
    device,
    setDevice,
    onOpenNewTab,
}) => {
    const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState(false)

    return (
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
            <div className="flex-1 text-sm text-[#91908F] truncate font-mono opacity-60 text-center"></div>

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
    )
}
