import dns from 'node:dns'

import { loadConfig } from '../../config'

try {
    dns.setDefaultResultOrder?.('ipv4first')
} catch {
    // Intentionally swallowed: setDefaultResultOrder may not be supported in all runtimes
}

export interface STTOptions {
    onTranscript: (text: string, isFinal: boolean) => void
    onError: (err: Error) => void
}

export function createWavBuffer(pcmBuffer: Buffer, sampleRate = 16000, channels = 1): Buffer {
    const header = Buffer.alloc(44)
    header.write('RIFF', 0)
    header.writeUInt32LE(36 + pcmBuffer.length, 4)
    header.write('WAVE', 8)
    header.write('fmt ', 12)
    header.writeUInt32LE(16, 16)
    header.writeUInt16LE(1, 20) // PCM
    header.writeUInt16LE(channels, 22)
    header.writeUInt32LE(sampleRate, 24)
    header.writeUInt32LE(sampleRate * channels * 2, 28)
    header.writeUInt16LE(channels * 2, 32)
    header.writeUInt16LE(16, 34) // 16-bit
    header.write('data', 36)
    header.writeUInt32LE(pcmBuffer.length, 40)
    return Buffer.concat([header, pcmBuffer])
}

export async function resolveSTTKey(): Promise<{
    provider: 'deepgram' | null
    key: string | null
}> {
    const envDeepgram = process.env.DEEPGRAM_API_KEY?.trim()
    if (envDeepgram) return { provider: 'deepgram', key: envDeepgram }

    const config = await loadConfig()
    const configDeepgram = config.providers?.deepgram?.trim()
    if (configDeepgram) return { provider: 'deepgram', key: configDeepgram }

    return { provider: null, key: null }
}

export function appendTranscript(base: string, next: string): string {
    const trimmedBase = base.trim()
    const trimmedNext = next.trim()

    if (!trimmedBase) return trimmedNext
    if (!trimmedNext) return trimmedBase

    if (/^[.,!?;:]/.test(trimmedNext)) {
        return `${trimmedBase}${trimmedNext}`
    }

    const baseWords = trimmedBase.split(/\s+/)
    const nextWords = trimmedNext.split(/\s+/)

    const maxOverlap = Math.min(3, baseWords.length, nextWords.length)
    let overlapCount = 0

    const cleanWord = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, '')

    for (let count = maxOverlap; count >= 1; count--) {
        const baseSlice = baseWords.slice(baseWords.length - count).map(cleanWord)
        const nextSlice = nextWords.slice(0, count).map(cleanWord)

        if (
            baseSlice.length === nextSlice.length &&
            baseSlice.every((w, i) => w.length > 0 && w === nextSlice[i])
        ) {
            overlapCount = count
            break
        }
    }

    if (overlapCount > 0) {
        const remainingNextWords = nextWords.slice(overlapCount)
        if (remainingNextWords.length === 0) {
            return trimmedBase
        }
        return `${trimmedBase} ${remainingNextWords.join(' ')}`
    }

    return `${trimmedBase} ${trimmedNext}`
}

export class STTSession {
    private key: string | null = null
    private ws: WebSocket | null = null
    private finalTranscript = ''
    private interimTranscript = ''
    private pendingChunks: Buffer[] = []
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null
    private onTranscript: (text: string, isFinal: boolean) => void
    private onError: (err: Error) => void
    private isClosed = false

    constructor(options: STTOptions) {
        this.onTranscript = options.onTranscript
        this.onError = options.onError
    }

    async init(): Promise<boolean> {
        const resolved = await resolveSTTKey()
        if (!resolved.key) {
            this.onError(
                new Error(
                    'No Deepgram API key found. Set DEEPGRAM_API_KEY or configure via BYOK key menu.'
                )
            )
            return false
        }

        this.key = resolved.key
        return this.initDeepgram(this.key)
    }

    private initDeepgram(key: string): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                const url =
                    'wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true&endpointing=300&encoding=linear16&sample_rate=16000&channels=1'
                this.ws = new WebSocket(url, ['token', key])

                let isHandshakeComplete = false
                const handshakeTimeout = setTimeout(() => {
                    if (!isHandshakeComplete) {
                        isHandshakeComplete = true
                        try {
                            if (
                                this.ws &&
                                (this.ws.readyState === WebSocket.CONNECTING ||
                                    this.ws.readyState === WebSocket.OPEN)
                            ) {
                                this.ws.close()
                            }
                        } catch {
                            // Intentionally swallowed: closing socket on timeout
                        }
                        this.ws = null
                        this.onError(
                            new Error(
                                'Deepgram WebSocket connection timed out. Check your internet connection.'
                            )
                        )
                        resolve(false)
                    }
                }, 10000)

                this.ws.onopen = () => {
                    if (isHandshakeComplete) return
                    isHandshakeComplete = true
                    clearTimeout(handshakeTimeout)
                    this.startHeartbeat()
                    this.flushPendingChunks()
                    resolve(true)
                }

                this.ws.onmessage = (event) => {
                    if (this.isClosed) return
                    try {
                        const data = typeof event.data === 'string' ? JSON.parse(event.data) : null
                        if (!data || data.type !== 'Results') return

                        const alt = data.channel?.alternatives?.[0]
                        const transcript = alt?.transcript?.trim()
                        if (!transcript) {
                            if (data.is_final) {
                                this.interimTranscript = ''
                            }
                            return
                        }

                        if (data.is_final) {
                            this.finalTranscript = appendTranscript(
                                this.finalTranscript,
                                transcript
                            )
                            this.interimTranscript = ''
                            this.onTranscript(this.finalTranscript, true)
                        } else {
                            this.interimTranscript = transcript
                            const fullText = appendTranscript(
                                this.finalTranscript,
                                this.interimTranscript
                            )
                            this.onTranscript(fullText, false)
                        }
                    } catch {
                        // Intentionally swallowed: invalid json payload from stream
                    }
                }

                this.ws.onerror = (_err) => {
                    if (!isHandshakeComplete) {
                        isHandshakeComplete = true
                        clearTimeout(handshakeTimeout)
                        this.onError(new Error('Deepgram WebSocket connection error.'))
                        resolve(false)
                        return
                    }
                    if (!this.isClosed) {
                        this.onError(new Error('Deepgram WebSocket connection error.'))
                    }
                }

                this.ws.onclose = () => {
                    this.stopHeartbeat()
                }
            } catch (err: unknown) {
                const error = err instanceof Error ? err : new Error(String(err))
                this.onError(error)
                resolve(false)
            }
        })
    }

    sendAudioChunk(chunk: Buffer): void {
        if (this.isClosed) return

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(chunk)
        } else if (!this.ws || this.ws.readyState === WebSocket.CONNECTING) {
            this.pendingChunks.push(chunk)
        }
    }

    private flushPendingChunks(): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
        while (this.pendingChunks.length > 0) {
            const chunk = this.pendingChunks.shift()
            if (chunk) {
                try {
                    this.ws.send(chunk)
                } catch {
                    // Intentionally swallowed: failed sending chunk during flush
                }
            }
        }
    }

    private startHeartbeat(): void {
        this.stopHeartbeat()
        this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                try {
                    this.ws.send(JSON.stringify({ type: 'KeepAlive' }))
                } catch {
                    // Intentionally swallowed: error sending heartbeat on closing socket
                }
            }
        }, 4000)
    }

    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer)
            this.heartbeatTimer = null
        }
    }

    async finish(): Promise<string> {
        this.isClosed = true
        this.stopHeartbeat()

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify({ type: 'CloseStream' }))
            } catch {
                // Intentionally swallowed: failed sending close stream
            }

            await new Promise((resolve) => setTimeout(resolve, 150))

            try {
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.ws.close()
                }
            } catch {
                // Intentionally swallowed: closing socket
            }
            this.ws = null
        } else if (this.ws) {
            try {
                this.ws.close()
            } catch {
                // Intentionally swallowed: closing socket
            }
            this.ws = null
        }

        this.pendingChunks = []
        const fullText = appendTranscript(this.finalTranscript, this.interimTranscript)
        return fullText.trim()
    }

    cancel(): void {
        this.isClosed = true
        this.stopHeartbeat()
        this.pendingChunks = []
        if (this.ws) {
            try {
                this.ws.close()
            } catch {
                // Intentionally swallowed: socket may already be closed or terminating
            }
            this.ws = null
        }
        this.finalTranscript = ''
        this.interimTranscript = ''
    }
}
