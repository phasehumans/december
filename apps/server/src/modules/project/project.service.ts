import crypto from 'crypto'

import { AppError } from '../../shared/appError'
import {
    deletePrefix,
    projectPrefix,
    getTextFile,
    versionKey,
    currentKey,
    copyObject,
} from '../../shared/project-storage'
import { hydrateCanvasDocument, persistCanvasDocument } from '../canvas/canvas.utils'

import { getIO } from '../../socket'
import { publishEvent } from '@december/shared'
import { Queue } from 'bullmq'
import Redis from 'ioredis'

import { projectRepository } from './project.repository'
import { parseStoredProjectFiles, mapVersionSummary } from './project.utils'

import type {
    GetAllProjects,
    GetProject,
    CreateProject,
    RenameProject,
    UpdateGeneralSettings,
    DeleteProject,
    DuplicateProject,
    ShareProject,
    ToggleStarProject,
    StoredProjectFile,
    CopyProjectVersionsAndMessages,
    GetCollaborators,
    AddCollaborator,
    RemoveCollaborator,
} from './project.types'

// loads code files from objstore to memeory
export const loadGeneratedFilesFromManifest = async (manifest: StoredProjectFile[]) => {
    const files = await Promise.all(
        manifest.map(async (file) => {
            const isBinary =
                file.contentType &&
                !file.contentType.startsWith('text/') &&
                !file.contentType.includes('json') &&
                !file.contentType.includes('javascript') &&
                !file.contentType.includes('typescript') &&
                !file.contentType.includes('xml')
            if (isBinary) {
                return [file.path, ''] as const
            }
            try {
                const content = await getTextFile(file.key)
                return [file.path, content ?? ''] as const
            } catch (err) {
                console.error(`Failed to load file content for ${file.path} (${file.key}):`, err)
                return [file.path, ''] as const
            }
        })
    )

    return Object.fromEntries(files)
}

// remix and duplicate used same copy fn
export const copyProjectVersionsAndMessages = async (data: CopyProjectVersionsAndMessages) => {
    const { sourceProjectId, newProjectId, newUserId, sourceCurrentVersionId } = data

    // find the current version (or latest version if currentVersionId is not set)
    const version = await projectRepository.findFirstVersion(
        sourceProjectId,
        sourceCurrentVersionId ?? undefined
    )

    if (!version) {
        return {
            newCurrentVersionId: null,
            versionCount: 0,
        }
    }

    const newVersionId = crypto.randomUUID()
    const manifest = parseStoredProjectFiles(version.manifestJson)
    const newManifest: any[] = []

    for (const file of manifest) {
        const newVersionFileKey = versionKey(newProjectId, newVersionId, file.path)
        await copyObject({ sourceKey: file.key, destinationKey: newVersionFileKey })

        const newCurrentFileKey = currentKey(newProjectId, file.path)
        await copyObject({ sourceKey: file.key, destinationKey: newCurrentFileKey })

        newManifest.push({
            path: file.path,
            key: newVersionFileKey,
            size: file.size,
            ...(file.contentType ? { contentType: file.contentType } : {}),
        })
    }

    const hydratedCanvasState = await hydrateCanvasDocument({
        canvasState: version.canvasStateJson,
        canvasAssetManifest: version.canvasAssetManifestJson,
    })
    const persistedCanvas = await persistCanvasDocument({
        projectId: newProjectId,
        userId: newUserId,
        versionId: newVersionId,
        canvasState: hydratedCanvasState,
    })

    await projectRepository.createVersion({
        id: newVersionId,
        projectId: newProjectId,
        versionNumber: 1,
        label: 'v1',
        sourcePrompt: version.sourcePrompt,
        summary: version.summary ?? undefined,
        status: version.status,
        objectStoragePrefix: `projects/${newProjectId}/previous-version/${newVersionId}`,
        manifestJson: newManifest,
        canvasStateJson: persistedCanvas.canvasStateJson as any,
        canvasAssetManifestJson: persistedCanvas.canvasAssetManifestJson as any,
        isDatabaseEnabled: version.isDatabaseEnabled,
        databaseUrl: version.databaseUrl,
        ...(version.intentJson !== null ? { intentJson: version.intentJson as any } : {}),
        ...(version.planJson !== null ? { planJson: version.planJson as any } : {}),
    })

    await projectRepository.updateProjectVersionCount(newProjectId, newVersionId, 1)

    return {
        newCurrentVersionId: newVersionId,
        versionCount: 1,
    }
}

const getAllProjects = async (data: GetAllProjects) => {
    const { userId } = data

    const projects = await projectRepository.findManyProjects(userId)

    return projects
}

const getProjectById = async (data: GetProject) => {
    const { userId, projectId, versionId } = data

    const project = await projectRepository.findProjectById(projectId, userId)

    if (!project) {
        throw new AppError('project not found', 404)
    }

    const versions = await projectRepository.findManyVersions(project.id)

    // provided version on newest version [0]
    const selectedVersionId = versionId ?? versions[0]?.id ?? null

    const activeVersion = selectedVersionId
        ? await projectRepository.findVersionById(selectedVersionId, project.id)
        : null

    if (selectedVersionId && !activeVersion) {
        throw new AppError('project version not found', 404)
    }

    const generatedFiles = activeVersion
        ? await loadGeneratedFilesFromManifest(parseStoredProjectFiles(activeVersion.manifestJson))
        : {}

    // reconstrcut visual builder
    const canvasState = activeVersion
        ? await hydrateCanvasDocument({
              canvasState: activeVersion.canvasStateJson,
              canvasAssetManifest: activeVersion.canvasAssetManifestJson,
          })
        : await hydrateCanvasDocument({})

    return {
        project,
        versions: versions.map(mapVersionSummary),
        selectedVersionId: activeVersion?.id ?? null,
        activeVersion: activeVersion
            ? {
                  ...mapVersionSummary(activeVersion),
                  intent: activeVersion.intentJson,
                  plan: activeVersion.planJson,
              }
            : null,
        chatMessages:
            activeVersion?.messages.map((message) => ({
                id: message.id,
                role: message.role,
                content: message.content,
                status: message.status,
                sequence: message.sequence,
                createdAt: message.createdAt,
                updatedAt: message.updatedAt,
            })) ?? [],
        generatedFiles,
        canvasState,
    }
}

const createProject = async (data: CreateProject) => {
    const { name, description, prompt, userId } = data

    const project = await projectRepository.createProject({
        name,
        description,
        prompt,
        isStarred: false,
        userId,
    })

    return project
}

const renameProject = async (data: RenameProject) => {
    const { projectId, userId, rename } = data

    const result = await projectRepository.updateProjectMany(projectId, userId, {
        name: rename,
    })

    if (result.count === 0) {
        throw new AppError('project not found', 404)
    }

    return { message: 'project updated' }
}

const updateGeneralSettings = async (data: UpdateGeneralSettings) => {
    const { projectId, userId, name, description, isStarred, isSharedAsTemplate, projectCategory } =
        data

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (isStarred !== undefined) updateData.isStarred = isStarred
    if (isSharedAsTemplate !== undefined) updateData.isSharedAsTemplate = isSharedAsTemplate
    if (projectCategory !== undefined) updateData.projectCategory = projectCategory

    const result = await projectRepository.updateProjectMany(projectId, userId, updateData)

    if (result.count === 0) {
        throw new AppError('project not found', 404)
    }

    return { message: 'project general settings updated' }
}

const deleteProject = async (data: DeleteProject) => {
    const { userId, projectId } = data

    // Cascade 1: Fetch sessions
    const sessions = await projectRepository.findSessionsByProject(projectId)
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

    for (const session of sessions) {
        // Cascade 2: Send SIGKILL to running VMs immediately
        await publishEvent(`session_events:${session.id}`, { type: 'SIGKILL', data: {} })
        // Cascade 3: Disconnect WebSockets
        try {
            getIO().in(`session:${session.id}`).disconnectSockets()
        } catch (e) {
            console.warn('Socket not connected or io not available', e)
        }
    }

    // Cascade 4: Enqueue MinIO wipe to a queue (retry up to 3 times)
    const minioWipeQueue = new Queue('minio_wipe', { connection: redis })
    await minioWipeQueue.add(
        'wipe',
        { prefix: projectPrefix(projectId) },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
    )

    // Cascade 5: Delete DB records
    const result = await projectRepository.deleteProjectMany(projectId, userId)

    if (result.count === 0) {
        throw new AppError('project not found', 404)
    }

    return { message: 'project deleted' }
}

const duplicateProject = async (data: DuplicateProject) => {
    const { projectId, userId, name } = data

    const sourceProject = await projectRepository.findProjectForDuplicate(projectId, userId)

    if (!sourceProject) {
        throw new AppError('project not found', 404)
    }

    const latestVersion = await projectRepository.findLatestVersionForDuplicate(sourceProject.id)

    const newProject = await projectRepository.createProject({
        name: name || `Copy of ${sourceProject.name}`,
        description: sourceProject.description,
        prompt: latestVersion?.sourcePrompt ?? sourceProject.prompt,
        projectStatus: latestVersion ? 'READY' : sourceProject.projectStatus,
        userId: userId,
    })

    // if source project has no version (empty project); return new project
    if (!latestVersion) {
        return newProject
    }

    try {
        const copyResult = await copyProjectVersionsAndMessages({
            sourceProjectId: sourceProject.id,
            newProjectId: newProject.id,
            newUserId: userId,
            sourceCurrentVersionId: sourceProject.currentVersionId,
        })

        newProject.currentVersionId = copyResult.newCurrentVersionId
        newProject.versionCount = copyResult.versionCount

        return newProject
    } catch (error) {
        try {
            await projectRepository.deleteProject(newProject.id)
        } catch (dbError) {
            console.error('Failed to rollback project creation in database:', dbError)
        }
        try {
            await deletePrefix(projectPrefix(newProject.id))
        } catch (s3Error) {
            console.error('Failed to rollback project files in S3:', s3Error)
        }
        throw error
    }
}

const shareProjectAsTemplate = async (data: ShareProject) => {
    const { userId, projectId, isSharedAsTemplate, projectCategory } = data

    const project = await projectRepository.updateProjectMany(projectId, userId, {
        isSharedAsTemplate,
        ...(projectCategory ? { projectCategory } : {}),
    })

    if (project.count === 0) {
        throw new AppError('project not found', 404)
    }

    return {
        message: isSharedAsTemplate ? 'project shared as template' : 'project unshared as template',
    }
}

const toggleStarProject = async (data: ToggleStarProject) => {
    const { userId, projectId, isStarred } = data

    const project = await projectRepository.updateProjectMany(projectId, userId, {
        isStarred,
    })

    if (project.count === 0) {
        throw new AppError('project not found', 404)
    }

    return {
        message: 'project isStarred state updated',
    }
}

const getCollaborators = async (data: GetCollaborators) => {
    const { userId, projectId } = data
    const project = await projectRepository.findProjectById(projectId, userId)
    if (!project) {
        throw new AppError('project not found', 404)
    }
    const collaborators = await projectRepository.findCollaboratorsByProjectId(projectId)
    return collaborators
}

const addCollaborator = async (data: AddCollaborator) => {
    const { userId, projectId, email } = data

    const owner = await projectRepository.findProjectOwner(projectId)
    if (!owner || owner.userId !== userId) {
        throw new AppError('only the project creator can add collaborators', 403)
    }

    const targetUser = await projectRepository.findUserByEmailOrUsername(email)
    if (!targetUser || targetUser.isDeleted) {
        throw new AppError('user not found', 404)
    }

    if (targetUser.id === userId) {
        throw new AppError('you cannot add yourself as a collaborator', 400)
    }

    const existingCollaborator = await projectRepository.findCollaborator(
        projectId,
        targetUser.email
    )
    if (existingCollaborator) {
        throw new AppError('user is already a collaborator on this project', 400)
    }

    const count = await projectRepository.countCollaborators(projectId)
    if (count >= 3) {
        throw new AppError('maximum limit of 3 collaborators reached', 400)
    }

    const collaborator = await projectRepository.addCollaborator(
        projectId,
        targetUser.id,
        targetUser.email
    )
    return collaborator
}

const removeCollaborator = async (data: RemoveCollaborator) => {
    const { userId, projectId, email } = data

    const owner = await projectRepository.findProjectOwner(projectId)
    if (!owner || owner.userId !== userId) {
        throw new AppError('only the project creator can remove collaborators', 403)
    }

    const existingCollaborator = await projectRepository.findCollaborator(projectId, email)
    if (!existingCollaborator) {
        throw new AppError('collaborator not found', 404)
    }

    await projectRepository.removeCollaborator(projectId, email)
    return { message: 'collaborator removed successfully' }
}

export const projectService = {
    getAllProjects,
    getProjectById,
    createProject,
    renameProject,
    updateGeneralSettings,
    deleteProject,
    duplicateProject,
    shareProjectAsTemplate,
    toggleStarProject,
    getCollaborators,
    addCollaborator,
    removeCollaborator,
}
