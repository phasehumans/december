import { beforeEach, describe, expect, it } from 'bun:test'

import { useCliStore } from '../../src/store'

describe('TUI Store Renderer Mode (Unit)', () => {
    beforeEach(() => {
        useCliStore.setState({ isInline: false })
    })

    it('defaults to fullscreen mode (isInline: false)', () => {
        expect(useCliStore.getState().isInline).toBe(false)
    })

    it('switches to classic inline renderer via setIsInline(true)', () => {
        useCliStore.getState().setIsInline(true)
        expect(useCliStore.getState().isInline).toBe(true)
    })

    it('switches back to fullscreen renderer via setIsInline(false)', () => {
        useCliStore.getState().setIsInline(true)
        expect(useCliStore.getState().isInline).toBe(true)
        useCliStore.getState().setIsInline(false)
        expect(useCliStore.getState().isInline).toBe(false)
    })
})
