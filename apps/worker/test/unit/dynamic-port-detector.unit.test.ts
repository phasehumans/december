import { describe, expect, it, mock } from 'bun:test'

import {
    detectSandboxListeningPorts,
    parseListeningPortsOutput,
    pickWebPreviewPort,
} from '../../src/dynamic-port-detector'

describe('Worker Dynamic Port Detector (Ticket #589 - Seam 2)', () => {
    describe('parseListeningPortsOutput', () => {
        it('parses ss -tln output accurately into unique numeric port numbers', () => {
            const ssOutput = `
State      Recv-Q Send-Q Local Address:Port               Peer Address:Port
LISTEN     0      128          0.0.0.0:22                      0.0.0.0:*
LISTEN     0      511          0.0.0.0:3000                    0.0.0.0:*
LISTEN     0      128        127.0.0.1:5432                    0.0.0.0:*
LISTEN     0      511                *:5173                          *:*
`
            const ports = parseListeningPortsOutput(ssOutput)
            expect(ports).toEqual([3000, 5173])
            // 22 and 5432 should be filtered out by default system/db exclusions
        })

        it('parses lsof -iTCP -sTCP:LISTEN output', () => {
            const lsofOutput = `
COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
sshd     1234 root    3u  IPv4  12345      0t0  TCP *:22 (LISTEN)
node     5678  app   19u  IPv6  67890      0t0  TCP *:8080 (LISTEN)
python3  9012  app    4u  IPv4  23456      0t0  TCP 127.0.0.1:8000 (LISTEN)
`
            const ports = parseListeningPortsOutput(lsofOutput)
            expect(ports).toEqual([8000, 8080])
        })
    })

    describe('pickWebPreviewPort', () => {
        it('prefers common web frontend/backend ports over arbitrary ports', () => {
            expect(pickWebPreviewPort([9999, 5173, 3000])).toBe(5173)
            expect(pickWebPreviewPort([9999, 8080])).toBe(8080)
            expect(pickWebPreviewPort([4200, 9999])).toBe(4200)
            expect(pickWebPreviewPort([9000])).toBe(9000)
            expect(pickWebPreviewPort([])).toBeNull()
        })
    })

    describe('detectSandboxListeningPorts', () => {
        it('executes socket inspection inside sandbox and returns detected ports', async () => {
            const mockSandbox = {
                sandboxId: 'sb-test-123',
                executeCommand: mock(async (cmd: string, onData?: (chunk: string) => void) => {
                    if (onData) {
                        onData('LISTEN 0 511 *:3000 *:*\\nLISTEN 0 511 0.0.0.0:8000 0.0.0.0:*\\n')
                    }
                    return 0
                }),
            }

            const ports = await detectSandboxListeningPorts(mockSandbox)
            expect(ports).toEqual([3000, 8000])
            expect(mockSandbox.executeCommand).toHaveBeenCalled()
        })

        it('returns empty array gracefully if sandbox command execution fails', async () => {
            const failingSandbox = {
                sandboxId: 'sb-fail',
                executeCommand: mock(async () => {
                    throw new Error('Sandbox network timeout')
                }),
            }

            const ports = await detectSandboxListeningPorts(failingSandbox)
            expect(ports).toEqual([])
        })
    })
})
