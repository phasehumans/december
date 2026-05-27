import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

import { importStagingRootDir } from './import-project.utils'

const execAsync = promisify(exec)

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
    const tempRootDir = join(importStagingRootDir(), `github-${owner}-${repo}-${randomUUID()}`)
    const cloneUrl = `https://${accessToken}@github.com/${owner}/${repo}.git`

    try {
        await mkdir(tempRootDir, { recursive: true })
        console.log(`[git-clone] target dir: ${tempRootDir}`)

        // Execute git clone
        const cloneCommand = resolvedRef
            ? `git clone --depth 1 -b ${resolvedRef} ${cloneUrl} "${tempRootDir}"`
            : `git clone --depth 1 ${cloneUrl} "${tempRootDir}"`

        console.log(
            `[git-clone] running: git clone --depth 1 ${resolvedRef ? `-b ${resolvedRef} ` : ''}https://***@github.com/${owner}/${repo}.git "${tempRootDir}"`
        )

        try {
            await execAsync(cloneCommand)
            console.log(`[git-clone] clone succeeded`)
        } catch (err: any) {
            // If it fails with a specific ref, fallback to default clone
            if (resolvedRef) {
                console.log(`[git-clone] branch clone failed, falling back to default clone`)
                await execAsync(`git clone --depth 1 ${cloneUrl} "${tempRootDir}"`)
                console.log(`[git-clone] fallback clone succeeded`)
            } else {
                throw err
            }
        }

        // Remove the .git directory so it doesn't get validated/uploaded
        await rm(join(tempRootDir, '.git'), { recursive: true, force: true }).catch(() => undefined)
        console.log(`[git-clone] .git directory removed`)

        return {
            ok: true,
            owner,
            repo,
            ref: resolvedRef,
            zipUrl: '',
            tempRootDir,
            zipFilePath: '',
            extractDir: tempRootDir,
            repoRootDir: tempRootDir,
        }
    } catch (error: any) {
        // Remove token from output
        const sanitizedError = error.message
            ? error.message.replace(accessToken, '***')
            : 'Git clone failed'
        console.error(`[git-clone] FAILED for ${owner}/${repo}:`, sanitizedError)
        return {
            ok: false,
            error: sanitizedError,
            code: 'DOWNLOAD_FAILED',
        }
    }
}
