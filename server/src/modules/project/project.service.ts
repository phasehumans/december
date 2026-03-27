import { prisma } from '../../config/db'
import { buildProjectZip } from '../../lib/build-project-zip'
import { saveProjectFiles } from '../../lib/save-project-files'
import { deletePrefix, getTextFile, projectPrefix } from '../../lib/project-storage'

type GetProject = {
    userId: string
    projectId: string
    versionId?: string
}

type CreateProject = {
    name: string
    description: string | undefined
    prompt: string
    userId: string
}

type UpdateProject = {
    projectId: string
    userId: string
    rename?: string
    isStarred?: boolean
}

type DeleteProject = {
    userId: string
    projectId: string
}

type DuplicateProject = {
    userId: string
    projectId: string
}

type StoredProjectFile = {
    path: string
    key: string
    contentType?: string
    size: number
}

const parseStoredProjectFiles = (value: unknown): StoredProjectFile[] => {
    if (!Array.isArray(value)) {
        return []
    }

    return value.reduce<StoredProjectFile[]>((files, item) => {
        if (!item || typeof item !== 'object') {
            return files
        }

        const candidate = item as Partial<StoredProjectFile>

        if (typeof candidate.path !== 'string' || typeof candidate.key !== 'string') {
            return files
        }

        files.push({
            path: candidate.path,
            key: candidate.key,
            ...(typeof candidate.contentType === 'string'
                ? { contentType: candidate.contentType }
                : {}),
            size: typeof candidate.size === 'number' ? candidate.size : 0,
        })

        return files
    }, [])
}

const loadGeneratedFilesFromManifest = async (manifest: StoredProjectFile[]) => {
    const files = await Promise.all(
        manifest.map(async (file) => [file.path, (await getTextFile(file.key)) ?? ''] as const)
    )

    return Object.fromEntries(files)
}

const mapVersionSummary = (version: {
    id: string
    versionNumber: number
    label: string | null
    sourcePrompt: string
    summary: string | null
    status: string
    objectStoragePrefix: string
    manifestJson: unknown
    createdAt: Date
    updatedAt: Date
}) => ({
    id: version.id,
    versionNumber: version.versionNumber,
    label: version.label ?? `v${version.versionNumber}`,
    sourcePrompt: version.sourcePrompt,
    summary: version.summary,
    status: version.status,
    objectStoragePrefix: version.objectStoragePrefix,
    fileCount: parseStoredProjectFiles(version.manifestJson).length,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
})

const getAllProjects = async (userId: string) => {
    return prisma.project.findMany({
        where: {
            userId,
        },
        orderBy: {
            updatedAt: 'desc',
        },
    })
}

const getProjectById = async (data: GetProject) => {
    const { userId, projectId, versionId } = data
    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId,
        },
        include: {
            versions: {
                orderBy: {
                    versionNumber: 'desc',
                },
            },
        },
    })

    if (!project) {
        throw new Error('project not found')
    }

    const selectedVersionId =
        versionId ?? project.currentVersionId ?? project.versions[0]?.id ?? null

    const activeVersion = selectedVersionId
        ? await prisma.projectVersion.findFirst({
              where: {
                  id: selectedVersionId,
                  projectId: project.id,
              },
              include: {
                  messages: {
                      orderBy: {
                          sequence: 'asc',
                      },
                  },
              },
          })
        : null

    if (selectedVersionId && !activeVersion) {
        throw new Error('project version not found')
    }

    const generatedFiles = activeVersion
        ? await loadGeneratedFilesFromManifest(parseStoredProjectFiles(activeVersion.manifestJson))
        : {}

    return {
        project,
        versions: project.versions.map(mapVersionSummary),
        selectedVersionId: activeVersion?.id ?? null,
        activeVersion: activeVersion
            ? {
                  ...mapVersionSummary(activeVersion),
                  intent: activeVersion.intentJson,
                  plan: activeVersion.planJson,
                  isDatabaseEnabled: activeVersion.isDatabaseEnabled,
                  databaseUrl: activeVersion.databaseUrl,
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
    }
}

const createProject = async (data: CreateProject) => {
    const { name, description, prompt, userId } = data

    return prisma.project.create({
        data: {
            name,
            description,
            prompt,
            isStarred: false,
            userId,
        },
    })
}

const updateProject = async (data: UpdateProject) => {
    const { projectId, userId, rename, isStarred } = data

    const project = await prisma.project.updateMany({
        where: {
            id: projectId,
            userId,
        },
        data: {
            ...(rename !== undefined && { name: rename }),
            ...(isStarred !== undefined && { isStarred }),
        },
    })

    if (project.count === 0) {
        throw new Error('project not found')
    }

    return { message: 'project updated' }
}

const deleteProject = async (data: DeleteProject) => {
    const { userId, projectId } = data
    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId,
        },
    })

    if (!project) {
        throw new Error('project not found')
    }

    await deletePrefix(projectPrefix(projectId))

    return prisma.project.delete({
        where: {
            id: projectId,
        },
    })
}

const duplicateProject = async (data: DuplicateProject) => {
    const { projectId, userId } = data

    const sourceProject = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId,
        },
        include: {
            currentVersion: {
                include: {
                    messages: {
                        orderBy: {
                            sequence: 'asc',
                        },
                    },
                },
            },
        },
    })

    if (!sourceProject) {
        throw new Error('project not found')
    }

    const newProject = await prisma.project.create({
        data: {
            name: `Copy of ${sourceProject.name}`,
            description: sourceProject.description,
            prompt: sourceProject.currentVersion?.sourcePrompt ?? sourceProject.prompt,
            projectStatus: sourceProject.currentVersion ? 'READY' : sourceProject.projectStatus,
            userId,
        },
    })

    if (!sourceProject.currentVersion) {
        return newProject
    }

    const manifest = parseStoredProjectFiles(sourceProject.currentVersion.manifestJson)
    const generatedFiles = await loadGeneratedFilesFromManifest(manifest)
    const versionId = crypto.randomUUID()
    const savedFiles = await saveProjectFiles({
        projectId: newProject.id,
        versionId,
        files: Object.entries(generatedFiles).map(([path, content]) => ({ path, content })),
    })

    const createdVersion = await prisma.projectVersion.create({
        data: {
            id: versionId,
            projectId: newProject.id,
            versionNumber: 1,
            label: 'v1',
            sourcePrompt: sourceProject.currentVersion.sourcePrompt,
            summary: sourceProject.currentVersion.summary ?? undefined,
            status: 'READY',
            objectStoragePrefix: `projects/${newProject.id}/versions/${versionId}`,
            manifestJson: savedFiles.map((file) => ({
                path: file.path,
                key: file.key,
                ...(file.contentType ? { contentType: file.contentType } : {}),
                size: file.size,
            })),
            ...(sourceProject.currentVersion.intentJson !== null
                ? { intentJson: sourceProject.currentVersion.intentJson as any }
                : {}),
            ...(sourceProject.currentVersion.planJson !== null
                ? { planJson: sourceProject.currentVersion.planJson as any }
                : {}),
            isDatabaseEnabled: sourceProject.currentVersion.isDatabaseEnabled,
            ...(sourceProject.currentVersion.databaseUrl
                ? { databaseUrl: sourceProject.currentVersion.databaseUrl }
                : {}),
            messages: {
                create: sourceProject.currentVersion.messages.map((message) => ({
                    projectId: newProject.id,
                    role: message.role,
                    content: message.content,
                    ...(message.status ? { status: message.status } : {}),
                    sequence: message.sequence,
                })),
            },
        },
    })

    return prisma.project.update({
        where: {
            id: newProject.id,
        },
        data: {
            currentVersionId: createdVersion.id,
            versionCount: 1,
        },
    })
}

const downloadProjectVersion = async (data: GetProject) => {
    const detail = await getProjectById(data)

    if (!detail.activeVersion) {
        throw new Error('project version not found')
    }

    const zip = buildProjectZip(
        Object.entries(detail.generatedFiles).map(([path, content]) => ({
            path,
            content,
        }))
    )

    const safeProjectName =
        detail.project.name
            .trim()
            .replace(/[^a-z0-9-_]+/gi, '-')
            .replace(/^-+|-+$/g, '') || 'project'
    const fileName = `${safeProjectName}-${detail.activeVersion.label}.zip`

    return {
        fileName,
        zip,
    }
}

export const projectService = {
    getAllProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    duplicateProject,
    downloadProjectVersion,
}
