/**
 * Two short soft tones for "the session finished". Made with Web Audio, so there is no
 * sound file to load. The browser plays it only after the user has used the page, which
 * is always true here: the user sent a prompt or turned the switch on.
 */
export const playFinishSound = (): void => {
    if (typeof window === 'undefined') return
    try {
        const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AudioContextClass) return

        const context = new AudioContextClass()
        const now = context.currentTime
        const notes = [660, 880]
        notes.forEach((frequency, index) => {
            const oscillator = context.createOscillator()
            const gain = context.createGain()
            const start = now + index * 0.14
            oscillator.type = 'sine'
            oscillator.frequency.value = frequency
            gain.gain.setValueAtTime(0.0001, start)
            gain.gain.exponentialRampToValueAtTime(0.06, start + 0.02)
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13)
            oscillator.connect(gain)
            gain.connect(context.destination)
            oscillator.start(start)
            oscillator.stop(start + 0.14)
        })
        window.setTimeout(() => {
            void context.close()
        }, 700)
    } catch {
        // Intentionally swallowed: no audio support, or the browser blocked it. the sound is optional
    }
}
