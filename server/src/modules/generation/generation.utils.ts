export const cleanPrompt = (input: string): string => {
    if (!input) {
        return ''
    }
    return input.replace(/\r\n?/g, ' ').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim()
}

const ROOT_FRONTEND_FILE_PATTERNS = [
    /^\.gitignore$/,
    /^build\.ts$/,
    /^bun-env\.d\.ts$/,
    /^README\.md$/,
    /^tsconfig\.json$/,
    /^package\.json$/,
    /^index\.html$/,
]

const FRONTEND_DIRECTORY_PREFIXES = ['src/', 'public/']
const DISALLOWED_PREFIXES = ['server/', 'api/', 'prisma/']
const DISALLOWED_EXACT_PATHS = new Set([
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    '.env.test',
])

export const isFrontendWorkspacePath = (path: string) => {
    const trimmedPath = path.trim()

    if (!trimmedPath || trimmedPath !== path) {
        return false
    }

    if (trimmedPath.includes('\\') || trimmedPath.startsWith('/') || trimmedPath.includes('../')) {
        return false
    }

    if (DISALLOWED_EXACT_PATHS.has(trimmedPath) || trimmedPath.startsWith('.env.')) {
        return false
    }

    if (DISALLOWED_PREFIXES.some((prefix) => trimmedPath.startsWith(prefix))) {
        return false
    }

    if (FRONTEND_DIRECTORY_PREFIXES.some((prefix) => trimmedPath.startsWith(prefix))) {
        return true
    }

    return ROOT_FRONTEND_FILE_PATTERNS.some((pattern) => pattern.test(trimmedPath))
}

export const assertFrontendWorkspacePath = (path: string, label = 'frontend file') => {
    if (!isFrontendWorkspacePath(path)) {
        throw new Error(
            `${label} must stay in src/, public/, or approved frontend root files: ${path}`
        )
    }
}

export const toPreviewWorkspacePath = (path: string) => {
    if (path.startsWith('web/')) {
        const legacyPath = path.slice('web/'.length)
        return isFrontendWorkspacePath(legacyPath) ? legacyPath : null
    }

    return isFrontendWorkspacePath(path) ? path : null
}
