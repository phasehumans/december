import { Globe, Laptop, Eye, RefreshCw } from 'lucide-react'
import React from 'react'

import { DocCallout, DocCard, DocPagination } from '../DocsUI'

import type { DocTab } from '../../types'

interface DocsSectionProps {
    onNavigate?: (tab: DocTab) => void
}

export const DocsPreviews: React.FC<DocsSectionProps> = ({ onNavigate }) => {
    return (
        <div className="flex flex-col w-full max-w-[820px] text-[#D6D5C9]">
            {/* Header */}
            <div className="flex flex-col mb-8">
                <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Globe className="w-3 h-3" />
                        Web Environment
                    </span>
                    <span className="text-[12px] text-[#71717A]">Hot Module Reloading</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-[#EDEDEF] tracking-tight mb-2">
                    Live Previews &amp; Dev Servers
                </h1>
                <p className="text-[14.5px] sm:text-[15px] text-[#9A9998] leading-relaxed">
                    Test your application in real time with interactive split-screen browser
                    previews, zero-config dev server orchestration, and streaming console telemetry.
                </p>
            </div>

            <div className="flex flex-col gap-8 border-t border-[#242323] pt-6">
                {/* 1. Zero-Config Detection */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Zero-Config Framework Detection
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        When an agent task involves running an application, December inspects the{' '}
                        <code className="text-[#EDEDEF] font-mono text-[12px]">package.json</code>{' '}
                        or configuration files and boots the corresponding dev server automatically:
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-1 text-[13px]">
                        <div className="p-3 rounded-lg border border-[#242323] bg-[#141414] text-center font-mono text-[#EDEDEF]">
                            Next.js
                        </div>
                        <div className="p-3 rounded-lg border border-[#242323] bg-[#141414] text-center font-mono text-[#EDEDEF]">
                            Vite / React
                        </div>
                        <div className="p-3 rounded-lg border border-[#242323] bg-[#141414] text-center font-mono text-[#EDEDEF]">
                            Bun / Node.js
                        </div>
                        <div className="p-3 rounded-lg border border-[#242323] bg-[#141414] text-center font-mono text-[#EDEDEF]">
                            FastAPI / Python
                        </div>
                    </div>
                </section>

                {/* 2. Split-Screen Features */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Split-Screen Preview Workspace
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        The web workspace couples the chat and code editor directly to a live
                        sandboxed browser frame:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <DocCard
                            icon={Eye}
                            title="Interactive DOM"
                            description="Click, scroll, fill inputs, and trigger frontend state changes inside the live application iframe."
                        />
                        <DocCard
                            icon={RefreshCw}
                            title="Instant HMR"
                            description="Hot module replacement reflects agent edits in the browser preview within milliseconds without full reloads."
                        />
                        <DocCard
                            icon={Laptop}
                            title="Responsive Modes"
                            description="Toggle between Desktop (1280px), Tablet (768px), and Mobile (375px) viewports to test layout responsiveness."
                        />
                    </div>
                </section>

                {/* 3. Streaming Console Telemetry */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Console Telemetry &amp; Error Capturing
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        Developer console logs, uncaught exceptions, and HTTP network errors are
                        captured directly from the preview frame and forwarded into the agent&apos;s
                        reasoning loop. If a frontend component crashes on render, December detects
                        the stack trace and patches the bug automatically.
                    </p>

                    <DocCallout type="tip" title="Sharing Live Previews">
                        Need feedback from teammates? Use the &quot;Share Preview&quot; button in
                        the top-right of the preview pane to generate a secure, temporary preview
                        URL that teammates can access on any device.
                    </DocCallout>
                </section>

                {/* Pagination */}
                {onNavigate && <DocPagination currentTab="Live Previews" onNavigate={onNavigate} />}
            </div>
        </div>
    )
}
