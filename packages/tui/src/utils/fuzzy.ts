import { THEME } from '../theme'

export interface FuzzyMatchResult {
    matches: boolean
    score: number
    indices: number[]
}

export interface ScoredFile {
    path: string
    basename: string
    dir: string
    extension: string
    score: number
    basenameIndices: number[]
    isRecent?: boolean
}

const SCORE_EXACT_MATCH = 150
const SCORE_PREFIX_MATCH = 60
const SCORE_BASENAME_MATCH = 50
const SCORE_CONSECUTIVE = 12
const SCORE_BOUNDARY = 15
const SCORE_CAMEL = 10
const SCORE_CHAR_MATCH = 4
const SCORE_RECENT_BOOST = 35

function isBoundary(str: string, index: number): boolean {
    if (index === 0) return true
    const prev = str[index - 1]
    return prev === '/' || prev === '_' || prev === '-' || prev === '.' || prev === '\\'
}

function isCamelCase(str: string, index: number): boolean {
    if (index === 0) return false
    const curr = str[index] || ''
    const prev = str[index - 1] || ''
    return curr >= 'A' && curr <= 'Z' && prev >= 'a' && prev <= 'z'
}

/**
 * Fuzzy matches query against target string.
 * Returns match status, calculated score, and matched character indices.
 */
export function fuzzyMatch(target: string, query: string): FuzzyMatchResult {
    if (!query) {
        return { matches: true, score: 0, indices: [] }
    }
    if (!target) {
        return { matches: false, score: -Infinity, indices: [] }
    }

    const tLower = target.toLowerCase()
    const qLower = query.toLowerCase()

    if (tLower === qLower) {
        const indices = Array.from({ length: target.length }, (_, i) => i)
        return { matches: true, score: SCORE_EXACT_MATCH + 50, indices }
    }

    if (tLower.startsWith(qLower)) {
        const indices = Array.from({ length: query.length }, (_, i) => i)
        return {
            matches: true,
            score: SCORE_PREFIX_MATCH + query.length * SCORE_CONSECUTIVE,
            indices,
        }
    }

    const indices: number[] = []
    let tIdx = 0
    let qIdx = 0
    let score = 0
    let prevMatchedIdx = -2

    while (tIdx < target.length && qIdx < query.length) {
        if (tLower[tIdx] === qLower[qIdx]) {
            indices.push(tIdx)
            score += SCORE_CHAR_MATCH

            // Consecutive match bonus
            if (tIdx === prevMatchedIdx + 1) {
                score += SCORE_CONSECUTIVE
            }

            // Word / delimiter boundary bonus
            if (isBoundary(target, tIdx)) {
                score += SCORE_BOUNDARY
            } else if (isCamelCase(target, tIdx)) {
                score += SCORE_CAMEL
            }

            prevMatchedIdx = tIdx
            qIdx++
        }
        tIdx++
    }

    if (qIdx < query.length) {
        return { matches: false, score: -Infinity, indices: [] }
    }

    // Path length penalty: slight preference for shorter matches
    score -= target.length * 0.1

    return { matches: true, score, indices }
}

/**
 * Extracts basename, dir, and extension from a relative path.
 */
export function parseFilePath(filePath: string): {
    basename: string
    dir: string
    extension: string
} {
    const normalized = filePath.replace(/\\/g, '/')
    const lastSlash = normalized.lastIndexOf('/')
    const basename = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized
    const dir = lastSlash >= 0 ? normalized.slice(0, lastSlash) : '.'

    const lastDot = basename.lastIndexOf('.')
    const extension =
        lastDot > 0 && lastDot < basename.length - 1
            ? basename.slice(lastDot + 1).toLowerCase()
            : ''

    return { basename, dir, extension }
}

/**
 * Returns a colored tag badge for a given file extension.
 */
export function getExtensionBadge(ext: string): { label: string; color: string } {
    switch (ext) {
        case 'ts':
            return { label: '[TS]', color: THEME.colors.brand }
        case 'tsx':
            return { label: '[TSX]', color: THEME.colors.brand }
        case 'js':
            return { label: '[JS]', color: THEME.colors.warning }
        case 'jsx':
            return { label: '[JSX]', color: THEME.colors.warning }
        case 'json':
            return { label: '[JSON]', color: THEME.colors.warning }
        case 'md':
            return { label: '[MD]', color: 'magenta' }
        case 'mdx':
            return { label: '[MDX]', color: 'magenta' }
        case 'py':
            return { label: '[PY]', color: THEME.colors.success }
        case 'rs':
            return { label: '[RS]', color: THEME.colors.error }
        case 'go':
            return { label: '[GO]', color: 'cyan' }
        case 'css':
        case 'scss':
        case 'less':
            return { label: '[CSS]', color: 'cyan' }
        case 'html':
            return { label: '[HTML]', color: THEME.colors.error }
        case 'sh':
        case 'bash':
        case 'zsh':
            return { label: '[SH]', color: THEME.colors.success }
        case 'yml':
        case 'yaml':
            return { label: '[YML]', color: THEME.colors.warning }
        case 'toml':
            return { label: '[TOML]', color: THEME.colors.warning }
        case 'sql':
            return { label: '[SQL]', color: 'cyan' }
        default: {
            const raw = ext.toUpperCase().slice(0, 4)
            return { label: raw ? `[${raw}]` : '[FILE]', color: THEME.colors.muted }
        }
    }
}

/**
 * Scores a single file candidate against a query, considering basename vs fullpath matches and recency.
 */
export function scoreFile(filePath: string, query: string, isRecent = false): ScoredFile | null {
    const { basename, dir, extension } = parseFilePath(filePath)

    if (!query) {
        let score = isRecent ? SCORE_RECENT_BOOST : 0
        score -= filePath.length * 0.01
        return {
            path: filePath,
            basename,
            dir,
            extension,
            score,
            basenameIndices: [],
            isRecent,
        }
    }

    // Try matching against basename first (heavily preferred)
    const baseMatch = fuzzyMatch(basename, query)
    if (baseMatch.matches) {
        let score = baseMatch.score + SCORE_BASENAME_MATCH
        if (isRecent && query.length <= 3) {
            score += SCORE_RECENT_BOOST
        }
        return {
            path: filePath,
            basename,
            dir,
            extension,
            score,
            basenameIndices: baseMatch.indices,
            isRecent,
        }
    }

    // Fallback: match against full path
    const fullMatch = fuzzyMatch(filePath, query)
    if (fullMatch.matches) {
        let score = fullMatch.score
        if (isRecent && query.length <= 3) {
            score += SCORE_RECENT_BOOST
        }

        // Extract any matched indices that fall within the basename portion
        const baseOffset = filePath.length - basename.length
        const basenameIndices = fullMatch.indices
            .filter((idx) => idx >= baseOffset)
            .map((idx) => idx - baseOffset)

        return {
            path: filePath,
            basename,
            dir,
            extension,
            score,
            basenameIndices,
            isRecent,
        }
    }

    return null
}

/**
 * Filters and ranks files using fuzzy scoring with delimiter/basename bonuses and recency boost.
 */
export function scoreAndSortFiles(
    files: string[],
    query: string,
    recentFiles?: Set<string>
): ScoredFile[] {
    const scored: ScoredFile[] = []

    for (const file of files) {
        const isRecent = recentFiles ? recentFiles.has(file) : false
        const res = scoreFile(file, query, isRecent)
        if (res) {
            scored.push(res)
        }
    }

    // Sort by descending score; on equal score, sort alphabetically by path
    scored.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score
        }
        return a.path.localeCompare(b.path)
    })

    return scored
}
