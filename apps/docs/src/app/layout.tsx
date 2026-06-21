import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { RootProvider } from 'fumadocs-ui/provider/next'

import { source } from '@/lib/source'
import { baseOptions } from '@/lib/layout.shared'

import './global.css'
import { Inter } from 'next/font/google'

import type { Metadata } from 'next'
import type { ReactNode } from 'react'

const inter = Inter({
    subsets: ['latin'],
})

export const metadata: Metadata = {
    title: {
        default: 'December Docs',
        template: '%s - December Docs',
    },
    description: 'Documentation for December platform and CLI.',
    icons: {
        icon: '/favicon.png',
    },
}

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" className={inter.className} suppressHydrationWarning>
            <body className="flex flex-col min-h-screen">
                <RootProvider theme={{ defaultTheme: 'dark', enableSystem: false }}>
                    <DocsLayout
                        tree={source.getPageTree()}
                        {...baseOptions()}
                        slots={{
                            searchTrigger: false,
                        }}
                        disableThemeSwitch={true}
                    >
                        {children}
                    </DocsLayout>
                </RootProvider>
            </body>
        </html>
    )
}
