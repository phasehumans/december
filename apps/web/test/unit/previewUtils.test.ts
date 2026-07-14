import { describe, it, expect } from 'bun:test'

import { PREVIEW_HTML } from '@/features/preview/constants/preview'
import { withDocumentShell, injectPreviewBridge } from '@/features/preview/utils/previewUtils'

describe('previewUtils', () => {
    describe('withDocumentShell', () => {
        it('returns PREVIEW_HTML if empty', () => {
            expect(withDocumentShell('')).toBe(PREVIEW_HTML)
            expect(withDocumentShell('   ')).toBe(PREVIEW_HTML)
        })

        it('wraps HTML snippet without html tag', () => {
            const result = withDocumentShell('<div>Hello</div>')
            expect(result).toBe(
                '<!DOCTYPE html><html><head></head><body><div>Hello</div></body></html>'
            )
        })

        it('adds head if missing', () => {
            const result = withDocumentShell('<html><body>Hello</body></html>')
            expect(result).toBe('<html><head></head><body>Hello</body></html>')
        })

        it('returns as is if it has html and head', () => {
            const html = '<html><head><title>Test</title></head><body>Hello</body></html>'
            expect(withDocumentShell(html)).toBe(html)
        })
    })

    describe('injectPreviewBridge', () => {
        it('injects style and script into head', () => {
            const html = '<div>Hello</div>'
            const result = injectPreviewBridge(html)

            expect(result).toContain('<!DOCTYPE html>')
            expect(result).toContain(
                '<head><meta name="viewport" content="width=device-width, initial-scale=1" />'
            )
            expect(result).toContain('window.__DECEMBER_PREVIEW__ = true;')
            expect(result).toContain('<style>')
            expect(result).toContain('</head>')
        })

        it('does not inject twice if already present', () => {
            const html =
                '<html><head><script>window.__DECEMBER_PREVIEW__ = true;</script></head><body>Hello</body></html>'
            const result = injectPreviewBridge(html)

            // Should add viewport but not the script again
            expect(result).toContain('<meta name="viewport"')
            // Style shouldn't be added since window.__DECEMBER_PREVIEW__ is present
            expect(result).not.toContain('.december-hover-highlight')
        })

        it('adds body if missing', () => {
            const html = '<html><head></head></html>'
            const result = injectPreviewBridge(html)

            expect(result).toContain('<body></body>')
        })
    })
})
