import React from 'react'
import { Icons } from './ui/Icons'

interface LogoProps {
    className?: string
    showText?: boolean
}

export const Logo = ({ className = '', showText = true }: LogoProps) => {
    return (
        <div className={`flex items-center select-none group cursor-pointer ${className}`}>
            {showText && (
                <div className="relative flex items-baseline">
                    {/* Phase: Monospace */}
                    <span className="font-mono text-xl font-medium text-[#D6D5D4] tracking-tight transition-colors duration-300">
                        phase
                    </span>

                    {/* Humans: Monospace */}
                    <span className="font-mono text-xl font-medium text-[#D6D5D4] tracking-tight ml-[1px]">
                        humans
                    </span>
                </div>
            )}
        </div>
    )
}

export default Logo
