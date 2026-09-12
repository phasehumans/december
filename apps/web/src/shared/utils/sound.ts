export type GenerationSoundPreference = 'FIRST_GENERATION' | 'ALWAYS' | 'NEVER'

export const playCompletionChime = () => {
    try {
        if (typeof window === 'undefined') {
            return
        }

        const AudioContext = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioContext) {
            return
        }

        const ctx = new AudioContext()
        const now = ctx.currentTime

        const playBell = (freq: number, startTime: number, duration: number, vol: number) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()

            osc.type = 'triangle'
            osc.frequency.setValueAtTime(freq, startTime)

            const lfo = ctx.createOscillator()
            const lfoGain = ctx.createGain()
            lfo.frequency.value = 8
            lfoGain.gain.value = freq * 0.003
            lfo.connect(lfoGain)
            lfoGain.connect(osc.frequency)

            gain.gain.setValueAtTime(0, startTime)
            gain.gain.linearRampToValueAtTime(vol, startTime + 0.015)
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

            osc.connect(gain)
            gain.connect(ctx.destination)

            lfo.start(startTime)
            osc.start(startTime)

            lfo.stop(startTime + duration)
            osc.stop(startTime + duration)
        }

        const baseVolume = 0.28
        playBell(261.63, now, 1.2, baseVolume * 0.8)
        playBell(329.63, now + 0.055, 1.0, baseVolume * 0.9)
        playBell(392.0, now + 0.11, 0.9, baseVolume)
        playBell(523.25, now + 0.165, 0.8, baseVolume * 0.95)
        playBell(783.99, now + 0.22, 0.7, baseVolume * 0.7)
    } catch {
        // Intentionally swallowed: Web Audio autoplay or context initialization fallback
    }
}

export const playGenerationSoundPreview = playCompletionChime

let lastPlayedTimestamp = 0

export const _resetSoundDebounceForTesting = () => {
    lastPlayedTimestamp = 0
}

export interface PlayGenerationSoundOptions {
    isFirstGeneration?: boolean
    debounceMs?: number
    playFn?: () => void
}

export const playGenerationSoundNotification = (
    preference: GenerationSoundPreference | null | undefined = 'FIRST_GENERATION',
    options?: PlayGenerationSoundOptions
) => {
    const effectivePreference = preference || 'FIRST_GENERATION'

    if (effectivePreference === 'NEVER') {
        return
    }

    const isFirstGeneration = options?.isFirstGeneration ?? true
    if (effectivePreference === 'FIRST_GENERATION' && !isFirstGeneration) {
        return
    }

    const debounceMs = options?.debounceMs ?? 1000
    const now = Date.now()
    if (debounceMs > 0 && now - lastPlayedTimestamp < debounceMs) {
        return
    }

    lastPlayedTimestamp = now

    const play = options?.playFn || playCompletionChime
    try {
        play()
    } catch {
        // Intentionally swallowed: Sound playback fallback
    }
}
