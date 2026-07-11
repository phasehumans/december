import { PREVIEW_HTML } from '@/features/preview/constants/preview'

export const previewBridgeStyle = `
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

    /* Custom scrollbar styling to match code workspace/scrollbar */
    ::-webkit-scrollbar {
        width: 4px;
        height: 4px;
    }
    ::-webkit-scrollbar-thumb {
        background-color: rgba(56, 55, 54, 0.6);
        border-radius: 9999px;
    }
    ::-webkit-scrollbar-thumb:hover {
        background-color: rgba(74, 73, 72, 0.8);
    }
    ::-webkit-scrollbar-track {
        background-color: transparent;
    }
</style>`

export const previewBridgeScript = `
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

export const withDocumentShell = (html: string) => {
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

export const injectPreviewBridge = (html: string) => {
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

export const RUNTIME_CHECKLISTS = {
    generated: [
        { state: 'WaitingForRunnableVersion', label: 'Initializing sandbox container' },
        { state: 'Bootstrapping', label: 'Generating structure and writing files' },
        { state: 'Installing', label: 'Resolving and installing dependencies' },
        { state: 'Starting', label: 'Starting live development server' },
    ],
    github: [
        { state: 'WaitingForRunnableVersion', label: 'Connecting to remote repository' },
        { state: 'Bootstrapping', label: 'Cloning repository and mapping workspace structure' },
        { state: 'Installing', label: 'Installing project dependencies' },
        { state: 'Starting', label: 'Booting environment' },
    ],
    zip: [
        { state: 'WaitingForRunnableVersion', label: 'Uploading and extracting archive' },
        { state: 'Bootstrapping', label: 'Verifying files and mapping workspace structure' },
        { state: 'Installing', label: 'Installing project dependencies' },
        { state: 'Starting', label: 'Booting environment' },
    ],
}
