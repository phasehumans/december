import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect, test, describe, afterEach } from 'bun:test'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { renderHook, act, cleanup } = await import('@testing-library/react')

import { useDelayedFlag } from '../src/shared/lib/useDelayedFlag'

const wait = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)))

describe('useDelayedFlag', () => {
    afterEach(() => cleanup())

    test('stays false for a quick load, so no loader blinks', async () => {
        const { result, rerender } = renderHook(({ on }) => useDelayedFlag(on, 60), {
            initialProps: { on: true },
        })
        expect(result.current).toBe(false)
        await wait(20)
        rerender({ on: false })
        await wait(80)
        expect(result.current).toBe(false)
    })

    test('turns true once the load is slow, and false as soon as it ends', async () => {
        const { result, rerender } = renderHook(({ on }) => useDelayedFlag(on, 40), {
            initialProps: { on: true },
        })
        await wait(70)
        expect(result.current).toBe(true)
        rerender({ on: false })
        expect(result.current).toBe(false)
    })
})
