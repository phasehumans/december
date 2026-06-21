'use client'

import { useSearchContext } from 'fumadocs-ui/contexts/search'
import { Search } from 'lucide-react'
import React from 'react'

import { gitConfig } from '@/lib/shared'

const XLogo = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
    </svg>
)

const Github = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02a9.56 9.56 0 0 1 2.5-.34c.85.04 1.7.15 2.5.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"></path>
    </svg>
)

export function HeaderActions() {
    const { setOpenSearch, enabled } = useSearchContext()

    return (
        <div className="flex items-center gap-4 ml-auto pointer-events-auto">
            {enabled && (
                <button
                    onClick={() => setOpenSearch(true)}
                    className="flex items-center gap-2 px-3 h-[32px] rounded-lg bg-[#252422] border border-[#333333] hover:bg-[#2f2e2d] text-[#8F8E8D] hover:text-[#CCCBCA] transition-colors cursor-pointer text-xs font-medium focus:outline-none focus:ring-0 active:outline-none"
                    aria-label="Search"
                >
                    <Search className="w-3.5 h-3.5" />
                    <span>Search</span>
                    <kbd className="text-[10px] bg-[#171615] border border-[#333333] px-1.5 py-0.5 rounded text-[#8F8E8D] font-mono leading-none">
                        ⌘K
                    </kbd>
                </button>
            )}
            <div className="flex items-center gap-1.5 border-l border-white/5 pl-3.5 h-[20px]">
                <a
                    href="https://x.com/phasehumans"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#8F8E8D] hover:text-[#CCCBCA] transition-colors flex items-center justify-center p-1"
                    aria-label="X (Twitter)"
                >
                    <XLogo className="w-[15px] h-[15px]" />
                </a>
                <a
                    href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#8F8E8D] hover:text-[#CCCBCA] transition-colors flex items-center justify-center p-1"
                    aria-label="GitHub"
                >
                    <Github className="w-[18px] h-[18px]" />
                </a>
            </div>
        </div>
    )
}
