import { execSync } from 'node:child_process'

export type AudioBinaryType = 'ffmpeg' | 'sox' | 'arecord'

export interface AudioBinaryDetection {
    available: boolean
    binary: AudioBinaryType | null
    path?: string
    error?: string
}

function checkBinary(name: string): string | null {
    try {
        const isWindows = process.platform === 'win32'
        const checkCmd = isWindows ? `where ${name}` : `which ${name}`
        const stdout = execSync(checkCmd, {
            stdio: ['ignore', 'pipe', 'ignore'],
            encoding: 'utf8',
        }).trim()
        return stdout ? stdout.split('\n')[0].trim() : null
    } catch {
        // Intentionally swallowed: binary not found in PATH
        return null
    }
}

export function detectAudioBinary(): AudioBinaryDetection {
    // 1. Prefer ffmpeg (cross-platform, reliable PCM audio streaming)
    const ffmpegPath = checkBinary('ffmpeg')
    if (ffmpegPath) {
        return { available: true, binary: 'ffmpeg', path: ffmpegPath }
    }

    // 2. Check sox / rec
    const soxPath = checkBinary('rec') || checkBinary('sox')
    if (soxPath) {
        return { available: true, binary: 'sox', path: soxPath }
    }

    // 3. On Linux, check arecord (ALSA)
    if (process.platform === 'linux') {
        const arecordPath = checkBinary('arecord')
        if (arecordPath) {
            return { available: true, binary: 'arecord', path: arecordPath }
        }
    }

    return {
        available: false,
        binary: null,
        error:
            process.platform === 'darwin'
                ? 'No audio recording binary found. Please install ffmpeg or sox (e.g. "brew install ffmpeg").'
                : process.platform === 'linux'
                  ? 'No audio recording binary found. Please install ffmpeg, sox, or alsa-utils (e.g. "sudo apt install ffmpeg").'
                  : 'No audio recording binary found. Please install ffmpeg or sox in your system PATH.',
    }
}
