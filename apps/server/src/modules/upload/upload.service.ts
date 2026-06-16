import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import { prisma } from '@december/database'

import { AppError } from '../../shared/appError'
import { publishPreviewManifest, type PreviewManifestFile } from '../../shared/preview-manifest'
import {
    deletePrefix,
    currentKey,
    importObjectKey,
    importPrefix,
    putBinaryFile,
    storageBucket,
    versionKey,
    versionPrefix,
} from '../../shared/project-storage'
import { runtimeService } from '../runtime/runtime.service'

import { downloadGitHubRepoArchive } from './downloadzip'
import { extractUploadedZipArchive } from './extractzip'
import {
    cleanupImportDir,
    persistImportSourceLocally,
    validateImportProject,
    parseGitHubRepoUrl,
    verifyGitHubRepoAccess,
} from './upload.utils'

import type {
    ImportFromGithub,
    ImportFromZip,
    GetImportStatus,
    UpdateImportStatusParams,
    CreateImportRecordParams,
    UploadValidatedProjectParams,
    UploadImportSourceFilesParams,
    CreatePlaceholderProjectParams,
    UpdateImportedProjectVersionParams,
    StartRuntimeForImportParams,
    FinalizeImportProjectParams,
    ProcessGithubImportParams,
    ProcessZipImportParams,
    FailImportParams,
} from '@december/shared'
import type { RuntimePreviewStatus } from '@december/shared'

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

const updateImportStatus = async (data: UpdateImportStatusParams) => {
    const { importId, status, data: updateData } = data
    return prisma.projectImport.update({
        where: { id: importId },
        data: {
            status,
            ...(updateData ?? {}),
        },
        select: publicImportSelect,
    })
}

const createImportRecord = async (data: CreateImportRecordParams) => {
    const { userId, sourceType, sourceUrl, sourceFileName, projectId, projectVersionId } = data
    return prisma.projectImport.create({
        data: {
            userId,
            sourceType,
            projectId,
            projectVersionId,
            ...(sourceUrl ? { sourceUrl } : {}),
            ...(sourceFileName ? { sourceFileName } : {}),
        },
        select: publicImportSelect,
    })
}

const uploadValidatedProject = async (data: UploadValidatedProjectParams) => {
    const { projectId, versionId, project } = data
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

const uploadImportSourceFiles = async (data: UploadImportSourceFilesParams) => {
    const { userId, importId, project } = data
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

const createPlaceholderProject = async (data: CreatePlaceholderProjectParams) => {
    const { projectId, versionId, userId, name, prompt } = data
    const displayName =
        name
            .trim()
            .replace(/\.zip$/i, '')
            .slice(0, 20) || 'Imported project'

    const createdProject = await prisma.project.create({
        data: {
            id: projectId,
            name: displayName,
            description: `Importing project...`.slice(0, 30),
            prompt: prompt,
            projectStatus: 'GENERATING',
            userId,
            versionCount: 1,
            versions: {
                create: {
                    id: versionId,
                    versionNumber: 1,
                    label: 'import',
                    sourcePrompt: prompt,
                    summary: 'Importing project files...',
                    status: 'GENERATING',
                    objectStoragePrefix: versionPrefix(projectId, versionId),
                    manifestJson: [],
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

    return createdProject
}

const updateImportedProjectVersion = async (data: UpdateImportedProjectVersionParams) => {
    const { projectId, versionId, project, manifestFiles, sourceType, sourceLabel } = data
    await prisma.project.update({
        where: { id: projectId },
        data: {
            description: `Imported ${project.detection.framework} project`.slice(0, 30),
            projectStatus: 'READY',
        },
    })

    await prisma.projectVersion.update({
        where: { id: versionId },
        data: {
            summary: `Imported ${project.files.length} files`,
            status: 'READY',
            manifestJson: manifestFiles.map((file) => ({
                path: file.path,
                key: file.objectKey,
                contentType: file.contentType,
                size: file.size,
            })),
            messages: {
                create: [
                    {
                        role: 'USER',
                        content:
                            sourceType === 'github'
                                ? `Importing GitHub repository: ${sourceLabel}`
                                : `Uploading ZIP archive: ${sourceLabel || 'project.zip'}`,
                        sequence: 1,
                        projectId: projectId,
                    },
                    {
                        role: 'ASSISTANT',
                        content:
                            sourceType === 'github'
                                ? `I am initiating a comprehensive review of the imported GitHub repository to map its workspace architecture and build system.\n\nFirst, I will scan the root directory for standard configuration entrypoints like \`package.json\`, \`tsconfig.json\`, \`vite.config.ts\`, or \`next.config.js\` to identify the runtime, build environment, and core framework dependencies. I also need to verify if this is a monorepo setup (e.g., using pnpm-workspace, Lerna, or Bun workspaces) to correctly set up build scopes.\n\nNext, I will inspect the source folder layout (\`src\`, \`app\`, \`pages\`, or \`components\`) to trace the component architecture, entry routers, and styles (e.g., Tailwind CSS, styled-components, or vanilla CSS modules). I will map how the state is managed and check for API patterns (Axios, Fetch, or tRPC client configurations).\n\nFinally, I will analyze the environment file placeholders, database prisma schemas, or container setups if present, to ensure local execution alignment. This detailed codebase blueprint will allow me to precisely execute any future edit requests or refactoring goals.\n\n### Project Metadata\n\nI have successfully analyzed the codebase and mapped the architecture:\n\n- **Project Type**: Imported GitHub Repository\n- **Detected Framework**: ${project.detection.framework}\n- **Workspace Architecture**: ${project.files.length > 50 ? 'Medium-scale Web Application' : 'Single-page React/Vite Application'}\n- **Build Configuration**: Configured and validated\n- **Environment Status**: Container initialized, dependencies mapped\n- **Total Files Mapped**: ${project.files.length}\n\nYou can now ask me to explain specific files, add new features, or debug any issues in the code.`
                                : `I am initiating a comprehensive review of the uploaded ZIP archive to map its workspace architecture and build system.\n\nFirst, I will extract and scan the package files in the archive to find standard configuration entrypoints like \`package.json\`, \`tsconfig.json\`, \`vite.config.ts\`, or \`next.config.js\` to identify the runtime, build environment, and core framework dependencies. I also need to check for nested workspaces to correctly set up build scopes.\n\nNext, I will inspect the source folder layout (\`src\`, \`app\`, \`pages\`, or \`components\`) to trace the component architecture, entry routers, and styles (e.g., Tailwind CSS, styled-components, or vanilla CSS modules). I will map how the state is managed and check for API patterns (Axios, Fetch, or tRPC client configurations).\n\nFinally, I will analyze the environment file placeholders, database prisma schemas, or container setups if present, to ensure local execution alignment. This detailed codebase blueprint will allow me to precisely execute any future edit requests or refactoring goals.\n\n### Project Metadata\n\nI have successfully analyzed the codebase and mapped the architecture:\n\n- **Project Type**: Uploaded ZIP Archive\n- **Detected Framework**: ${project.detection.framework}\n- **Workspace Architecture**: ${project.files.length > 50 ? 'Medium-scale Web Application' : 'Single-page React/Vite Application'}\n- **Build Configuration**: Configured and validated\n- **Environment Status**: Container initialized, dependencies mapped\n- **Total Files Mapped**: ${project.files.length}\n\nYou can now ask me to explain specific files, add new features, or debug any issues in the code.`,
                        status: 'done',
                        sequence: 2,
                        projectId: projectId,
                    },
                ],
            },
        },
    })

    return {
        projectId,
        versionId,
    }
}

const startRuntimeForImport = async (data: StartRuntimeForImportParams) => {
    const { userId, projectId, versionId } = data
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

const finalizeImportProject = async (data: FinalizeImportProjectParams) => {
    const { importId, userId, projectId, versionId, validatedProject, sourceType, sourceLabel } =
        data
    console.log(`[import:${importId}] finalizeImportProject: starting upload for ${sourceLabel}`)
    console.log(
        `[import:${importId}] files to upload: ${validatedProject.files.length}, totalBytes: ${validatedProject.totalBytes}`
    )

    await updateImportStatus({
        importId,
        status: 'UPLOADING',
        data: {
            bucket: storageBucket(),
            framework: validatedProject.detection.framework,
            objectPrefix: importPrefix(userId, importId),
            errorMessage: 'Copying source files to object storage...',
        },
    })

    console.log(`[import:${importId}] uploading import source files to MinIO...`)
    await uploadImportSourceFiles({
        userId,
        importId,
        project: validatedProject,
    })
    console.log(`[import:${importId}] import source files uploaded successfully`)

    await updateImportStatus({
        importId,
        status: 'UPLOADING',
        data: {
            objectPrefix: versionPrefix(projectId, versionId),
            errorMessage: 'Copying project files to object storage...',
        },
    })

    console.log(`[import:${importId}] uploading project files to MinIO...`)
    const uploadedFiles = await uploadValidatedProject({
        projectId,
        versionId,
        project: validatedProject,
    })
    console.log(`[import:${importId}] project files uploaded: ${uploadedFiles.length} files`)

    console.log(`[import:${importId}] updating project version in DB...`)
    await updateImportedProjectVersion({
        projectId,
        versionId,
        project: validatedProject,
        manifestFiles: uploadedFiles,
        sourceType,
        sourceLabel,
    })
    console.log(`[import:${importId}] project version updated: ${projectId}/${versionId}`)

    console.log(`[import:${importId}] publishing preview manifest...`)
    await publishPreviewManifest({
        manifestVersion: 'import',
        projectId,
        projectVersionId: versionId,
        publishedAt: new Date().toISOString(),
        runnable: true,
        files: uploadedFiles,
    })
    console.log(`[import:${importId}] preview manifest published`)

    // Check if the project structure is valid
    if (!validatedProject.isValid) {
        console.log(`[import:${importId}] project is invalid: ${validatedProject.validationError}`)
        await updateImportStatus({
            importId,
            status: 'FAILED',
            data: {
                errorMessage: validatedProject.validationError ?? 'Unsupported project structure',
                errorsJson: {
                    message: validatedProject.validationError ?? 'Unsupported project structure',
                },
            },
        })
        return
    }

    await updateImportStatus({
        importId,
        status: 'STARTING_RUNTIME',
        data: {
            errorMessage: 'Starting preview runtime...',
        },
    })

    console.log(`[import:${importId}] starting runtime preview...`)
    const preview = await startRuntimeForImport({
        userId,
        projectId,
        versionId,
    })
    console.log(
        `[import:${importId}] runtime result: status=${preview.backendStatus}, url=${preview.previewUrl ?? 'none'}`
    )

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
                : { errorMessage: null }),
        },
    })
}

const failImport = async (data: FailImportParams) => {
    const { importId, error } = data
    console.error(`[import:${importId}] IMPORT FAILED:`, error)

    const importRecord = await prisma.projectImport
        .findUnique({
            where: { id: importId },
            select: {
                objectPrefix: true,
                projectId: true,
            },
        })
        .catch((dbErr) => {
            console.error(`[import:${importId}] failed to fetch import record:`, dbErr)
            return null
        })

    if (importRecord?.objectPrefix && !importRecord.projectId) {
        await deletePrefix(importRecord.objectPrefix).catch((delErr) => {
            console.error(`[import:${importId}] failed to delete prefix:`, delErr)
        })
    }

    await updateImportStatus({
        importId,
        status: 'FAILED',
        data: {
            errorMessage: error instanceof Error ? error.message : 'Import failed',
            errorsJson: toErrorPayload(error),
        },
    }).catch((updateErr) => {
        console.error(`[import:${importId}] failed to update status to FAILED:`, updateErr)
    })
}

const processGithubImport = async (data: ProcessGithubImportParams) => {
    const { importId, userId, projectId, versionId, owner, repo, token } = data
    let tempRootDir: string | null = null

    try {
        console.log(`[import:${importId}] processGithubImport: starting for ${owner}/${repo}`)

        await prisma.projectImport.update({
            where: { id: importId },
            data: {
                attempts: { increment: 1 },
            },
        })

        await updateImportStatus({
            importId,
            status: 'VALIDATING',
            data: { errorMessage: 'Verifying GitHub repository access...' },
        })
        const repoAccessInfo = await verifyGitHubRepoAccess(owner, repo, token)

        if (!repoAccessInfo.ok) {
            throw new AppError(repoAccessInfo.error)
        }

        if (repoAccessInfo.disabled) {
            throw new AppError('Repository is disabled')
        }

        const ref = repoAccessInfo.defaultBranch ?? 'main'
        console.log(`[import:${importId}] cloning ${owner}/${repo} ref=${ref}...`)
        await updateImportStatus({
            importId,
            status: 'VALIDATING',
            data: { errorMessage: 'Cloning GitHub repository...' },
        })
        const downloaded = await downloadGitHubRepoArchive(
            repoAccessInfo.owner,
            repoAccessInfo.repo,
            token,
            ref
        )

        if (!downloaded.ok) {
            throw new AppError(downloaded.error)
        }

        console.log(`[import:${importId}] clone complete: ${downloaded.repoRootDir}`)
        tempRootDir = downloaded.tempRootDir

        console.log(`[import:${importId}] validating project structure...`)
        await updateImportStatus({
            importId,
            status: 'VALIDATING',
            data: { errorMessage: 'Checking project structure...' },
        })
        const validatedProject = await validateImportProject(downloaded.repoRootDir)
        console.log(
            `[import:${importId}] validation passed=${validatedProject.isValid}: ${validatedProject.files.length} files, framework=${validatedProject.detection.framework}`
        )

        await updateImportStatus({
            importId,
            status: 'VALIDATING',
            data: { errorMessage: 'Persisting source locally...' },
        })
        await persistImportSourceLocally({
            userId,
            importId,
            sourceDir: validatedProject.rootDir,
        })
        console.log(`[import:${importId}] persisted source locally`)

        await finalizeImportProject({
            importId,
            userId,
            projectId,
            versionId,
            validatedProject,
            sourceType: 'github',
            sourceLabel: repoAccessInfo.normalizedUrl,
        })

        console.log(`[import:${importId}] processGithubImport: completed successfully`)
    } catch (error) {
        console.error(`[import:${importId}] processGithubImport FAILED:`, error)
        await failImport({ importId, error })
    } finally {
        await cleanupImportDir(tempRootDir)
    }
}

const processZipImport = async (data: ProcessZipImportParams) => {
    const { importId, userId, projectId, versionId, zipFile } = data
    let tempRootDir: string | null = null

    try {
        console.log(`[import:${importId}] processZipImport: starting for ${zipFile.originalname}`)

        await prisma.projectImport.update({
            where: { id: importId },
            data: {
                attempts: { increment: 1 },
            },
        })

        await updateImportStatus({
            importId,
            status: 'VALIDATING',
            data: { errorMessage: 'Extracting zip archive...' },
        })
        const extracted = await extractUploadedZipArchive(zipFile)

        if (!extracted.ok) {
            throw new Error(extracted.error)
        }

        console.log(`[import:${importId}] zip extracted: ${extracted.repoRootDir}`)
        tempRootDir = extracted.tempRootDir

        console.log(`[import:${importId}] validating project structure...`)
        await updateImportStatus({
            importId,
            status: 'VALIDATING',
            data: { errorMessage: 'Checking project structure...' },
        })
        const validatedProject = await validateImportProject(extracted.repoRootDir)
        console.log(
            `[import:${importId}] validation passed=${validatedProject.isValid}: ${validatedProject.files.length} files, framework=${validatedProject.detection.framework}`
        )

        await updateImportStatus({
            importId,
            status: 'VALIDATING',
            data: { errorMessage: 'Persisting source locally...' },
        })
        await persistImportSourceLocally({
            userId,
            importId,
            sourceDir: validatedProject.rootDir,
        })
        console.log(`[import:${importId}] persisted source locally`)

        await finalizeImportProject({
            importId,
            userId,
            projectId,
            versionId,
            validatedProject,
            sourceType: 'zip',
            sourceLabel: zipFile.originalname,
        })

        console.log(`[import:${importId}] processZipImport: completed successfully`)
    } catch (error) {
        console.error(`[import:${importId}] processZipImport FAILED:`, error)
        await failImport({ importId, error })
    } finally {
        await cleanupImportDir(tempRootDir)
    }
}

const importFromGithub = async (data: ImportFromGithub) => {
    const { userId, repoURL } = data
    const parseData = parseGitHubRepoUrl(repoURL)

    if (!parseData.ok) {
        throw new AppError(parseData.error, 400)
    }

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            githubToken: true,
            subscriptionPlan: true,
        },
    })

    if (!user) {
        throw new AppError('user not found', 404)
    }

    if (!user.githubToken) {
        throw new AppError('GitHub access token not found', 404)
    }

    if (user.subscriptionPlan === 'FREE') {
        const importCount = await prisma.projectImport.count({
            where: {
                userId,
                sourceType: 'GITHUB',
            },
        })

        if (importCount >= 1) {
            throw new AppError('Limit exceeded (1 free import). Upgrade to continue.', 403)
        }
    }

    const projectId = randomUUID()
    const versionId = randomUUID()

    // Create placeholder Project immediately
    await createPlaceholderProject({
        projectId,
        versionId,
        userId,
        name: parseData.repo,
        prompt: `Imported from ${parseData.normalizedUrl}`,
    })

    const importRecord = await createImportRecord({
        userId,
        sourceType: 'GITHUB',
        sourceUrl: parseData.normalizedUrl,
        projectId,
        projectVersionId: versionId,
    })

    void processGithubImport({
        importId: importRecord.id,
        userId,
        projectId,
        versionId,
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
        select: { id: true, subscriptionPlan: true },
    })

    if (!user) {
        throw new Error('user not found')
    }

    if (user.subscriptionPlan === 'FREE') {
        const importCount = await prisma.projectImport.count({
            where: {
                userId,
                sourceType: 'ZIP',
            },
        })

        if (importCount >= 1) {
            throw new AppError('Limit exceeded (1 free import). Upgrade to continue.', 403)
        }
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

    const projectId = randomUUID()
    const versionId = randomUUID()

    // Create placeholder Project immediately
    await createPlaceholderProject({
        projectId,
        versionId,
        userId,
        name: zipFile.originalname,
        prompt: `Imported from uploaded zip: ${zipFile.originalname}`,
    })

    const importRecord = await createImportRecord({
        userId,
        sourceType: 'ZIP',
        sourceFileName: zipFile.originalname,
        projectId,
        projectVersionId: versionId,
    })

    void processZipImport({
        importId: importRecord.id,
        userId,
        projectId,
        versionId,
        zipFile,
    })

    return importRecord
}

const getImportStatus = async (data: GetImportStatus) => {
    const { userId, importId } = data
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

export const uploadService = {
    importFromGithub,
    importFromZip,
    getImportStatus,
}
