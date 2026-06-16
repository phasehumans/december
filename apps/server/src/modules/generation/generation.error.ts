import type { NormalizeGenerationError } from '@december/shared'

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
        return error.message
    }

    return String(error)
}

const getFileLabel = (path?: string) => {
    if (!path) {
        return 'this file'
    }

    return path.split('/').pop() ?? path
}

export const normalizeGenerationError = (data: NormalizeGenerationError) => {
    const { error, path } = data
    const internalMessage = getErrorMessage(error)
    const normalizedMessage = internalMessage.toLowerCase()

    if (normalizedMessage.includes('unauthorized')) {
        return {
            internalMessage,
            publicMessage: 'Please sign in and try again.',
        }
    }

    if (normalizedMessage.includes('plan agent intent')) {
        return {
            internalMessage,
            publicMessage:
                "I couldn't understand the request clearly enough to start the project. Try rephrasing it with the main pages, style, and core features.",
        }
    }

    if (normalizedMessage.includes('plan agent')) {
        return {
            internalMessage,
            publicMessage:
                "I couldn't turn that request into a reliable implementation plan. Try again or simplify the prompt to the essential pages and flows.",
        }
    }

    if (
        normalizedMessage.includes('build agent') ||
        normalizedMessage.includes('generated content') ||
        normalizedMessage.includes('invalid json generated') ||
        normalizedMessage.includes('generation order')
    ) {
        return {
            internalMessage,
            publicMessage: path
                ? `I hit an issue while generating ${getFileLabel(path)}. Please retry the build.`
                : 'I started the build but hit an issue while generating the project files. Please retry the build.',
        }
    }

    if (
        normalizedMessage.includes('fetch') ||
        normalizedMessage.includes('network') ||
        normalizedMessage.includes('stream body is missing')
    ) {
        return {
            internalMessage,
            publicMessage:
                'The generation connection was interrupted. Please check your network and try again.',
        }
    }

    if (
        normalizedMessage.includes('compilation checks failed') ||
        normalizedMessage.includes('typescript type errors') ||
        normalizedMessage.includes('vite build errors')
    ) {
        return {
            internalMessage,
            publicMessage:
                'The preview build failed compilation checks. Check details for type errors or bundler issues.',
        }
    }

    return {
        internalMessage,
        publicMessage: 'Something went wrong while generating this project. Please try again.',
    }
}
