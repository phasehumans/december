import { describe, it, expect } from 'bun:test'

import { detectAudioBinary } from '../../src/utils/audio/detector'
import { isVoiceConfigured, getVoiceSetupNotice } from '../../src/utils/audio/index'
import { createWavBuffer, resolveSTTKey, appendTranscript } from '../../src/utils/audio/stt'

describe('Audio Utilities (Unit)', () => {
    describe('detectAudioBinary', () => {
        it('detects available audio binaries on the system or reports a clean error message', () => {
            const result = detectAudioBinary()
            expect(result).toBeDefined()
            expect(typeof result.available).toBe('boolean')
            if (result.available) {
                expect(['ffmpeg', 'sox', 'arecord']).toContain(result.binary!)
                expect(typeof result.path).toBe('string')
            } else {
                expect(result.binary).toBeNull()
                expect(typeof result.error).toBe('string')
            }
        })
    })

    describe('createWavBuffer', () => {
        it('generates a valid 44-byte RIFF/WAVE header with PCM data', () => {
            const pcm = Buffer.alloc(16000 * 2) // 1 second of 16kHz 16-bit mono
            const wav = createWavBuffer(pcm, 16000, 1)

            expect(wav.length).toBe(44 + pcm.length)
            expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
            expect(wav.toString('ascii', 8, 12)).toBe('WAVE')
            expect(wav.toString('ascii', 12, 16)).toBe('fmt ')
            expect(wav.readUInt16LE(20)).toBe(1) // PCM format
            expect(wav.readUInt16LE(22)).toBe(1) // 1 channel
            expect(wav.readUInt32LE(24)).toBe(16000) // 16kHz
            expect(wav.readUInt16LE(34)).toBe(16) // 16 bits
            expect(wav.toString('ascii', 36, 40)).toBe('data')
            expect(wav.readUInt32LE(40)).toBe(pcm.length)
        })
    })

    describe('resolveSTTKey', () => {
        it('resolves Deepgram key from env or config without throwing', async () => {
            const result = await resolveSTTKey()
            expect(result).toBeDefined()
            if (result.key) {
                expect(result.provider).toBe('deepgram')
            }
        })
    })

    describe('appendTranscript', () => {
        it('joins base and next with space when no overlap exists', () => {
            expect(appendTranscript('Hello', 'world')).toBe('Hello world')
            expect(appendTranscript('Hello world.', 'How are you?')).toBe(
                'Hello world. How are you?'
            )
        })

        it('returns non-empty string when either base or next is empty', () => {
            expect(appendTranscript('', 'test prompt')).toBe('test prompt')
            expect(appendTranscript('test prompt', '')).toBe('test prompt')
        })

        it('attaches punctuation without space before the mark', () => {
            expect(appendTranscript('Hello', ', world')).toBe('Hello, world')
            expect(appendTranscript('Is it ready', '?')).toBe('Is it ready?')
        })

        it('deduplicates overlapping boundary words between chunks', () => {
            expect(appendTranscript('I want to write a test', 'test for login')).toBe(
                'I want to write a test for login'
            )
            expect(appendTranscript('write a unit test', 'unit test for auth')).toBe(
                'write a unit test for auth'
            )
        })
    })

    describe('isVoiceConfigured', () => {
        it('returns status indicating binary and key availability without throwing', async () => {
            const status = await isVoiceConfigured()
            expect(status).toBeDefined()
            expect(typeof status.available).toBe('boolean')
            expect(typeof status.hasBinary).toBe('boolean')
            expect(typeof status.hasKey).toBe('boolean')
        })
    })

    describe('getVoiceSetupNotice', () => {
        it('generates recording binary instructions when binary is missing', () => {
            const notice = getVoiceSetupNotice({ hasBinary: false, hasKey: true })
            expect(notice).toContain('Voice dictation requires an audio recording tool.')
            expect(notice).toContain('brew install ffmpeg')
            expect(notice).toContain('sudo apt install ffmpeg')
            expect(notice).not.toContain('december key deepgram')
            expect(notice).not.toContain('—')
        })

        it('generates API key instructions when binary is present but key is missing', () => {
            const notice = getVoiceSetupNotice({ hasBinary: true, hasKey: false })
            expect(notice).toContain('Voice dictation requires a Deepgram API key')
            expect(notice).toContain('december key deepgram <key>')
            expect(notice).toContain('console.deepgram.com')
            expect(notice).not.toContain('brew install ffmpeg')
            expect(notice).not.toContain('—')
        })
    })
})
