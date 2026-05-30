import { motion } from 'framer-motion'
import React, { useEffect, useState } from 'react'

import type { PreviewAreaProps } from '@/features/preview/types'
import { DotmSquare15 } from '@/components/ui/dotm-square-15'

import { PREVIEW_HTML } from '@/features/preview/constants/preview'
import { cn } from '@/shared/lib/utils'

const previewBridgeStyle = `
<style>
    html[data-december-visual="true"] body {
        cursor: crosshair;
    }

    .december-hover-highlight {
        outline: 2px solid rgba(255, 255, 255, 0.22) !important;
        outline-offset: 2px !important;
    }

    .december-selected-highlight {
        outline: 2px solid #ffffff !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.12) !important;
    }
</style>`

const previewBridgeScript = `
<script>
(() => {
    if (window.__DECEMBER_PREVIEW__) {
        return;
    }

    window.__DECEMBER_PREVIEW__ = true;

    let isVisualMode = false;
    let hoveredElement = null;
    let selectedElement = null;

    const clearHover = () => {
        if (hoveredElement) {
            hoveredElement.classList.remove('december-hover-highlight');
            hoveredElement = null;
        }
    };

    const clearSelection = (notifyParent = true) => {
        if (selectedElement) {
            selectedElement.classList.remove('december-selected-highlight');
            selectedElement = null;
        }

        if (notifyParent) {
            window.parent.postMessage({ type: 'selection-cleared' }, '*');
        }
    };

    const isSelectableTarget = (target) => {
        return target instanceof HTMLElement;
    };

    window.addEventListener('message', (event) => {
        if (event.data?.type === 'toggle-visual-mode') {
            isVisualMode = Boolean(event.data.isActive);
            document.documentElement.setAttribute(
                'data-december-visual',
                isVisualMode ? 'true' : 'false'
            );

            if (!isVisualMode) {
                clearHover();
                clearSelection();
            }
        }

        if (event.data?.type === 'selection-cleared') {
            clearHover();
            clearSelection(false);
        }
    });

    window.addEventListener('error', (event) => {
        window.parent.postMessage(
            {
                type: 'runtime-error',
                message: event.message || 'Runtime error',
                stack: event.error?.stack || null,
            },
            '*'
        );
    });

    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        const message =
            reason instanceof Error
                ? reason.message
                : typeof reason === 'string'
                  ? reason
                  : 'Unhandled promise rejection';

        window.parent.postMessage(
            {
                type: 'runtime-error',
                message,
                stack: reason instanceof Error ? reason.stack || null : null,
            },
            '*'
        );
    });

    document.addEventListener(
        'mouseover',
        (event) => {
            if (!isVisualMode || !isSelectableTarget(event.target)) {
                return;
            }

            if (hoveredElement === event.target) {
                return;
            }

            clearHover();
            hoveredElement = event.target;
            hoveredElement.classList.add('december-hover-highlight');
        },
        true
    );

    document.addEventListener(
        'mouseout',
        (event) => {
            if (!isVisualMode || hoveredElement !== event.target) {
                return;
            }

            clearHover();
        },
        true
    );

    document.addEventListener(
        'click',
        (event) => {
            if (!isVisualMode || !isSelectableTarget(event.target)) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            clearSelection(false);
            selectedElement = event.target;
            selectedElement.classList.add('december-selected-highlight');

            window.parent.postMessage(
                {
                    type: 'element-selected',
                    tagName: selectedElement.tagName.toLowerCase(),
                    textContent: (selectedElement.innerText || selectedElement.textContent || '')
                        .trim()
                        .slice(0, 160),
                },
                '*'
            );
        },
        true
    );
})();
</script>`

const withDocumentShell = (html: string) => {
    const trimmed = html.trim()

    if (!trimmed) {
        return PREVIEW_HTML
    }

    if (!/<html[\s>]/i.test(trimmed)) {
        return `<!DOCTYPE html><html><head></head><body>${trimmed}</body></html>`
    }

    if (!/<head[\s>]/i.test(trimmed)) {
        return trimmed.replace(/<html([^>]*)>/i, '<html$1><head></head>')
    }

    return trimmed
}

const injectPreviewBridge = (html: string) => {
    let documentHtml = withDocumentShell(html)

    if (!/<body[\s>]/i.test(documentHtml)) {
        documentHtml = documentHtml.replace(/<\/head>/i, '</head><body></body>')
    }

    if (!/<meta[^>]+name=["']viewport["'][^>]*>/i.test(documentHtml)) {
        documentHtml = documentHtml.replace(
            /<head([^>]*)>/i,
            '<head$1><meta name="viewport" content="width=device-width, initial-scale=1" />'
        )
    }

    if (!documentHtml.includes('window.__DECEMBER_PREVIEW__')) {
        documentHtml = documentHtml.replace(
            /<\/head>/i,
            `${previewBridgeStyle}${previewBridgeScript}</head>`
        )
    }

    return documentHtml
}

const RUNTIME_CHECKLISTS = {
    generated: [
        { state: 'WaitingForRunnableVersion', label: 'Initializing sandbox container' },
        { state: 'Bootstrapping', label: 'Creating structure and files' },
        { state: 'Installing', label: 'Installing project dependencies' },
        { state: 'Starting', label: 'Starting live preview server' },
    ],
    github: [
        { state: 'WaitingForRunnableVersion', label: 'Connecting to GitHub repository' },
        { state: 'Bootstrapping', label: 'Downloading codebase sources' },
        { state: 'Installing', label: 'Resolving and installing npm packages' },
        { state: 'Starting', label: 'Launching Vite development runtime' },
    ],
    zip: [
        { state: 'WaitingForRunnableVersion', label: 'Uploading and extracting ZIP archive' },
        { state: 'Bootstrapping', label: 'Verifying structure and manifest' },
        { state: 'Installing', label: 'Installing workspace dependencies' },
        { state: 'Starting', label: 'Launching live development runtime' },
    ],
}

export const PreviewArea: React.FC<PreviewAreaProps> = ({
    html,
    isGenerating,
    device,
    isVisualMode,
    onMessage,
    iframeRef,
    fullscreen = false,
    showStructureOnly = false,
    previewUrl,
    previewState,
    previewError,
    previewSessionError,
    projectType = 'generated',
}) => {
    useEffect(() => {
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
    }, [onMessage])

    const [isCopied, setIsCopied] = useState(false)
    const srcDoc = React.useMemo(() => injectPreviewBridge(html), [html])
    const isLivePreview = Boolean(previewUrl)
    const showStructurePlaceholder = showStructureOnly && !isGenerating && !isLivePreview

    // Determine loading state
    const showFullscreenLoader =
        !isLivePreview &&
        (isGenerating ||
            previewState === 'WaitingForRunnableVersion' ||
            previewState === 'Bootstrapping' ||
            previewState === 'Installing' ||
            previewState === 'Starting')

    const showFailedState = Boolean(
        previewSessionError || previewError || previewState === 'Failed'
    )
    const showFullscreenFailed = showFailedState && !isLivePreview && !showFullscreenLoader

    // Resolve checklist items
    const checklistItems = RUNTIME_CHECKLISTS[projectType] || RUNTIME_CHECKLISTS.generated
    const stateKeys = ['WaitingForRunnableVersion', 'Bootstrapping', 'Installing', 'Starting']
    const activeIndex = previewState ? stateKeys.indexOf(previewState) : 0

    const statusLabel = previewError?.message || previewSessionError || 'Compiling...'

    const copyErrorToClipboard = () => {
        const errorText = `${previewError?.message ?? ''}\n${previewError?.detail ?? ''}\n${previewSessionError ?? ''}`
        void navigator.clipboard.writeText(errorText)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
    }

    return (
        <div
            className={cn(
                'overflow-hidden relative bg-[#171615]',
                fullscreen
                    ? 'h-full w-full min-h-0'
                    : 'flex-1 flex items-center justify-center p-0.5 pb-2'
            )}
        >
            {!fullscreen && (
                <div
                    className="absolute inset-0 z-0 opacity-20 pointer-events-none"
                    style={{
                        backgroundImage: 'radial-gradient(#333 1px, transparent 1px)',
                        backgroundSize: '20px 20px',
                    }}
                />
            )}

            <div
                className={cn(
                    'relative transition-all duration-500 bg-[#171615] shadow-2xl overflow-hidden group w-full h-full',
                    fullscreen
                        ? 'rounded-2xl border border-white/10'
                        : device === 'mobile'
                          ? 'w-[375px] h-[812px] rounded-[3rem] border-[8px] border-[#1a1a1a]'
                          : device === 'tablet'
                            ? 'w-[768px] h-[1024px] rounded-[2rem] border-[8px] border-[#1a1a1a]'
                            : 'rounded-xl border border-[#262626] shadow-2xl'
                )}
            >
                {/* 1. Dynamic Checklist Logs Loader Screen (Screenshot 5) */}
                {showFullscreenLoader ? (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#171615] font-sans">
                        <div className="flex flex-col items-start gap-5 max-w-sm w-full px-8 text-left select-none">
                            {/* Dot Matrix Center Glow Indicator */}
                            <div className="flex items-center gap-3.5 mb-2 w-full justify-start">
                                <DotmSquare15
                                    size={32}
                                    dotSize={3.2}
                                    speed={1.2}
                                    bloom
                                    pattern="prism-sweep"
                                    colorPreset="white"
                                />
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[12.5px] font-bold text-[#E6E4E3] tracking-wide uppercase">
                                        Runtime sandbox
                                    </span>
                                    <span className="text-[9.5px] text-[#8E8D8C] font-medium tracking-widest uppercase animate-pulse">
                                        Establishing container
                                    </span>
                                </div>
                            </div>

                            {/* Checklist Steps */}
                            <div className="space-y-4 w-full border-t border-white/5 pt-4">
                                {checklistItems.map((item, index) => {
                                    const isDone = index < activeIndex
                                    const isActive = index === activeIndex
                                    const isQueued = index > activeIndex

                                    return (
                                        <div
                                            key={item.label}
                                            className={cn(
                                                'flex items-center gap-3 transition-colors duration-300',
                                                isQueued ? 'opacity-30' : 'opacity-100'
                                            )}
                                        >
                                            {isDone ? (
                                                <span className="text-[#8E8D8C] text-[11px] font-medium shrink-0 w-4 text-center select-none">
                                                    ✓
                                                </span>
                                            ) : isActive ? (
                                                <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                                                </div>
                                            ) : (
                                                <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                                                    <span className="h-1 w-1 rounded-full bg-[#3E3D3C]" />
                                                </div>
                                            )}
                                            <span
                                                className={cn(
                                                    'text-[12px] font-medium tracking-wide',
                                                    isDone
                                                        ? 'text-[#8E8D8C] line-through decoration-[#3E3D3C]/40'
                                                        : isActive
                                                          ? 'text-[#E6E4E3] font-bold'
                                                          : 'text-[#5A5958]'
                                                )}
                                            >
                                                {item.label}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                ) : showStructurePlaceholder ? (
                    /* 2. Structure Placeholder */
                    <div className="absolute inset-0 z-40 bg-[#171716] p-5">
                        <div className="h-full w-full rounded-xl border border-white/10 bg-[#171615] p-4 md:p-5 flex flex-col gap-3">
                            <div className="h-8 w-40 rounded-md bg-white/10" />
                            <div className="h-3 w-72 rounded-md bg-white/5 max-w-full" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                <div className="h-28 rounded-lg border border-white/10 bg-white/[0.03]" />
                                <div className="h-28 rounded-lg border border-white/10 bg-white/[0.03]" />
                            </div>
                            <div className="h-24 rounded-lg border border-white/10 bg-white/[0.03]" />
                            <div className="mt-auto h-10 rounded-md bg-white/[0.04]" />
                        </div>
                    </div>
                ) : (
                    /* 3. Main IFrame browser viewport (kept visible even on errors) */
                    <iframe
                        ref={iframeRef}
                        className={cn(
                            'w-full h-full border-0 transition-opacity bg-white',
                            isVisualMode ? 'cursor-crosshair' : ''
                        )}
                        title="Preview"
                        {...(previewUrl ? { src: previewUrl } : { srcDoc })}
                    />
                )}

                {/* 4. Minimal floating error pill */}
                {showFailedState && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-red-50 border border-red-200/60 rounded-lg px-3.5 py-2 shadow-sm animate-in slide-in-from-bottom-2 duration-300 font-sans">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                        <span className="text-[11px] font-medium text-red-700 whitespace-nowrap">
                            Build failed
                        </span>
                        <button
                            onClick={() => window.location.reload()}
                            type="button"
                            className="text-[10px] font-medium text-red-500 hover:text-red-700 transition-colors cursor-pointer select-none ml-1"
                        >
                            Retry
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
