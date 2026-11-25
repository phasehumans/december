import { isRepoFullName as isSharedRepoFullName, joinRepoFullName } from '@december/shared'
import { detectGitProvider, getGitProvider } from '@december/shared/git'

import type { SecretRepoRow, SessionRepoRow } from './secrets.types'

export function maskSecretValue(value: string): string {
    if (value.length <= 4) return '****'
    return value.slice(0, 2) + '****' + value.slice(-2)
}

/** the value of `repoFullName` on a secret that is used in all repositories */
export const ALL_REPOSITORIES = ''

/**
 * `owner/name`. A GitLab path can have more parts (`group/team/name`). A part of dots
 * only is refused: it would point at another path of the git host.
 */
export function isRepoFullName(value: string): boolean {
    return isSharedRepoFullName(value)
}

/**
 * The repository as the database keeps it: lower case, because git hosts compare
 * repository names without case, and '' for "all repositories".
 */
export function toStoredRepo(repoFullName: string | null | undefined): string {
    return (repoFullName ?? '').trim().toLowerCase()
}

/** the repository as the api gives it: `owner/name`, or null for "all repositories" */
export function toApiRepo(stored: string): string | null {
    return stored === ALL_REPOSITORIES ? null : stored
}

/** `owner/name` of the repository of a session, or null when the session has none */
export function toSessionRepoFullName(row: SessionRepoRow | null | undefined): string | null {
    if (!row) return null
    const saved = joinRepoFullName(row.githubRepoOwner, row.githubRepoName)
    if (saved) return saved
    const url = row.repoUrl ?? row.githubRepoUrl
    if (!url) return null
    const gitProvider = detectGitProvider(url)
    return gitProvider ? (getGitProvider(gitProvider).parseRepoUrl(url)?.path ?? null) : null
}

/**
 * The secrets a sandbox of one repository gets: the "all repositories" rows plus the rows
 * of that repository. When a name is in both, the row of the repository wins. With no
 * repository, only the "all repositories" rows. Rows of other repositories never pass.
 */
export function pickSecretsForRepository<Row extends SecretRepoRow>(
    rows: Row[],
    repoFullName: string | null | undefined
): Row[] {
    const repo = toStoredRepo(repoFullName)
    const picked = new Map<string, Row>()
    for (const row of rows) {
        const rowRepo = toStoredRepo(row.repoFullName)
        if (rowRepo !== ALL_REPOSITORIES && rowRepo !== repo) continue
        const current = picked.get(row.name)
        // an "all repositories" row never replaces the row of the repository
        if (current && rowRepo === ALL_REPOSITORIES) continue
        picked.set(row.name, row)
    }
    return [...picked.values()]
}
