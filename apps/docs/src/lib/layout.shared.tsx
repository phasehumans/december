import React from 'react'

import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'

import { HeaderActions } from '@/components/HeaderActions'

const DecemberLogo = (props: React.SVGProps<SVGSVGElement>) => {
    const { stroke, ...otherProps } = props || {}
    return (
        <svg
            viewBox="5 4 14 16"
            fill="none"
            stroke={stroke || 'currentColor'}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...otherProps}
        >
            <defs>
                <linearGradient id="december-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FF7A00" />
                    <stop offset="50%" stopColor="#FF007A" />
                    <stop offset="100%" stopColor="#7F00FF" />
                </linearGradient>
            </defs>
            {/* Arm up */}
            <line x1="12" y1="12" x2="12" y2="5.3" />
            <line x1="12" y1="7.5" x2="13.9" y2="6.4" />
            <line x1="12" y1="7.5" x2="10.1" y2="6.4" />
            {/* Arm upper-right */}
            <line x1="12" y1="12" x2="17.8" y2="8.65" />
            <line x1="15.9" y1="9.75" x2="17.8" y2="10.85" />
            <line x1="15.9" y1="9.75" x2="15.9" y2="7.55" />
            {/* Arm lower-right */}
            <line x1="12" y1="12" x2="17.8" y2="15.35" />
            <line x1="15.9" y1="14.25" x2="15.9" y2="16.45" />
            <line x1="15.9" y1="14.25" x2="17.8" y2="13.15" />
            {/* Arm down */}
            <line x1="12" y1="12" x2="12" y2="18.7" />
            <line x1="12" y1="16.5" x2="10.1" y2="17.6" />
            <line x1="12" y1="16.5" x2="13.9" y2="17.6" />
            {/* Arm lower-left */}
            <line x1="12" y1="12" x2="6.2" y2="15.35" />
            <line x1="8.1" y1="14.25" x2="6.2" y2="13.15" />
            <line x1="8.1" y1="14.25" x2="8.1" y2="16.45" />
            {/* Arm upper-left */}
            <line x1="12" y1="12" x2="6.2" y2="8.65" />
            <line x1="8.1" y1="9.75" x2="8.1" y2="7.55" />
            <line x1="8.1" y1="9.75" x2="6.2" y2="10.85" />
        </svg>
    )
}

export function baseOptions(): BaseLayoutProps {
    return {
        nav: {
            title: (
                <div className="flex items-center gap-2 select-none group/logo">
                    <div className="transition-all flex items-center justify-center text-white">
                        <DecemberLogo className="w-[18px] h-[18px]" />
                    </div>
                    <span className="font-medium text-[14px] tracking-wide transition-colors text-white">
                        December
                    </span>
                </div>
            ),
            children: <HeaderActions />,
        },
        links: [],
    }
}
