import React from 'react'

import { AuthModalBrand } from './AuthModalBrand'

import { cn } from '@/shared/lib/utils'

// the look of the sign-up page for the small pages around it (device sign-in, a failed
// GitHub sign-in): the logo, one line under it, then the controls. no heading.

interface AuthPageShellProps {
    line: React.ReactNode
    /** red for a page that reports a failure */
    tone?: 'grey' | 'red'
    children?: React.ReactNode
}

export const AuthPageShell: React.FC<AuthPageShellProps> = ({ line, tone = 'grey', children }) => (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#141414] font-sans overflow-y-auto p-6 selection:bg-[#87b2f4]/30 selection:text-white">
        <div className="w-full max-w-[340px] flex flex-col animate-in fade-in duration-200">
            <div className={cn('flex flex-col items-center text-center', children && 'mb-6')}>
                <AuthModalBrand />
                <p
                    role={tone === 'red' ? 'alert' : undefined}
                    className={cn(
                        'mt-3 font-sans text-xs sm:text-[13px] leading-relaxed',
                        tone === 'red' ? 'text-red-400' : 'text-[#888888]'
                    )}
                >
                    {line}
                </p>
            </div>
            {children}
        </div>
    </div>
)
