import { describe, expect, it, mock } from 'bun:test'
import React from 'react'

import { FileViewMenu } from '../../src/components/menus/file-view-menu'
import { renderWithProviders } from '../test-providers'

describe('FileViewMenu Component (Unit)', () => {
    it('renders error message when file cannot be read', async () => {
        const handleClose = mock()
        const { lastFrame } = renderWithProviders(
            <FileViewMenu filePath="nonexistent-file-xyz.txt" onClose={handleClose} />
        )

        await new Promise((resolve) => setTimeout(resolve, 30))
        const frame = lastFrame()
        expect(frame).toContain('nonexistent-file-xyz.txt')
        expect(frame).toContain('Error:')
        expect(frame).toContain('dismiss')
    })

    it('renders file content with line numbers and header', async () => {
        const { lastFrame } = renderWithProviders(
            <FileViewMenu filePath="package.json" initialLine={1} />
        )

        await new Promise((resolve) => setTimeout(resolve, 50))
        const frame = lastFrame()

        expect(frame).toContain('package.json')
        expect(frame).toContain('lines')
        expect(frame).toContain('line 1')
        expect(frame).toContain('1 |')
        expect(frame).toContain('scroll')
        expect(frame).toContain('insert @file:line')
        expect(frame).toContain('dismiss')
        expect(frame).not.toContain('open in editor')
    })

    it('triggers onInsertContext on Enter key', async () => {
        const onInsertContext = mock()
        const onClose = mock()
        const { stdin } = renderWithProviders(
            <FileViewMenu
                filePath="package.json"
                initialLine={3}
                onInsertContext={onInsertContext}
                onClose={onClose}
            />
        )

        await new Promise((resolve) => setTimeout(resolve, 50))
        stdin.write('\r')
        expect(onInsertContext).toHaveBeenCalledTimes(1)
        expect(onInsertContext).toHaveBeenCalledWith('package.json', 3)
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('triggers onInsertContext on Tab key', async () => {
        const onInsertContext = mock()
        const onClose = mock()
        const { stdin } = renderWithProviders(
            <FileViewMenu
                filePath="package.json"
                initialLine={5}
                onInsertContext={onInsertContext}
                onClose={onClose}
            />
        )

        await new Promise((resolve) => setTimeout(resolve, 50))
        stdin.write('\t')
        expect(onInsertContext).toHaveBeenCalledTimes(1)
        expect(onInsertContext).toHaveBeenCalledWith('package.json', 5)
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('navigates with down arrow (j)', async () => {
        const { lastFrame, stdin } = renderWithProviders(
            <FileViewMenu filePath="package.json" initialLine={1} />
        )

        await new Promise((resolve) => setTimeout(resolve, 50))
        let frame = lastFrame()
        expect(frame).toContain('line 1')

        stdin.write('j')
        await new Promise((resolve) => setTimeout(resolve, 30))
        frame = lastFrame()
        expect(frame).toContain('line 2')
    })

    it('closes on Escape or q', async () => {
        const onClose = mock()
        const { stdin } = renderWithProviders(
            <FileViewMenu filePath="package.json" onClose={onClose} />
        )

        await new Promise((resolve) => setTimeout(resolve, 50))
        stdin.write('q')
        expect(onClose).toHaveBeenCalledTimes(1)
    })
})
