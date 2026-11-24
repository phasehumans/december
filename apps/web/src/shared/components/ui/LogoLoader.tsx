import React, { useLayoutEffect, useRef } from 'react'

import { Icons } from './Icons'

// Full-screen pulsing logo. Used for every app loading screen so they all look the same.
// It matches the startup loader in index.html: same size, colour and pulse. Both pin their
// pulse to the page's time origin, so when one loader replaces the other the pulse
// carries on instead of starting again.
export const LogoLoader: React.FC = () => {
    const logoRef = useRef<HTMLDivElement>(null)

    useLayoutEffect(() => {
        try {
            logoRef.current?.getAnimations({ subtree: true }).forEach((animation) => {
                animation.startTime = 0
            })
        } catch {
            // Intentionally swallowed: older browsers without getAnimations still pulse, only unsynced
        }
    }, [])

    return (
        <div
            ref={logoRef}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#141414] select-none"
        >
            <Icons.DecemberLogo
                className="w-12 h-12 text-[#3A3A3A] animate-logo-pulse"
                strokeWidth={1.2}
            />
        </div>
    )
}
