import { randomUUID } from 'node:crypto'
import { mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { extractZipSafely, importStagingRootDir } from './import-project.utils'
import type { UploadedZipFile, ExtractedUploadedZipArchive } from './upload.types'

export async function extractUploadedZipArchive(
    zipFile: UploadedZipFile
): Promise<ExtractedUploadedZipArchive> {
    const isZip =
        zipFile.mimetype === 'application/zip' ||
        zipFile.mimetype === 'application/x-zip-compressed' ||
        zipFile.originalname.toLowerCase().endsWith('.zip')

    if (!isZip) {
        return {
            ok: false,
            error: 'Only zip files are allowed',
            code: 'INVALID_FILE',
        }
    }

    const repoName = zipFile.originalname.replace(/\.zip$/i, '') || 'uploaded-repo'

    const tempRootDir = join(importStagingRootDir(), `uploaded-${repoName}-${randomUUID()}`)

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

    try {
        await Bun.write(zipFilePath, zipFile.buffer)
    } catch {
        return {
            ok: false,
            error: 'Failed to save uploaded zip file',
            code: 'SAVE_FAILED',
        }
    }

    try {
        await extractZipSafely(zipFile.buffer, extractDir)
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : 'Failed to extract uploaded zip file',
            code: 'EXTRACT_FAILED',
        }
    }

    let directories: { name: string }[]
    let files: { name: string }[]

    try {
        const entries = await readdir(extractDir, {
            withFileTypes: true,
            encoding: 'utf8',
        })

        directories = entries
            .filter((entry) => entry.isDirectory() && entry.name !== '__MACOSX')
            .map((entry) => ({ name: entry.name }))

        files = entries
            .filter((entry) => entry.isFile() && entry.name !== '.DS_Store')
            .map((entry) => ({ name: entry.name }))
    } catch {
        return {
            ok: false,
            error: 'Failed to inspect extracted archive',
            code: 'EXTRACT_FAILED',
        }
    }

    let repoRootDir: string

    if (files.length === 0 && directories.length === 1) {
        const rootDirectory = directories[0]

        if (!rootDirectory) {
            return {
                ok: false,
                error: 'Uploaded zip archive was empty after extraction',
                code: 'EMPTY_ARCHIVE',
            }
        }

        repoRootDir = join(extractDir, rootDirectory.name)
    } else {
        repoRootDir = extractDir
    }

    return {
        ok: true,
        owner: 'uploaded',
        repo: repoName,
        ref: null,
        zipUrl: null,
        tempRootDir,
        zipFilePath,
        extractDir,
        repoRootDir,
    }
}
