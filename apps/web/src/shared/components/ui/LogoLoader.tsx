import React from 'react'

import { Icons } from './Icons'

// Full-screen pulsing logo. Used for every app loading screen so they all look the same.
export const LogoLoader: React.FC = () => (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#141414] select-none">
        <div className="flex items-center justify-center animate-pulse">
            <Icons.DecemberLogo
                className="w-10 h-10 md:w-12 md:h-12 text-[#3A3A3A]"
                strokeWidth={1.2}
            />
        </div>
    </div>
)
