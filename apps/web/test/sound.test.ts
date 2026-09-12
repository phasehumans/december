import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'

import {
    playGenerationSoundNotification,
    _resetSoundDebounceForTesting,
} from '../src/shared/utils/sound'

describe('Sound Utility - Unit Tests', () => {
    let mockPlayChime: ReturnType<typeof mock>
    let originalAudioContext: any

    beforeEach(() => {
        _resetSoundDebounceForTesting()
        originalAudioContext = (globalThis as any).AudioContext
    })

    afterEach(() => {
        ;(globalThis as any).AudioContext = originalAudioContext
    })

    it('does not play sound when preference is NEVER', () => {
        let called = false
        const customPlay = () => {
            called = true
        }

        playGenerationSoundNotification('NEVER', {
            isFirstGeneration: true,
            playFn: customPlay,
        })

        expect(called).toBe(false)
    })

    it('does not play sound when preference is FIRST_GENERATION and isFirstGeneration is false', () => {
        let called = false
        const customPlay = () => {
            called = true
        }

        playGenerationSoundNotification('FIRST_GENERATION', {
            isFirstGeneration: false,
            playFn: customPlay,
        })

        expect(called).toBe(false)
    })

    it('plays sound when preference is ALWAYS regardless of isFirstGeneration', () => {
        let callCount = 0
        const customPlay = () => {
            callCount++
        }

        playGenerationSoundNotification('ALWAYS', {
            isFirstGeneration: false,
            debounceMs: 0,
            playFn: customPlay,
        })

        expect(callCount).toBe(1)
    })

    it('plays sound when preference is FIRST_GENERATION and isFirstGeneration is true', () => {
        let callCount = 0
        const customPlay = () => {
            callCount++
        }

        playGenerationSoundNotification('FIRST_GENERATION', {
            isFirstGeneration: true,
            debounceMs: 0,
            playFn: customPlay,
        })

        expect(callCount).toBe(1)
    })

    it('defaults to FIRST_GENERATION if preference is undefined or null', () => {
        let callCount = 0
        const customPlay = () => {
            callCount++
        }

        playGenerationSoundNotification(undefined, {
            isFirstGeneration: true,
            debounceMs: 0,
            playFn: customPlay,
        })

        expect(callCount).toBe(1)
    })

    it('debounces multiple rapid calls within debounce window', () => {
        let callCount = 0
        const customPlay = () => {
            callCount++
        }

        playGenerationSoundNotification('ALWAYS', {
            isFirstGeneration: true,
            debounceMs: 500,
            playFn: customPlay,
        })

        playGenerationSoundNotification('ALWAYS', {
            isFirstGeneration: true,
            debounceMs: 500,
            playFn: customPlay,
        })

        expect(callCount).toBe(1)
    })
})
