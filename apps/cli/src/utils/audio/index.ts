import { detectAudioBinary } from './detector'
import { AudioRecorder } from './recorder'
import { STTSession, resolveSTTKey } from './stt'

export interface VoiceDictationSession {
    stop: () => Promise<string>
    cancel: () => void
    readonly isRecording: boolean
}

export interface VoiceDictationOptions {
    onTranscript: (text: string, isFinal: boolean) => void
    onError: (err: Error) => void
}

export async function isVoiceConfigured(): Promise<{
    available: boolean
    hasBinary: boolean
    hasKey: boolean
    binary?: string | null
    provider?: string | null
    error?: string
}> {
    const binaryDetection = detectAudioBinary()
    const sttConfig = await resolveSTTKey()

    if (!binaryDetection.available) {
        return {
            available: false,
            hasBinary: false,
            hasKey: Boolean(sttConfig.key),
            error: binaryDetection.error,
        }
    }

    if (!sttConfig.key) {
        return {
            available: false,
            hasBinary: true,
            hasKey: false,
            binary: binaryDetection.binary,
            error: 'Deepgram API key not configured.',
        }
    }

    return {
        available: true,
        hasBinary: true,
        hasKey: true,
        binary: binaryDetection.binary,
        provider: 'deepgram',
    }
}

export function getVoiceSetupNotice(status: { hasBinary: boolean; hasKey: boolean }): string {
    if (!status.hasBinary) {
        return [
            'Voice dictation requires an audio recording tool.',
            '',
            'Install:',
            '  • macOS: brew install ffmpeg',
            '  • Linux: sudo apt install ffmpeg',
        ].join('\n')
    }

    return [
        'Voice dictation requires a Deepgram API key for real-time live streaming.',
        '',
        'Get a free key ($200 credit) at https://console.deepgram.com',
        '',
        'Configure key:',
        '  december key deepgram <key>',
    ].join('\n')
}

export async function startVoiceDictation(
    options: VoiceDictationOptions
): Promise<VoiceDictationSession | null> {
    const configCheck = await isVoiceConfigured()
    if (!configCheck.available) {
        options.onError(new Error(configCheck.error || 'Voice dictation is not available.'))
        return null
    }

    const stt = new STTSession({
        onTranscript: options.onTranscript,
        onError: options.onError,
    })

    const initialized = await stt.init()
    if (!initialized) {
        return null
    }

    const recorder = new AudioRecorder()
    recorder.on('data', (chunk: Buffer) => {
        stt.sendAudioChunk(chunk)
    })
    recorder.on('error', (err: Error) => {
        options.onError(err)
        stt.cancel()
    })

    const started = recorder.start()
    if (!started) {
        stt.cancel()
        return null
    }

    return {
        stop: async () => {
            recorder.stop()
            return await stt.finish()
        },
        cancel: () => {
            recorder.stop()
            stt.cancel()
        },
        get isRecording() {
            return recorder.recording
        },
    }
}

export { detectAudioBinary } from './detector'
export { AudioRecorder } from './recorder'
