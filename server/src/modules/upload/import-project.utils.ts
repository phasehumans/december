import { createHash } from 'node:crypto'
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'

import AdmZip from 'adm-zip'

export type ImportValidationFile = {
    absolutePath: string
    path: string
    size: number
    contentType: string
    sha256: string
}

export type ProjectDetection = {
    framework: string
    packageJson: Record<string, any>
}

export type ValidatedImportProject = {
    rootDir: string
    files: ImportValidationFile[]
    totalBytes: number
    detection: ProjectDetection
}

const MAX_ZIP_BYTES = 50 * 1024 * 1024
const MAX_UNCOMPRESSED_BYTES = 150 * 1024 * 1024
const MAX_FILES = 2500
const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_COMPRESSION_RATIO = 25
export const IMPORT_STAGING_DIR = '.phasehumans--imports'

const IGNORED_DIRS = new Set([
    '.git',
    'node_modules',
    'dist',
    'build',
    '.next',
    '.turbo',
    '.cache',
    'coverage',
    '__MACOSX',
])

const toWorkspacePath = (path: string) => path.split(sep).join('/')

export const importStagingRootDir = () => {
    const cwd = process.cwd()
    const repoRoot = basename(cwd) === 'server' ? dirname(cwd) : cwd

    return join(repoRoot, IMPORT_STAGING_DIR)
}

export const cleanupImportDir = async (path?: string | null) => {
    if (!path) return
    await rm(path, { recursive: true, force: true }).catch(() => undefined)
}

export const persistentImportSourceDir = ({
    userId,
    importId,
}: {
    userId: string
    importId: string
}) => join(importStagingRootDir(), userId, importId, 'source')

export const persistImportSourceLocally = async ({
    userId,
    importId,
    sourceDir,
}: {
    userId: string
    importId: string
    sourceDir: string
}) => {
    const targetDir = persistentImportSourceDir({ userId, importId })

    await rm(targetDir, { recursive: true, force: true })
    await mkdir(dirname(targetDir), { recursive: true })
    await cp(sourceDir, targetDir, {
        recursive: true,
        force: true,
        errorOnExist: false,
    })

    return targetDir
}

export const assertZipBufferIsSafe = (zipBuffer: Buffer) => {
    if (zipBuffer.byteLength > MAX_ZIP_BYTES) {
        throw new Error('Zip file is too large')
    }

    let zip: AdmZip

    try {
        zip = new AdmZip(zipBuffer)
    } catch {
        throw new Error('Uploaded zip file is corrupted')
    }

    const entries = zip.getEntries().filter((entry) => !entry.isDirectory)

    if (entries.length === 0) {
        throw new Error('Archive does not contain any files')
    }

    if (entries.length > MAX_FILES) {
        throw new Error('Archive contains too many files')
    }

    const uncompressedBytes = entries.reduce((sum, entry) => sum + (entry.header.size ?? 0), 0)

    if (uncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
        throw new Error('Archive expands to too much data')
    }

    if (
        zipBuffer.byteLength > 0 &&
        uncompressedBytes / zipBuffer.byteLength > MAX_COMPRESSION_RATIO
    ) {
        throw new Error('Archive compression ratio is too high')
    }
}

export const extractZipSafely = async (zipBuffer: Buffer, extractDir: string) => {
    assertZipBufferIsSafe(zipBuffer)
    const zip = new AdmZip(zipBuffer)
    const extractRoot = resolve(extractDir)

    await mkdir(extractRoot, { recursive: true })

    for (const entry of zip.getEntries()) {
        const normalizedEntryName = entry.entryName.replace(/\\/g, '/')

        if (
            !normalizedEntryName ||
            normalizedEntryName.startsWith('/') ||
            normalizedEntryName.includes('\0')
        ) {
            throw new Error('Archive contains an invalid file path')
        }

        const targetPath = resolve(extractRoot, normalizedEntryName)
        const targetRelative = relative(extractRoot, targetPath)

        if (
            targetRelative.startsWith('..') ||
            targetRelative === '' ||
            targetRelative.startsWith(`..${sep}`)
        ) {
            throw new Error('Archive contains unsafe file paths')
        }

        if (entry.isDirectory) {
            await mkdir(targetPath, { recursive: true })
            continue
        }

        if ((entry.header.size ?? 0) > MAX_FILE_BYTES) {
            throw new Error(`File is too large: ${normalizedEntryName}`)
        }

        await mkdir(dirname(targetPath), { recursive: true })
        await writeFile(targetPath, entry.getData())
    }
}

const guessContentType = (path: string) => {
    const lower = path.toLowerCase()
    if (lower.endsWith('.tsx')) return 'text/tsx; charset=utf-8'
    if (lower.endsWith('.ts')) return 'text/typescript; charset=utf-8'
    if (lower.endsWith('.jsx') || lower.endsWith('.js')) return 'text/javascript; charset=utf-8'
    if (lower.endsWith('.json')) return 'application/json; charset=utf-8'
    if (lower.endsWith('.css')) return 'text/css; charset=utf-8'
    if (lower.endsWith('.html')) return 'text/html; charset=utf-8'
    if (lower.endsWith('.md')) return 'text/markdown; charset=utf-8'
    if (lower.endsWith('.svg')) return 'image/svg+xml'
    if (lower.endsWith('.png')) return 'image/png'
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
    if (lower.endsWith('.webp')) return 'image/webp'
    if (lower.endsWith('.gif')) return 'image/gif'
    return 'application/octet-stream'
}

const detectFramework = (packageJson: Record<string, any>) => {
    const deps = {
        ...(packageJson.dependencies ?? {}),
        ...(packageJson.devDependencies ?? {}),
    }

    if (deps.vite || String(packageJson.scripts?.dev ?? '').includes('vite')) return 'vite'
    if (deps.react) return 'react'
    return 'bun'
}

const findProjectRoot = async (rootDir: string) => {
    const packagePath = join(rootDir, 'package.json')

    if (
        await stat(packagePath)
            .then((value) => value.isFile())
            .catch(() => false)
    ) {
        return rootDir
    }

    const entries = await readdir(rootDir, { withFileTypes: true })
    const directories = entries.filter(
        (entry) => entry.isDirectory() && !IGNORED_DIRS.has(entry.name)
    )

    if (directories.length === 1) {
        const nestedRoot = join(rootDir, directories[0]!.name)
        const nestedPackagePath = join(nestedRoot, 'package.json')

        if (
            await stat(nestedPackagePath)
                .then((value) => value.isFile())
                .catch(() => false)
        ) {
            return nestedRoot
        }
    }

    return rootDir
}

const collectFiles = async (rootDir: string) => {
    const files: ImportValidationFile[] = []
    let totalBytes = 0

    const walk = async (dir: string) => {
        const entries = await readdir(dir, { withFileTypes: true })

        for (const entry of entries) {
            if (entry.name.startsWith('.') && entry.name !== '.env.example') {
                if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue
            }

            if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) {
                continue
            }

            const absolutePath = join(dir, entry.name)

            if (entry.isDirectory()) {
                await walk(absolutePath)
                continue
            }

            if (!entry.isFile()) {
                continue
            }

            const fileStat = await stat(absolutePath)
            const workspacePath = toWorkspacePath(relative(rootDir, absolutePath))

            if (!workspacePath || workspacePath.startsWith('..')) {
                continue
            }

            if (fileStat.size > MAX_FILE_BYTES) {
                throw new Error(`File is too large: ${workspacePath}`)
            }

            totalBytes += fileStat.size

            if (totalBytes > MAX_UNCOMPRESSED_BYTES) {
                throw new Error('Project contains too much data')
            }

            if (files.length >= MAX_FILES) {
                throw new Error('Project contains too many files')
            }

            const content = await readFile(absolutePath)

            files.push({
                absolutePath,
                path: workspacePath,
                size: fileStat.size,
                contentType: guessContentType(workspacePath),
                sha256: createHash('sha256').update(content).digest('hex'),
            })
        }
    }

    await walk(rootDir)
    return { files, totalBytes }
}

export const validateImportProject = async (
    candidateRootDir: string
): Promise<ValidatedImportProject> => {
    const rootDir = await findProjectRoot(candidateRootDir)
    const packageJsonPath = join(rootDir, 'package.json')
    const indexHtmlPath = join(rootDir, 'index.html')
    const srcDir = join(rootDir, 'src')

    const [packageExists, indexExists, srcExists] = await Promise.all([
        stat(packageJsonPath)
            .then((value) => value.isFile())
            .catch(() => false),
        stat(indexHtmlPath)
            .then((value) => value.isFile())
            .catch(() => false),
        stat(srcDir)
            .then((value) => value.isDirectory())
            .catch(() => false),
    ])

    if (!packageExists || !indexExists || !srcExists) {
        throw new Error(
            'Unsupported project structure: expected package.json, index.html, and src/'
        )
    }

    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as Record<string, any>

    if (!packageJson.scripts?.dev) {
        throw new Error('Unsupported project structure: package.json must include a dev script')
    }

    const { files, totalBytes } = await collectFiles(rootDir)

    if (files.length === 0) {
        throw new Error('Project does not contain any importable files')
    }

    return {
        rootDir,
        files,
        totalBytes,
        detection: {
            framework: detectFramework(packageJson),
            packageJson,
        },
    }
}
