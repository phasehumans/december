import { ApiError } from '@/shared/api/client'

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * What a failed request says, as a sentence: the first field error, or the message of the
 * server. A failure with no answer from the server gives the fallback.
 */
export const apiErrorMessage = (error: unknown, fallback: string): string => {
    if (!(error instanceof ApiError)) return fallback
    if (error.details && typeof error.details === 'object') {
        const fieldError = Object.values(error.details as Record<string, unknown>)
            .flat()
            .find((message): message is string => typeof message === 'string' && message !== '')
        if (fieldError) return sentence(fieldError)
    }
    if (error.message && error.message.toLowerCase() !== 'validation failed') {
        return sentence(error.message)
    }
    return fallback
}
