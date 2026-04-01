const ROOT_FRONTEND_FILE_PATTERNS = [
    /^package\.json$/,
    /^index\.html$/,
    /^tsconfig(?:\.[^/]+)?\.json$/,
    /^vite\.config\.(?:[cm]?[jt]s)$/,
    /^postcss\.config\.(?:[cm]?[jt]s)$/,
    /^tailwind\.config\.(?:[cm]?[jt]s)$/,
    /^eslint\.config\.(?:[cm]?[jt]s)$/,
]

const FRONTEND_DIRECTORY_PREFIXES = ['src/', 'public/']
const DISALLOWED_PREFIXES = ['server/', 'api/', 'prisma/', '.git/']
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
