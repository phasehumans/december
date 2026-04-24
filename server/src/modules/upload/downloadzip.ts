import { mkdir, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import AdmZip from 'adm-zip'

export type DownloadedGitHubRepoArchive =
    | {
          ok: true
          owner: string
          repo: string
          ref: string | null
          zipUrl: string
          tempRootDir: string
          zipFilePath: string
          extractDir: string
          repoRootDir: string
      }
    | {
          ok: false
          error: string
          code:
              | 'DOWNLOAD_FAILED'
              | 'UNAUTHORIZED'
              | 'RATE_LIMITED'
              | 'NETWORK_ERROR'
              | 'EXTRACT_FAILED'
              | 'EMPTY_ARCHIVE'
      }

export async function downloadGitHubRepoArchive(
    owner: string,
    repo: string,
    accessToken: string,
    ref?: string
): Promise<DownloadedGitHubRepoArchive> {
    const resolvedRef = ref ?? null

    const zipUrl = resolvedRef
        ? `https://api.github.com/repos/${owner}/${repo}/zipball/${encodeURIComponent(resolvedRef)}`
        : `https://api.github.com/repos/${owner}/${repo}/zipball`

    const tempRootDir = join(
        process.cwd(),
        '.phasehumans-imports',
        `${owner}-${repo}-${randomUUID()}`
    )

    const zipFilePath = join(tempRootDir, 'repo.zip')
    const extractDir = join(tempRootDir, 'extracted')

    try {
        await mkdir(tempRootDir, { recursive: true })
        await mkdir(extractDir, { recursive: true })
    } catch {
        return {
            ok: false,
            error: 'Failed to create temporary directories',
            code: 'EXTRACT_FAILED',
        }
    }

    let response: Response

    try {
        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': 'phasehumans',
        }

        response = await fetch(zipUrl, {
            method: 'GET',
            headers,
            redirect: 'follow',
        })
    } catch {
        return {
            ok: false,
            error: 'Network error while downloading repository archive',
            code: 'NETWORK_ERROR',
        }
    }

    if (response.status === 401) {
        return {
            ok: false,
            error: 'Unauthorized to download repository archive',
            code: 'UNAUTHORIZED',
        }
    }

    if (response.status === 403) {
        const remaining = response.headers.get('x-ratelimit-remaining')

        if (remaining === '0') {
            return {
                ok: false,
                error: 'GitHub API rate limit exceeded',
                code: 'RATE_LIMITED',
            }
        }

        return {
            ok: false,
            error: 'Unauthorized to download repository archive',
            code: 'UNAUTHORIZED',
        }
    }

    if (!response.ok) {
        return {
            ok: false,
            error: `Failed to download repository archive: ${response.status}`,
            code: 'DOWNLOAD_FAILED',
        }
    }

    let zipBuffer: Buffer

    try {
        const arrayBuffer = await response.arrayBuffer()
        zipBuffer = Buffer.from(arrayBuffer)

        await Bun.write(zipFilePath, zipBuffer)
    } catch {
        return {
            ok: false,
            error: 'Failed to save repository archive',
            code: 'DOWNLOAD_FAILED',
        }
    }

    try {
        const zip = new AdmZip(zipBuffer)
        zip.extractAllTo(extractDir, true)
    } catch {
        return {
            ok: false,
            error: 'Failed to extract repository archive',
            code: 'EXTRACT_FAILED',
        }
    }

    let directories: { name: string }[]

    try {
        const entries = await readdir(extractDir, {
            withFileTypes: true,
            encoding: 'utf8',
        })

        directories = entries
            .filter((entry) => entry.isDirectory())
            .map((entry) => ({ name: entry.name }))
    } catch {
        return {
            ok: false,
            error: 'Failed to inspect extracted archive',
            code: 'EXTRACT_FAILED',
        }
    }

    if (directories.length === 0) {
        return {
            ok: false,
            error: 'Repository archive was empty after extraction',
            code: 'EMPTY_ARCHIVE',
        }
    }

    const rootDirectory = directories[0]

    if (!rootDirectory) {
        return {
            ok: false,
            error: 'Repository archive was empty after extraction',
            code: 'EMPTY_ARCHIVE',
        }
    }

    const repoRootDir = join(extractDir, rootDirectory.name)

    return {
        ok: true,
        owner,
        repo,
        ref: resolvedRef,
        zipUrl,
        tempRootDir,
        zipFilePath,
        extractDir,
        repoRootDir,
    }
}
