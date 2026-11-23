import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import React, { useState } from 'react'

import { Icons } from '@/shared/components/ui/Icons'

interface HomeHeaderProps {
    isAuthenticated?: boolean
    onOpenAuth?: () => void
}

const MagneticIconWithTooltip = ({ icon: Icon, tooltip, onClick, href }: any) => {
    const [isHovered, setIsHovered] = useState(false)
    const x = useMotionValue(0)
    const y = useMotionValue(0)

    const springConfig = { damping: 15, stiffness: 150, mass: 0.1 }
    const springX = useSpring(x, springConfig)
    const springY = useSpring(y, springConfig)

    const handleMouseMove = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        x.set((e.clientX - centerX) * 0.3)
        y.set((e.clientY - centerY) * 0.3)
    }

    const handleMouseLeave = () => {
        setIsHovered(false)
        x.set(0)
        y.set(0)
    }

    const Component = href ? motion.a : motion.button

    return (
        <div className="relative flex items-center justify-center z-20">
            <Component
                href={href}
                target={href ? '_blank' : undefined}
                rel={href ? 'noopener noreferrer' : undefined}
                onClick={onClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{ x: springX, y: springY }}
                whileTap={{ scale: 0.9 }}
                className="text-textMuted hover:text-textMain hover:bg-[#252525] rounded-full transition-colors flex items-center justify-center w-7 h-7 cursor-pointer outline-none relative z-10"
            >
                {Icon}
            </Component>

            <AnimatePresence>
                {isHovered && (
                    <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 2, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                        className="absolute top-[calc(100%+8px)] right-0 z-50 flex items-center gap-1.5 bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg pointer-events-none whitespace-nowrap shadow-lg shadow-black/40"
                    >
                        <span className="text-[12px] font-medium text-[#EDEDEF]">{tooltip}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// the docs site, for signed-in and signed-out visitors alike
const DOCS_URL = 'https://trydecember.com/docs/'

export const HomeHeader: React.FC<HomeHeaderProps> = () => {
    return (
        <div className="absolute top-0 left-0 w-full h-11 px-4 md:px-6 z-50 flex justify-between items-center pointer-events-none">
            <div className="flex-1 pointer-events-auto flex items-center justify-start pl-2 md:pl-0">
                <a
                    href={DOCS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden md:flex items-center gap-1 h-7 px-2.5 rounded-full bg-[#1F1F1F] hover:bg-[#252525] text-[12px] transition-all font-medium text-[#999999] hover:text-[#E8E8E8]"
                >
                    <span>Docs</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
            </div>

            {/* right icons (desktop only, phones use the mobile top bar) */}
            <div className="hidden md:flex flex-1 items-center justify-end pointer-events-auto">
                <div className="flex items-center gap-0">
                    <MagneticIconWithTooltip
                        icon={<Icons.Github className="w-5 h-5" />}
                        tooltip="GitHub"
                        href="https://github.com/phasehumans"
                    />
                </div>
            </div>
        </div>
    )
}
