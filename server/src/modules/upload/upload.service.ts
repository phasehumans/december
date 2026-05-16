import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import { prisma } from '../../config/db'
import { publishPreviewManifest, type PreviewManifestFile } from '../../lib/preview-manifest'
import {
    deletePrefix,
    currentKey,
    importObjectKey,
    importPrefix,
    putBinaryFile,
    storageBucket,
    versionKey,
    versionPrefix,
} from '../../lib/project-storage'
import { runtimeService, type RuntimePreviewStatus } from '../runtime/runtime.service'

import { downloadGitHubRepoArchive } from './downloadzip'
import { extractUploadedZipArchive } from './extractzip'
import {
    cleanupImportDir,
    persistImportSourceLocally,
    validateImportProject,
    type ValidatedImportProject,
} from './import-project.utils'
import { parseGitHubRepoUrl, verifyGitHubRepoAccess } from './upload.utils'

type UploadRepo = {
    userId: string
    repoURL: string
}

type GithubRepo = {
    id: number
    name: string
    fullName: string
    private: boolean
    defaultBranch: string
    updatedAt: string
    htmlUrl: string
    cloneUrl: string
    owner: {
        login: string
        avatarUrl: string
    }
}

type UploadedZipFile = {
    originalname: string
    mimetype: string
    buffer: Buffer
}

type ImportFromZip = {
    userId: string
    zipFile: UploadedZipFile
}

type ImportSource = 'GITHUB' | 'ZIP'
type ImportStatus = 'PENDING' | 'VALIDATING' | 'UPLOADING' | 'STARTING_RUNTIME' | 'READY' | 'FAILED'

const MAX_UPLOAD_ZIP_BYTES = 50 * 1024 * 1024

const publicImportSelect = {
    id: true,
    sourceType: true,
    sourceUrl: true,
    sourceFileName: true,
    bucket: true,
    objectPrefix: true,
    status: true,
    framework: true,
    projectId: true,
    projectVersionId: true,
    previewUrl: true,
    errorMessage: true,
    errorsJson: true,
    attempts: true,
    createdAt: true,
    updatedAt: true,
} as const

const toErrorPayload = (error: unknown) => ({
    message: error instanceof Error ? error.message : 'Import failed',
})

const updateImportStatus = async ({
    importId,
    status,
    data,
}: {
    importId: string
    status: ImportStatus
    data?: Record<string, any>
}) => {
    return prisma.projectImport.update({
        where: { id: importId },
        data: {
            status,
            ...(data ?? {}),
        },
        select: publicImportSelect,
    })
}

const createImportRecord = async ({
    userId,
    sourceType,
    sourceUrl,
    sourceFileName,
}: {
    userId: string
    sourceType: ImportSource
    sourceUrl?: string | null
    sourceFileName?: string | null
}) => {
    return prisma.projectImport.create({
        data: {
            userId,
            sourceType,
            ...(sourceUrl ? { sourceUrl } : {}),
            ...(sourceFileName ? { sourceFileName } : {}),
        },
        select: publicImportSelect,
    })
}

const uploadValidatedProject = async ({
    projectId,
    versionId,
    project,
}: {
    projectId: string
    versionId: string
    project: ValidatedImportProject
}) => {
    const files: PreviewManifestFile[] = []

    for (const file of project.files) {
        const objectKey = versionKey(projectId, versionId, file.path)
        const content = await readFile(file.absolutePath)

        await Promise.all([
            putBinaryFile({
                key: objectKey,
                content,
                contentType: file.contentType,
            }),
            putBinaryFile({
                key: currentKey(projectId, file.path),
                content,
                contentType: file.contentType,
            }),
        ])

        files.push({
            path: file.path,
            objectKey,
            size: file.size,
            contentType: file.contentType,
            sha256: file.sha256,
        })
    }

    return files
}

const uploadImportSourceFiles = async ({
    userId,
    importId,
    project,
}: {
    userId: string
    importId: string
    project: ValidatedImportProject
}) => {
    await Promise.all(
        project.files.map(async (file) => {
            const content = await readFile(file.absolutePath)

            await putBinaryFile({
                key: importObjectKey(userId, importId, file.path),
                content,
                contentType: file.contentType,
            })
        })
    )
}

const createImportedProjectVersion = async ({
    projectId,
    versionId,
    userId,
    project,
    manifestFiles,
    sourceLabel,
}: {
    projectId: string
    versionId: string
    userId: string
    project: ValidatedImportProject
    manifestFiles: PreviewManifestFile[]
    sourceLabel: string
}) => {
    const displayName =
        sourceLabel
            .trim()
            .replace(/\.zip$/i, '')
            .slice(0, 40) || 'Imported project'

    const createdProject = await prisma.project.create({
        data: {
            id: projectId,
            name: displayName.slice(0, 20),
            description: `Imported ${project.detection.framework} project`.slice(0, 30),
            prompt: `Imported from ${sourceLabel}`,
            projectStatus: 'READY',
            userId,
            versionCount: 1,
            versions: {
                create: {
                    id: versionId,
                    versionNumber: 1,
                    label: 'import',
                    sourcePrompt: `Imported from ${sourceLabel}`,
                    summary: `Imported ${project.files.length} files`,
                    status: 'READY',
                    objectStoragePrefix: versionPrefix(projectId, versionId),
                    manifestJson: manifestFiles.map((file) => ({
                        path: file.path,
                        key: file.objectKey,
                        contentType: file.contentType,
                        size: file.size,
                    })),
                },
            },
        },
        select: {
            id: true,
        },
    })

    await prisma.project.update({
        where: { id: createdProject.id },
        data: {
            currentVersionId: versionId,
        },
        select: { id: true },
    })

    return {
        projectId,
        versionId,
    }
}

const startRuntimeForImport = async ({
    userId,
    projectId,
    versionId,
}: {
    userId: string
    projectId: string
    versionId: string
}) => {
    const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Runtime start timed out')), 60_000)
    })

    return Promise.race([
        runtimeService.startPreview({
            userId,
            projectId,
            versionId,
        }),
        timeout,
    ])
}

const finalizeImportProject = async ({
    importId,
    userId,
    validatedProject,
    sourceLabel,
}: {
    importId: string
    userId: string
    validatedProject: ValidatedImportProject
    sourceLabel: string
}) => {
    await updateImportStatus({
        importId,
        status: 'UPLOADING',
        data: {
            bucket: storageBucket(),
            framework: validatedProject.detection.framework,
            objectPrefix: importPrefix(userId, importId),
        },
    })

    const projectId = randomUUID()
    const versionId = randomUUID()

    await uploadImportSourceFiles({
        userId,
        importId,
        project: validatedProject,
    })

    await updateImportStatus({
        importId,
        status: 'UPLOADING',
        data: {
            objectPrefix: versionPrefix(projectId, versionId),
        },
    })

    const uploadedFiles = await uploadValidatedProject({
        projectId,
        versionId,
        project: validatedProject,
    })

    await createImportedProjectVersion({
        projectId,
        versionId,
        userId,
        project: validatedProject,
        manifestFiles: uploadedFiles,
        sourceLabel,
    })

    await publishPreviewManifest({
        manifestVersion: 'import',
        projectId,
        projectVersionId: versionId,
        publishedAt: new Date().toISOString(),
        runnable: true,
        files: uploadedFiles,
    })

    await updateImportStatus({
        importId,
        status: 'STARTING_RUNTIME',
        data: {
            projectId,
            projectVersionId: versionId,
        },
    })

    const preview = await startRuntimeForImport({
        userId,
        projectId,
        versionId,
    })

    await updateImportStatus({
        importId,
        status:
            preview.backendStatus === 'failed'
                ? 'FAILED'
                : preview.backendStatus === 'ready'
                  ? 'READY'
                  : 'STARTING_RUNTIME',
        data: {
            previewUrl: preview.previewUrl ?? null,
            ...(preview.lastError
                ? { errorMessage: preview.lastError.message, errorsJson: preview.lastError }
                : {}),
        },
    })
}

const failImport = async (importId: string, error: unknown) => {
    const importRecord = await prisma.projectImport
        .findUnique({
            where: { id: importId },
            select: {
                objectPrefix: true,
                projectId: true,
            },
        })
        .catch(() => null)

    if (importRecord?.objectPrefix && !importRecord.projectId) {
        await deletePrefix(importRecord.objectPrefix).catch(() => undefined)
    }

    await updateImportStatus({
        importId,
        status: 'FAILED',
        data: {
            errorMessage: error instanceof Error ? error.message : 'Import failed',
            errorsJson: toErrorPayload(error),
        },
    }).catch(() => undefined)
}

const processGithubImport = async ({
    importId,
    userId,
    owner,
    repo,
    token,
}: {
    importId: string
    userId: string
    owner: string
    repo: string
    token: string
}) => {
    let tempRootDir: string | null = null

    try {
        await prisma.projectImport.update({
            where: { id: importId },
            data: {
                attempts: { increment: 1 },
            },
        })

        await updateImportStatus({ importId, status: 'VALIDATING' })

        const repoAccessInfo = await verifyGitHubRepoAccess(owner, repo, token)

        if (!repoAccessInfo.ok) {
            throw new Error(repoAccessInfo.error)
        }

        if (repoAccessInfo.disabled) {
            throw new Error('Repository is disabled')
        }

        const ref = repoAccessInfo.defaultBranch ?? 'main'
        const downloaded = await downloadGitHubRepoArchive(
            repoAccessInfo.owner,
            repoAccessInfo.repo,
            token,
            ref
        )

        if (!downloaded.ok) {
            throw new Error(downloaded.error)
        }

        tempRootDir = downloaded.tempRootDir
        const validatedProject = await validateImportProject(downloaded.repoRootDir)
        await persistImportSourceLocally({
            userId,
            importId,
            sourceDir: validatedProject.rootDir,
        })

        await finalizeImportProject({
            importId,
            userId,
            validatedProject,
            sourceLabel: repoAccessInfo.normalizedUrl,
        })
    } catch (error) {
        await failImport(importId, error)
    } finally {
        await cleanupImportDir(tempRootDir)
    }
}

const processZipImport = async ({
    importId,
    userId,
    zipFile,
}: {
    importId: string
    userId: string
    zipFile: UploadedZipFile
}) => {
    let tempRootDir: string | null = null

    try {
        await prisma.projectImport.update({
            where: { id: importId },
            data: {
                attempts: { increment: 1 },
            },
        })

        await updateImportStatus({ importId, status: 'VALIDATING' })

        const extracted = await extractUploadedZipArchive(zipFile)

        if (!extracted.ok) {
            throw new Error(extracted.error)
        }

        tempRootDir = extracted.tempRootDir
        const validatedProject = await validateImportProject(extracted.repoRootDir)
        await persistImportSourceLocally({
            userId,
            importId,
            sourceDir: validatedProject.rootDir,
        })

        await finalizeImportProject({
            importId,
            userId,
            validatedProject,
            sourceLabel: zipFile.originalname,
        })
    } catch (error) {
        await failImport(importId, error)
    } finally {
        await cleanupImportDir(tempRootDir)
    }
}

const listGithubRepos = async (data: string): Promise<GithubRepo[]> => {
    const user = await prisma.user.findUnique({
        where: {
            id: data,
        },
        select: {
            githubToken: true,
            githubUsername: true,
            githubConnected: true,
        },
    })

    if (!user) {
        throw new Error('user not found')
    }

    if (user.githubConnected === false) {
        throw new Error('github is not connected')
    }

    if (user.githubToken === undefined) {
        throw new Error('github access token not found')
    }

    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${user.githubToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch GitHub repos: ${errorText}`)
    }

    const repos = (await response.json()) as any[]

    return repos.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        defaultBranch: repo.default_branch,
        updatedAt: repo.updated_at,
        htmlUrl: repo.html_url,
        cloneUrl: repo.clone_url,
        owner: {
            login: repo.owner?.login,
            avatarUrl: repo.owner?.avatar_url,
        },
    }))
}

const importFromGithub = async (data: UploadRepo) => {
    const { userId, repoURL } = data
    const parseData = parseGitHubRepoUrl(repoURL)

    if (!parseData.ok) {
        throw new Error(parseData.error)
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            githubToken: true,
        },
    })

    if (!user) {
        throw new Error('user not found')
    }

    if (!user.githubToken) {
        throw new Error('GitHub access token not found')
    }

    const importRecord = await createImportRecord({
        userId,
        sourceType: 'GITHUB',
        sourceUrl: parseData.normalizedUrl,
    })

    void processGithubImport({
        importId: importRecord.id,
        userId,
        owner: parseData.owner,
        repo: parseData.repo,
        token: user.githubToken,
    })

    return importRecord
}

const importFromZip = async (data: ImportFromZip) => {
    const { userId, zipFile } = data

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
    })

    if (!user) {
        throw new Error('user not found')
    }

    const isZip =
        zipFile.mimetype === 'application/zip' ||
        zipFile.mimetype === 'application/x-zip-compressed' ||
        zipFile.originalname.toLowerCase().endsWith('.zip')

    if (!isZip) {
        throw new Error('Only zip files are allowed')
    }

    if (zipFile.buffer.byteLength > MAX_UPLOAD_ZIP_BYTES) {
        throw new Error('Zip file is too large')
    }

    const importRecord = await createImportRecord({
        userId,
        sourceType: 'ZIP',
        sourceFileName: zipFile.originalname,
    })

    void processZipImport({
        importId: importRecord.id,
        userId,
        zipFile,
    })

    return importRecord
}

const getImportStatus = async ({ userId, importId }: { userId: string; importId: string }) => {
    const importRecord = await prisma.projectImport.findFirst({
        where: {
            id: importId,
            userId,
        },
        select: publicImportSelect,
    })

    if (!importRecord) {
        throw new Error('import not found')
    }

    let runtimeStatus: RuntimePreviewStatus | null = null

    if (importRecord.projectId) {
        try {
            runtimeStatus = await runtimeService.getPreviewStatus({
                userId,
                previewId: importRecord.projectId,
            })

            if (
                importRecord.status === 'STARTING_RUNTIME' &&
                runtimeStatus.backendStatus === 'ready'
            ) {
                await updateImportStatus({
                    importId,
                    status: 'READY',
                    data: {
                        previewUrl: runtimeStatus.previewUrl ?? null,
                    },
                })
            }

            if (
                importRecord.status !== 'FAILED' &&
                runtimeStatus.backendStatus === 'failed' &&
                runtimeStatus.lastError
            ) {
                await updateImportStatus({
                    importId,
                    status: 'FAILED',
                    data: {
                        errorMessage: runtimeStatus.lastError.message,
                        errorsJson: runtimeStatus.lastError,
                    },
                })
            }
        } catch {
            runtimeStatus = null
        }
    }

    return {
        ...importRecord,
        runtimeStatus,
    }
}

const retryImport = async ({ userId, importId }: { userId: string; importId: string }) => {
    const importRecord = await prisma.projectImport.findFirst({
        where: {
            id: importId,
            userId,
        },
        select: publicImportSelect,
    })

    if (!importRecord) {
        throw new Error('import not found')
    }

    if (importRecord.status !== 'FAILED') {
        throw new Error('Only failed imports can be retried')
    }

    if (importRecord.sourceType !== 'GITHUB' || !importRecord.sourceUrl) {
        throw new Error('Uploaded zip imports cannot be retried after cleanup')
    }

    const parseData = parseGitHubRepoUrl(importRecord.sourceUrl)

    if (!parseData.ok) {
        throw new Error(parseData.error)
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            githubToken: true,
        },
    })

    if (!user?.githubToken) {
        throw new Error('GitHub access token not found')
    }

    const retryRecord = await updateImportStatus({
        importId,
        status: 'PENDING',
        data: {
            errorMessage: null,
            errorsJson: undefined,
        },
    })

    void processGithubImport({
        importId,
        userId,
        owner: parseData.owner,
        repo: parseData.repo,
        token: user.githubToken,
    })

    return retryRecord
}

export const uploadService = {
    listGithubRepos,
    importFromGithub,
    importFromZip,
    getImportStatus,
    retryImport,
}
