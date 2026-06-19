import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import { appName, gitConfig } from './shared'
import { Github, Twitter, Youtube } from 'lucide-react'
import React from 'react'

export function baseOptions(): BaseLayoutProps {
    return {
        nav: {
            title: (
                <div className="flex items-center gap-2 select-none pointer-events-none">
                    <img src="/logo.png" alt="December Logo" className="w-5 h-5 object-contain" />
                    <span className="font-semibold text-sm tracking-tight text-white">
                        December Docs
                    </span>
                </div>
            ),
        },
        links: [
            {
                icon: <Github className="h-4 w-4" />,
                text: 'GitHub',
                url: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
                external: true,
            },
            {
                icon: <Twitter className="h-4 w-4" />,
                text: 'X',
                url: 'https://x.com/december',
                external: true,
            },
            {
                icon: <Youtube className="h-4 w-4" />,
                text: 'YouTube',
                url: 'https://youtube.com/december',
                external: true,
            },
        ],
    }
}
