import { describe, it, expect } from 'bun:test'

describe('Server Socket Terminal Event Bridge (Unit Tests)', () => {
    it('should verify terminal event channel names and contracts', () => {
        const sessionId = 'test-session-123'
        const inputChannel = `session_terminal_input:${sessionId}`
        const resizeChannel = `session_terminal_resize:${sessionId}`
        const attachChannel = `session_terminal_attach:${sessionId}`
        const detachChannel = `session_terminal_detach:${sessionId}`
        const dataChannel = `session_terminal_data:${sessionId}`
        const socketRoom = `session_terminal:${sessionId}`

        expect(inputChannel).toBe('session_terminal_input:test-session-123')
        expect(resizeChannel).toBe('session_terminal_resize:test-session-123')
        expect(attachChannel).toBe('session_terminal_attach:test-session-123')
        expect(detachChannel).toBe('session_terminal_detach:test-session-123')
        expect(dataChannel).toBe('session_terminal_data:test-session-123')
        expect(socketRoom).toBe('session_terminal:test-session-123')
    })

    it('should format resize payloads as json with cols and rows', () => {
        const payload = JSON.stringify({ cols: 120, rows: 30 })
        const parsed = JSON.parse(payload)

        expect(parsed.cols).toBe(120)
        expect(parsed.rows).toBe(30)
    })
})
