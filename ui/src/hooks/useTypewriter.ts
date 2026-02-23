import { useState, useEffect } from 'react'

const SUFFIXES = [
    'a web app that...',
    'a dashboard to...',
    'an internal tool that...',
    'a blog about...',
    'a landing page for...',
    'a portfolio for...',
]

interface UseTypewriterProps {
    minimized: boolean
    placeholder?: string
}

export const useTypewriter = ({ minimized, placeholder }: UseTypewriterProps) => {
    const [displayText, setDisplayText] = useState('')
    const [suffixIndex, setSuffixIndex] = useState(0)
    const [isDeleting, setIsDeleting] = useState(false)

    useEffect(() => {
        if (minimized || placeholder) return

        const currentSuffix = SUFFIXES[suffixIndex] ?? ''
        const typeSpeed = isDeleting ? 20 : 50
        const pauseEnd = 3000

        const timeout = setTimeout(() => {
            if (!isDeleting) {
                if (displayText !== currentSuffix) {
                    setDisplayText(currentSuffix.slice(0, displayText.length + 1))
                } else {
                    setTimeout(() => setIsDeleting(true), pauseEnd)
                }
            } else {
                if (displayText !== '') {
                    setDisplayText(currentSuffix.slice(0, displayText.length - 1))
                } else {
                    setIsDeleting(false)
                    setSuffixIndex((prev) => (prev + 1) % SUFFIXES.length)
                }
            }
        }, typeSpeed)

        return () => clearTimeout(timeout)
    }, [displayText, isDeleting, suffixIndex, minimized, placeholder])

    return displayText
}
