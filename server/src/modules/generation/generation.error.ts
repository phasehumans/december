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

export const normalizeGenerationError = (error: unknown, options?: { path?: string }) => {
    const internalMessage = getErrorMessage(error)
    const normalizedMessage = internalMessage.toLowerCase()

    if (normalizedMessage.includes('unauthorized')) {
        return {
            internalMessage,
            publicMessage: 'Please sign in and try again.',
        }
    }

    if (normalizedMessage.includes('prompt agent')) {
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
            publicMessage: options?.path
                ? `I hit an issue while generating ${getFileLabel(options.path)}. Please retry the build.`
                : 'I started the build but hit an issue while generating the project files. Please retry the build.',
        }
    }

    if (normalizedMessage.includes('edit agent')) {
        return {
            internalMessage,
            publicMessage:
                'I hit an issue while applying that edit. Please try again with a more specific change request.',
        }
    }

    if (normalizedMessage.includes('fix agent')) {
        return {
            internalMessage,
            publicMessage:
                'I found the preview error but could not repair it automatically. Please try again or adjust the request.',
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

    return {
        internalMessage,
        publicMessage: 'Something went wrong while generating this project. Please try again.',
    }
}
