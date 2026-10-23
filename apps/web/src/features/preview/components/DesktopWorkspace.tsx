import {
    AlertTriangle,
    Check,
    ChevronDown,
    Copy,
    ExternalLink,
    Globe,
    Monitor,
    RotateCw,
} from 'lucide-react'
import React, { useEffect, useState } from 'react'

import { useAppStore } from '@/app/store'
import { sessionAPI } from '@/features/sessions/api/session'
import { Tooltip } from '@/shared/components/ui/Tooltip'
import { cn } from '@/shared/lib/utils'

export interface DesktopWorkspaceProps {
    sessionId?: string
    previewUrl?: string | null
    previewState?: string | null
    previewError?: any | null
    previewSessionError?: string | null
    isGenerating?: boolean
    projectType?: string
    projectId?: string
    iframeRef?: React.RefObject<HTMLIFrameElement | null>
    onMessage?: (e: MessageEvent) => void
    fullscreen?: boolean
}

export const DesktopWorkspace: React.FC<DesktopWorkspaceProps> = ({
    sessionId,
    previewUrl,
    previewState,
    previewError,
    previewSessionError,
    isGenerating,
    projectId,
    iframeRef,
}) => {
    const effectiveSessionId = sessionId || projectId
    const desktopViewport = useAppStore((state) => state.desktopViewport)
    const setDesktopViewport = useAppStore((state) => state.setDesktopViewport)

    const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false)
    const [diagnosticsTab, setDiagnosticsTab] = useState<'console' | 'network'>('console')
    const [copied, setCopied] = useState(false)
    const [viewMode, setViewMode] = useState<'screenshot' | 'preview'>('screenshot')

    useEffect(() => {
        if (!effectiveSessionId) return

        let isSubscribed = true
        sessionAPI
            .getSessionDesktopViewport(effectiveSessionId)
            .then((viewport) => {
                if (isSubscribed && viewport) {
                    setDesktopViewport(viewport)
                }
            })
            .catch(() => {
                // Intentionally swallowed: Initial viewport fetch fallback handled
            })

        return () => {
            isSubscribed = false
        }
    }, [effectiveSessionId, setDesktopViewport])

    const hasScreenshot = Boolean(desktopViewport?.screenshot)
    const hasPreviewUrl = Boolean(previewUrl)
    const activeUrl = desktopViewport?.url || previewUrl || 'about:blank'

    const consoleErrors = desktopViewport?.consoleErrors || []
    const networkErrors = desktopViewport?.networkErrors || []
    const totalErrors = consoleErrors.length + networkErrors.length

    const handleCopyUrl = async () => {
        if (!activeUrl || activeUrl === 'about:blank') return
        try {
            await navigator.clipboard.writeText(activeUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // Intentionally swallowed: Clipboard copy fallback handled
        }
    }

    const handleOpenInNewTab = () => {
        const target = previewUrl || (activeUrl !== 'about:blank' ? activeUrl : null)
        if (target) {
            window.open(target, '_blank', 'noopener,noreferrer')
        }
    }

    const handleRefresh = () => {
        if (iframeRef?.current && previewUrl) {
            iframeRef.current.src = previewUrl
        }
    }

    return (
        <div
            data-testid="desktop-workspace"
            className="flex-1 flex flex-col w-full h-full min-h-0 bg-[#141414] text-[#EDEDEF] select-none font-sans overflow-hidden"
        >
            {/* 1. Desktop Browser Chrome Bar */}
            <div className="h-10 px-3 bg-[#181818] border-b border-[#242323] flex items-center justify-between shrink-0 gap-3 z-20">
                {/* Left: Mode Badge */}
                <div className="flex items-center gap-2 shrink-0">
                    {hasScreenshot ? (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                            <span>Browser Automation</span>
                        </div>
                    ) : hasPreviewUrl ? (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[11px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                            <span>Live Preview</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[#91908F] text-[11px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#91908F] shrink-0" />
                            <span>Desktop Sandbox</span>
                        </div>
                    )}

                    {desktopViewport?.action && (
                        <span className="hidden sm:inline-block text-[10.5px] text-[#A1A1AA] bg-[#222225] px-1.5 py-0.5 rounded font-mono">
                            {desktopViewport.action}
                        </span>
                    )}
                </div>

                {/* Center: Address Bar */}
                <div className="flex-1 max-w-xl mx-auto flex items-center bg-[#111111] border border-[#2B2A2A] rounded-md px-2.5 py-1 text-[12px] text-[#D4D4D8] font-mono shadow-inner overflow-hidden">
                    <Globe className="w-3.5 h-3.5 text-[#71717A] mr-2 shrink-0" />
                    <span data-testid="desktop-address-bar" className="truncate flex-1 select-text">
                        {activeUrl}
                    </span>
                    {activeUrl !== 'about:blank' && (
                        <button
                            type="button"
                            onClick={handleCopyUrl}
                            className="ml-2 text-[#71717A] hover:text-white transition-colors cursor-pointer"
                            title="Copy URL"
                        >
                            {copied ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                                <Copy className="w-3 h-3" />
                            )}
                        </button>
                    )}
                </div>

                {/* Right: Actions & Error Pill */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {totalErrors > 0 && (
                        <button
                            type="button"
                            onClick={() => setIsDiagnosticsOpen((prev) => !prev)}
                            className={cn(
                                'flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer',
                                isDiagnosticsOpen
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                            )}
                            title="Toggle Console and Network Diagnostics"
                        >
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>{totalErrors} error(s)</span>
                        </button>
                    )}

                    {hasScreenshot && hasPreviewUrl && (
                        <div className="flex items-center bg-[#222225] p-0.5 rounded text-[11px]">
                            <button
                                type="button"
                                onClick={() => setViewMode('screenshot')}
                                className={cn(
                                    'px-2 py-0.5 rounded font-medium transition-colors cursor-pointer',
                                    viewMode === 'screenshot'
                                        ? 'bg-[#333338] text-white'
                                        : 'text-[#8E8D8C] hover:text-white'
                                )}
                            >
                                Screenshot
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('preview')}
                                className={cn(
                                    'px-2 py-0.5 rounded font-medium transition-colors cursor-pointer',
                                    viewMode === 'preview'
                                        ? 'bg-[#333338] text-white'
                                        : 'text-[#8E8D8C] hover:text-white'
                                )}
                            >
                                Live
                            </button>
                        </div>
                    )}

                    <Tooltip content="Refresh View" position="bottom" align="end">
                        <button
                            type="button"
                            onClick={handleRefresh}
                            className="p-1.5 text-[#91908F] hover:text-white rounded hover:bg-white/5 transition-colors cursor-pointer"
                        >
                            <RotateCw className="w-3.5 h-3.5" />
                        </button>
                    </Tooltip>

                    {(previewUrl || activeUrl !== 'about:blank') && (
                        <Tooltip content="Open in new tab" position="bottom" align="end">
                            <button
                                type="button"
                                onClick={handleOpenInNewTab}
                                className="p-1.5 text-[#91908F] hover:text-white rounded hover:bg-white/5 transition-colors cursor-pointer"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                        </Tooltip>
                    )}
                </div>
            </div>

            {/* 2. Main Viewport Area */}
            <div className="flex-1 relative min-h-0 bg-[#0E0E0E] flex flex-col items-center justify-center overflow-auto p-4">
                {hasScreenshot && (viewMode === 'screenshot' || !hasPreviewUrl) ? (
                    /* Captured Browser Screenshot Viewport */
                    <div className="relative max-w-full max-h-full flex flex-col items-center justify-center">
                        <div className="relative border border-[#2B2A2D] rounded-lg shadow-2xl overflow-hidden bg-black max-w-full">
                            <img
                                data-testid="desktop-screenshot-image"
                                src={desktopViewport!.screenshot}
                                alt="Browser Viewport Screenshot"
                                className="max-w-full h-auto max-h-[calc(100vh-160px)] object-contain block select-none"
                            />
                            {desktopViewport?.title && (
                                <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm px-2.5 py-1 rounded text-[11px] text-[#D4D4D8] border border-white/10 font-mono">
                                    {desktopViewport.title}
                                </div>
                            )}
                        </div>
                    </div>
                ) : hasPreviewUrl ? (
                    /* Live Preview Iframe */
                    <iframe
                        ref={iframeRef}
                        data-testid="desktop-preview-iframe"
                        src={previewUrl!}
                        className="w-full h-full border-0 bg-white"
                        title="Desktop Preview"
                    />
                ) : (
                    /* Clean Headless Browser Desktop Placeholder */
                    <div
                        data-testid="desktop-empty-placeholder"
                        className="flex flex-col items-center justify-center text-center max-w-md p-6"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-[#1C1B1B] border border-[#2E2D2D] flex items-center justify-center text-[#A1A1AA] mb-4 shadow-sm">
                            <Monitor className="w-6 h-6 text-[#9CA3AF]" />
                        </div>
                        <h3 className="text-[15px] font-semibold text-[#F4F4F5] mb-1.5">
                            Headless Browser Automation
                        </h3>
                        <p className="text-[12.5px] text-[#8E8D8C] leading-relaxed mb-4">
                            The agent runs Playwright and headless Chromium in your isolated
                            sandbox. When the agent navigates pages, clicks buttons, types inputs,
                            or captures screenshots, live viewports and logs will appear here.
                        </p>
                        <div className="flex items-center gap-2 text-[11.5px] text-[#71717A] bg-[#161616] border border-[#242424] px-3 py-1.5 rounded-md font-mono">
                            <span>Ready for browser actions</span>
                        </div>
                    </div>
                )}
            </div>

            {/* 3. Collapsible Diagnostics Panel (Console & Network Logs) */}
            {totalErrors > 0 && isDiagnosticsOpen && (
                <div
                    data-testid="desktop-diagnostics-drawer"
                    className="h-48 border-t border-[#262626] bg-[#121212] flex flex-col shrink-0 animate-in slide-in-from-bottom-2 duration-200"
                >
                    <div className="h-8 px-3 bg-[#181818] border-b border-[#242323] flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => setDiagnosticsTab('console')}
                                className={cn(
                                    'font-medium transition-colors cursor-pointer',
                                    diagnosticsTab === 'console'
                                        ? 'text-red-400 border-b border-red-400 pb-0.5'
                                        : 'text-[#8E8D8C] hover:text-white'
                                )}
                            >
                                Console Errors ({consoleErrors.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setDiagnosticsTab('network')}
                                className={cn(
                                    'font-medium transition-colors cursor-pointer',
                                    diagnosticsTab === 'network'
                                        ? 'text-amber-400 border-b border-amber-400 pb-0.5'
                                        : 'text-[#8E8D8C] hover:text-white'
                                )}
                            >
                                Network Errors ({networkErrors.length})
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsDiagnosticsOpen(false)}
                            className="text-[#71717A] hover:text-white p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
                        >
                            <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] space-y-1.5 select-text">
                        {diagnosticsTab === 'console' ? (
                            consoleErrors.length > 0 ? (
                                consoleErrors.map((err, i) => (
                                    <div
                                        key={i}
                                        className="text-red-400 flex items-start gap-2 bg-red-500/5 px-2 py-1 rounded border border-red-500/10"
                                    >
                                        <span className="text-red-500 select-none shrink-0">•</span>
                                        <span className="break-all">{err}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="text-[#71717A] italic py-2">
                                    No console errors reported.
                                </div>
                            )
                        ) : networkErrors.length > 0 ? (
                            networkErrors.map((net, i) => (
                                <div
                                    key={i}
                                    className="text-amber-400 flex items-start gap-2 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10"
                                >
                                    <span className="text-amber-500 select-none shrink-0">•</span>
                                    <span className="break-all">{net}</span>
                                </div>
                            ))
                        ) : (
                            <div className="text-[#71717A] italic py-2">
                                No failed network requests reported.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
