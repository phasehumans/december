interface ParsedVersion {
    core: number[]
    prerelease: string[]
}

const parseVersion = (version: string): ParsedVersion => {
    // Build metadata (+sha) never affects precedence
    const clean = version.trim().replace(/^v/, '').split('+')[0] ?? ''
    const dashIndex = clean.indexOf('-')
    const core = dashIndex === -1 ? clean : clean.slice(0, dashIndex)
    const prerelease =
        dashIndex === -1
            ? []
            : clean
                  .slice(dashIndex + 1)
                  .split('.')
                  .filter(Boolean)
    return {
        core: core.split('.').map((n) => Number(n) || 0),
        prerelease,
    }
}

const comparePrereleaseIds = (a: string, b: string): number => {
    const aNumeric = /^\d+$/.test(a)
    const bNumeric = /^\d+$/.test(b)
    if (aNumeric && bNumeric) {
        return Math.sign(Number(a) - Number(b))
    }
    // Numeric identifiers always have lower precedence than alphanumeric ones
    if (aNumeric) return -1
    if (bNumeric) return 1
    if (a === b) return 0
    return a < b ? -1 : 1
}

/**
 * Compare two semver strings following semver 2.0 precedence rules.
 * Returns 1 if a is newer, -1 if b is newer, 0 if equal.
 * A pre-release (1.0.0-beta.1) is older than its release (1.0.0).
 */
export function compareVersions(a?: string, b?: string): number {
    if (!a && !b) return 0
    if (!a) return -1
    if (!b) return 1

    const pa = parseVersion(a)
    const pb = parseVersion(b)

    for (let i = 0; i < Math.max(pa.core.length, pb.core.length); i++) {
        const v1 = pa.core[i] ?? 0
        const v2 = pb.core[i] ?? 0
        if (v1 > v2) return 1
        if (v1 < v2) return -1
    }

    if (pa.prerelease.length === 0 && pb.prerelease.length === 0) return 0
    if (pa.prerelease.length === 0) return 1
    if (pb.prerelease.length === 0) return -1

    for (let i = 0; i < Math.max(pa.prerelease.length, pb.prerelease.length); i++) {
        const idA = pa.prerelease[i]
        const idB = pb.prerelease[i]
        if (idA === undefined) return -1
        if (idB === undefined) return 1
        const diff = comparePrereleaseIds(idA, idB)
        if (diff !== 0) return diff
    }
    return 0
}

export function isNewerVersion(current: string, latest: string): boolean {
    return compareVersions(latest, current) > 0
}

export function extractVersion(text: string): string | undefined {
    const match = text.match(/\d+\.\d+\.\d+(?:-[\w.]+)?/)
    return match ? match[0] : undefined
}
