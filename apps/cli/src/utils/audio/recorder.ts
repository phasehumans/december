import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'

import { detectAudioBinary, type AudioBinaryType } from './detector'

export interface AudioRecorderOptions {
    sampleRate?: number
    channels?: number
}

export class AudioRecorder extends EventEmitter {
    private process: ChildProcess | null = null
    private isRecording = false

    start(options: AudioRecorderOptions = {}): boolean {
        if (this.isRecording) return true

        const detection = detectAudioBinary()
        if (!detection.available || !detection.binary) {
            this.emit('error', new Error(detection.error || 'Audio recording binary not found.'))
            return false
        }

        const sampleRate = options.sampleRate ?? 16000
        const channels = options.channels ?? 1

        try {
            this.process = this.spawnRecorderProcess(detection.binary, sampleRate, channels)
            this.isRecording = true

            this.process.stdout.on('data', (chunk: Buffer) => {
                this.emit('data', chunk)
            })

            this.process.stderr.on('data', (data: Buffer) => {
                const msg = data.toString()
                if (msg.includes('No such device') || msg.includes('Device or resource busy')) {
                    this.emit('error', new Error(msg.trim()))
                }
            })
            ;(this.process as any).on('error', (err: Error) => {
                this.emit('error', err)
                this.stop()
            })
            ;(this.process as any).on('close', (code: number | null) => {
                this.isRecording = false
                this.process = null
                this.emit('close', code)
            })

            return true
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err))
            this.emit('error', error)
            this.stop()
            return false
        }
    }

    private spawnRecorderProcess(
        binary: AudioBinaryType,
        sampleRate: number,
        channels: number
    ): ChildProcess {
        if (binary === 'ffmpeg') {
            const isLinux = process.platform === 'linux'
            const isMac = process.platform === 'darwin'
            const isWindows = process.platform === 'win32'

            const args: string[] = [
                '-loglevel',
                'error',
                '-fflags',
                'nobuffer',
                '-flags',
                'low_delay',
            ]

            if (isLinux) {
                args.push('-f', 'pulse', '-i', 'default')
            } else if (isMac) {
                args.push('-f', 'avfoundation', '-i', ':default')
            } else if (isWindows) {
                args.push('-f', 'dshow', '-i', 'audio=default')
            }

            args.push(
                '-ac',
                channels.toString(),
                '-ar',
                sampleRate.toString(),
                '-f',
                's16le',
                '-flush_packets',
                '1',
                '-'
            )

            return spawn('ffmpeg', args)
        }

        if (binary === 'sox') {
            const detection = detectAudioBinary()
            const binaryName = detection.path?.endsWith('rec') ? 'rec' : 'sox'
            const args =
                binaryName === 'rec'
                    ? [
                          '-q',
                          '-c',
                          channels.toString(),
                          '-r',
                          sampleRate.toString(),
                          '-b',
                          '16',
                          '-e',
                          'signed',
                          '-t',
                          'raw',
                          '-',
                      ]
                    : [
                          '-d',
                          '-q',
                          '-c',
                          channels.toString(),
                          '-r',
                          sampleRate.toString(),
                          '-b',
                          '16',
                          '-e',
                          'signed',
                          '-t',
                          'raw',
                          '-',
                      ]

            return spawn(binaryName, args)
        }

        // Default: arecord (Linux ALSA)
        return spawn('arecord', [
            '-q',
            '-c',
            channels.toString(),
            '-r',
            sampleRate.toString(),
            '-f',
            'S16_LE',
            '-t',
            'raw',
        ])
    }

    stop(): void {
        if (!this.isRecording && !this.process) return
        this.isRecording = false
        if (this.process) {
            try {
                this.process.kill('SIGTERM')
            } catch {
                // Intentionally swallowed: process already dead or exited
            }
            this.process = null
        }
    }

    get recording(): boolean {
        return this.isRecording
    }
}
