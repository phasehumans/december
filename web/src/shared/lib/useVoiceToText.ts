import { useState, useRef, useCallback, useEffect } from 'react'

interface SpeechRecognitionEvent {
    resultIndex: number
    results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent {
    error: string
    message: string
}

interface SpeechRecognitionInstance {
    continuous: boolean
    interimResults: boolean
    lang: string
    start: () => void
    stop: () => void
    abort: () => void
    onresult: ((event: SpeechRecognitionEvent) => void) | null
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
    onend: (() => void) | null
    onstart: (() => void) | null
}

interface UseVoiceToTextOptions {
    /** Called with the current transcript (interim + final) on every speech result */
    onTranscript: (text: string) => void
    /** Language for recognition, defaults to 'en-US' */
    lang?: string
}

interface UseVoiceToTextReturn {
    /** Whether the mic is currently listening */
    isListening: boolean
    /** Whether the browser supports the Web Speech API */
    isSupported: boolean
    /** Current volume level 0-1 for visual feedback */
    volume: number
    /** Start listening */
    startListening: () => void
    /** Stop listening */
    stopListening: () => void
    /** Toggle listening on/off */
    toggleListening: () => void
}

function getSpeechRecognitionConstructor(): (new () => SpeechRecognitionInstance) | null {
    const w = window as any
    return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function useVoiceToText({
    onTranscript,
    lang = 'en-US',
}: UseVoiceToTextOptions): UseVoiceToTextReturn {
    const [isListening, setIsListening] = useState(false)
    const [volume, setVolume] = useState(0)
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
    const volumeIntervalRef = useRef<number | null>(null)

    // Robust references to prevent race conditions and closure staleness
    const isListeningRef = useRef(false)
    const accumulatedRef = useRef('')
    const sessionFinalRef = useRef('')
    const sessionInterimRef = useRef('')
    const onTranscriptRef = useRef(onTranscript)

    // Keep the callback ref fresh so we don't re-create recognition on every render
    useEffect(() => {
        onTranscriptRef.current = onTranscript
    }, [onTranscript])

    const isSupported = typeof window !== 'undefined' && !!getSpeechRecognitionConstructor()

    const stopVolumeSimulation = useCallback(() => {
        if (volumeIntervalRef.current) {
            clearInterval(volumeIntervalRef.current)
            volumeIntervalRef.current = null
        }
        setVolume(0)
    }, [])

    const startVolumeSimulation = useCallback(() => {
        stopVolumeSimulation()

        // Simulates realistic voice volume/pitch dynamics for beautiful visual animations
        volumeIntervalRef.current = window.setInterval(() => {
            setVolume((prev) => {
                const target = Math.random() * 0.4 + 0.1 // organic base pulsing
                return prev + (target - prev) * 0.3 // smooth transition
            })
        }, 100)
    }, [stopVolumeSimulation])

    const stopListening = useCallback(() => {
        console.log('[VoiceToText] Stopping listening...')
        isListeningRef.current = false
        setIsListening(false)
        stopVolumeSimulation()

        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop()
            } catch (e) {
                console.warn('[VoiceToText] Error stopping recognition:', e)
            }
        }

        accumulatedRef.current = ''
        sessionFinalRef.current = ''
        sessionInterimRef.current = ''
    }, [stopVolumeSimulation])

    const startListening = useCallback(() => {
        console.log('[VoiceToText] Starting listening...')
        const SpeechRecognition = getSpeechRecognitionConstructor()
        if (!SpeechRecognition) {
            console.error('[VoiceToText] SpeechRecognition is not supported in this browser.')
            return
        }

        // Stop any existing session
        if (recognitionRef.current) {
            try {
                recognitionRef.current.abort()
            } catch (e) {
                // ignore
            }
        }
        stopVolumeSimulation()

        try {
            const recognition = new SpeechRecognition()

            // Set continuous to true for natural pauses and longer listening duration
            recognition.continuous = true
            recognition.interimResults = true
            recognition.lang = lang

            isListeningRef.current = true
            setIsListening(true)
            accumulatedRef.current = ''
            sessionFinalRef.current = ''
            sessionInterimRef.current = ''

            recognition.onstart = () => {
                console.log('[VoiceToText] Recognition session started successfully.')
                startVolumeSimulation()
            }

            recognition.onresult = (event: SpeechRecognitionEvent) => {
                console.log('[VoiceToText] Result event received:', event)
                try {
                    let sessionFinal = ''
                    let sessionInterim = ''

                    // Loop through all results in the current session (index from 0 to length - 1)
                    // this ensures we fetch the entire state of the current session
                    for (let i = 0; i < event.results.length; i++) {
                        const result = event.results[i]
                        if (!result) continue
                        if (result.isFinal) {
                            sessionFinal += result[0]?.transcript ?? ''
                        } else {
                            sessionInterim += result[0]?.transcript ?? ''
                        }
                    }

                    sessionFinalRef.current = sessionFinal
                    sessionInterimRef.current = sessionInterim

                    console.log(
                        '[VoiceToText] Parsed - Final:',
                        sessionFinal,
                        'Interim:',
                        sessionInterim
                    )

                    const base = accumulatedRef.current
                    const currentTotal = (sessionFinal + sessionInterim).trim()
                    const separator = base && currentTotal && !base.endsWith(' ') ? ' ' : ''
                    const combined = base + separator + currentTotal

                    if (combined.trim()) {
                        onTranscriptRef.current(combined)
                    }
                } catch (err) {
                    console.error('[VoiceToText] Error in onresult handler:', err)
                }
            }

            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                console.error(
                    '[VoiceToText] Speech recognition error event:',
                    event.error,
                    event.message
                )

                // Critical errors should halt listening
                const criticalErrors = [
                    'not-allowed',
                    'audio-capture',
                    'service-not-allowed',
                    'network',
                ]
                if (criticalErrors.includes(event.error)) {
                    console.error('[VoiceToText] Critical error, turning off mic.')
                    stopListening()
                }
            }

            recognition.onend = () => {
                console.log('[VoiceToText] Recognition session ended.')

                // Self-healing: if we are still in listening mode, commit the last session's final transcript to accumulated
                // and auto-restart a new session to recover from long silence cutoffs or network hiccups.
                if (isListeningRef.current) {
                    const base = accumulatedRef.current
                    const sessionFinal = sessionFinalRef.current.trim()
                    const separator = base && sessionFinal && !base.endsWith(' ') ? ' ' : ''
                    accumulatedRef.current = (base + separator + sessionFinal).trim()

                    sessionFinalRef.current = ''
                    sessionInterimRef.current = ''

                    console.log(
                        '[VoiceToText] Auto-restarting recognition session. Accumulated text:',
                        accumulatedRef.current
                    )
                    try {
                        recognition.start()
                    } catch (e) {
                        console.warn('[VoiceToText] Failed to auto-restart recognition:', e)
                    }
                } else {
                    stopVolumeSimulation()
                }
            }

            recognitionRef.current = recognition
            recognition.start()
        } catch (error) {
            console.error('[VoiceToText] Failed to initialize/start SpeechRecognition:', error)
            stopListening()
        }
    }, [lang, stopListening, stopVolumeSimulation, startVolumeSimulation])

    const toggleListening = useCallback(() => {
        if (isListening) {
            stopListening()
        } else {
            startListening()
        }
    }, [isListening, startListening, stopListening])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isListeningRef.current = false
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort()
                } catch (e) {
                    // ignore
                }
            }
            if (volumeIntervalRef.current) {
                clearInterval(volumeIntervalRef.current)
            }
        }
    }, [])

    return {
        isListening,
        isSupported,
        volume,
        startListening,
        stopListening,
        toggleListening,
    }
}
