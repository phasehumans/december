import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/shared/lib/utils'
import { PREVIEW_HTML } from '@/features/preview/constants/preview'
import type { PreviewAreaProps } from '@/features/preview/types'

const loaderDotDelays = [0, 0.14, 0.28]

const previewBridgeStyle = `
<style>
    html[data-phasehumans-visual="true"] body {
        cursor: crosshair;
    }

    .phasehumans-hover-highlight {
        outline: 2px solid rgba(255, 255, 255, 0.22) !important;
        outline-offset: 2px !important;
    }

    .phasehumans-selected-highlight {
        outline: 2px solid #ffffff !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.12) !important;
    }
</style>`

const previewBridgeScript = `
<script>
(() => {
    if (window.__PHASEHUMANS_PREVIEW__) {
        return;
    }

    window.__PHASEHUMANS_PREVIEW__ = true;

    let isVisualMode = false;
    let hoveredElement = null;
    let selectedElement = null;

    const clearHover = () => {
        if (hoveredElement) {
            hoveredElement.classList.remove('phasehumans-hover-highlight');
            hoveredElement = null;
        }
    };

    const clearSelection = (notifyParent = true) => {
        if (selectedElement) {
            selectedElement.classList.remove('phasehumans-selected-highlight');
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
                'data-phasehumans-visual',
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
            hoveredElement.classList.add('phasehumans-hover-highlight');
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
            selectedElement.classList.add('phasehumans-selected-highlight');

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

    if (!documentHtml.includes('window.__PHASEHUMANS_PREVIEW__')) {
        documentHtml = documentHtml.replace(
            /<\/head>/i,
            `${previewBridgeStyle}${previewBridgeScript}</head>`
        )
    }

    return documentHtml
}

const statusLabels = {
    WaitingForRunnableVersion: 'Waiting for the first runnable snapshot',
    Bootstrapping: 'Bootstrapping preview sandbox',
    Installing: 'Installing dependencies with bun',
    Starting: 'Starting the Vite dev server',
    Healthy: 'Live preview is ready',
    Rebuilding: 'Applying the latest manifest',
    Failed: 'Preview failed',
    Stopped: 'Preview stopped',
} as const

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
}) => {
    useEffect(() => {
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
    }, [onMessage])

    const srcDoc = React.useMemo(() => injectPreviewBridge(html), [html])
    const isLivePreview = Boolean(previewUrl)
    const showStructurePlaceholder = showStructureOnly && !isGenerating && !isLivePreview
    const showFullscreenLoader =
        !isLivePreview &&
        (isGenerating ||
            previewState === 'WaitingForRunnableVersion' ||
            previewState === 'Bootstrapping' ||
            previewState === 'Installing' ||
            previewState === 'Starting')
    const showInlineStatus = isLivePreview && previewState && previewState !== 'Healthy'
    const showFailedState = Boolean(previewSessionError || previewError || previewState === 'Failed')
    const statusLabel =
        previewError?.message ||
        previewSessionError ||
        (previewState ? statusLabels[previewState] : null) ||
        null

    return (
        <div
            className={cn(
                'overflow-hidden relative bg-[#1F1F1F]',
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
                    'relative transition-all duration-500 bg-white shadow-2xl overflow-hidden group',
                    fullscreen
                        ? 'w-full h-full rounded-2xl border border-white/10'
                        : device === 'mobile'
                          ? 'w-[375px] h-[812px] rounded-[3rem] border-[8px] border-[#1a1a1a]'
                          : device === 'tablet'
                            ? 'w-[768px] h-[1024px] rounded-[2rem] border-[8px] border-[#1a1a1a]'
                            : 'w-full h-full rounded-xl border border-[#262626] shadow-2xl'
                )}
            >
                {showFullscreenLoader ? (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#171615]">
                        <div className="flex flex-col items-center gap-4 text-center px-6">
                            <div className="flex items-center gap-2">
                                {loaderDotDelays.map((delay, index) => (
                                    <motion.span
                                        key={index}
                                        className="h-2 w-2 rounded-full bg-[#DCDCD9]"
                                        animate={{
                                            opacity: [0.35, 0.75, 0.35],
                                            scale: [0.98, 1.06, 0.98],
                                            y: [0, -1, 0],
                                        }}
                                        transition={{
                                            duration: 1.1,
                                            repeat: Infinity,
                                            ease: 'easeInOut',
                                            delay,
                                        }}
                                    />
                                ))}
                            </div>
                            <p className="text-sm text-[#DCDCD9]">{statusLabel ?? 'Preparing preview'}</p>
                        </div>
                    </div>
                ) : showStructurePlaceholder ? (
                    <div className="absolute inset-0 z-40 bg-[#171716] p-5">
                        <div className="h-full w-full rounded-xl border border-white/10 bg-[#1F1F1F] p-4 md:p-5 flex flex-col gap-3">
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

                {showInlineStatus && statusLabel && (
                    <div className="absolute left-4 top-4 z-40 rounded-full border border-black/10 bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur">
                        {statusLabel}
                    </div>
                )}

                {showFailedState && statusLabel && !showFullscreenLoader && (
                    <div className="absolute inset-x-4 bottom-4 z-40 rounded-2xl border border-[#FF8A8A]/30 bg-[#2A1212]/90 px-4 py-3 text-sm text-[#FFD7D7] shadow-xl backdrop-blur">
                        <div className="font-medium">Preview issue</div>
                        <div className="mt-1 text-[#F2C7C7]">{statusLabel}</div>
                    </div>
                )}
            </div>
        </div>
    )
}
