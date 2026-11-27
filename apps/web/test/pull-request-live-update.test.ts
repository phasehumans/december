import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { useAppStore } = await import('../src/app/store')
const { generationAPI, getSharedSocket, normalizeAgentStreamEvent } =
    await import('../src/features/generation/api/generation')

// the socket stays in the room of every session the user opened. a pull request the worker
// opened for one session must never show on the pull request view of another
describe('the pull request a run opens, over the live socket', () => {
    const SESSION_A = 'session-a'
    const SESSION_B = 'session-b'
    let abort: AbortController

    const fire = (event: unknown) => {
        const socket = getSharedSocket()
        for (const listener of [...socket.listeners('agent_event')]) (listener as any)(event)
    }
    const prEvent = (sessionId: string | undefined, prNumber: number) => ({
        type: 'PullRequestUpdate',
        ...(sessionId ? { sessionId } : {}),
        pullRequest: { prNumber, title: `pr ${prNumber}`, state: 'open', headRef: 'b' },
        updatedAt: Date.now(),
    })

    beforeEach(() => {
        const socket = getSharedSocket()
        Object.defineProperty(socket, 'connected', { get: () => true, configurable: true })
        socket.emit = mock(() => socket) as any
        useAppStore.setState({ pullRequest: null, activeProjectId: SESSION_B } as any)
        abort = new AbortController()
        // the stream of session A is still open while the user looks at session B
        void generationAPI
            .listenToSessionStream(SESSION_A, () => {}, abort.signal)
            .catch(() => {
                // Intentionally swallowed: the test ends the stream with an abort
            })
    })

    afterEach(() => {
        abort.abort()
        getSharedSocket().off('agent_event')
        useAppStore.setState({ pullRequest: null, activeProjectId: null } as any)
    })

    test('the event keeps the session it names', () => {
        const event = normalizeAgentStreamEvent(prEvent(SESSION_A, 1))
        expect(event).toMatchObject({ type: 'PullRequestUpdate', data: { sessionId: SESSION_A } })
        expect(normalizeAgentStreamEvent(prEvent(undefined, 1)).data).toMatchObject({
            sessionId: null,
        })
    })

    test('a pull request of another session is not put on the session on screen', () => {
        fire(prEvent(SESSION_A, 7))
        expect(useAppStore.getState().pullRequest).toBeNull()
    })

    test('the pull request of the session on screen is shown', () => {
        useAppStore.setState({ activeProjectId: SESSION_A } as any)
        fire(prEvent(SESSION_A, 7))
        expect(useAppStore.getState().pullRequest?.prNumber).toBe(7)
    })

    test('an event that names no session belongs to the stream it came on', () => {
        fire(prEvent(undefined, 8))
        expect(useAppStore.getState().pullRequest).toBeNull()

        useAppStore.setState({ activeProjectId: SESSION_A } as any)
        fire(prEvent(undefined, 9))
        expect(useAppStore.getState().pullRequest?.prNumber).toBe(9)
    })

    test('an event of session B on the stream of session A shows on session B', () => {
        // the shared socket is in both rooms, so B's event also reaches A's listener
        fire(prEvent(SESSION_B, 10))
        expect(useAppStore.getState().pullRequest?.prNumber).toBe(10)
    })
})
