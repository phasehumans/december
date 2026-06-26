import { prisma } from '@december/database'

async function findProjectForDeployment(data: { projectId: string; userId: string }) {
    const { projectId, userId } = data
    return prisma.project.findFirst({
        where: {
            id: projectId,
            userId,
        },
        include: {
            currentVersion: true,
        },
    })
}

async function updateProjectDecemberDeployment(data: { projectId: string; deployUrl: string }) {
    const { projectId, deployUrl } = data
    return prisma.project.update({
        where: { id: projectId },
        data: {
            decemberDeploymentUrl: deployUrl,
            decemberLastDeployedAt: new Date(),
        },
    })
}

async function getVercelCredentials(data: { userId: string }) {
    const { userId } = data
    return prisma.user.findUnique({
        where: { id: userId },
        select: {
            vercelAccessToken: true,
            vercelTeamId: true,
            vercelConnected: true,
        },
    })
}

async function findProjectById(data: { projectId: string }) {
    const { projectId } = data
    return prisma.project.findUnique({
        where: { id: projectId },
    })
}

async function updateProjectVercelLink(data: {
    projectId: string
    vercelProjectId: string
    vercelProjectName: string
}) {
    const { projectId, vercelProjectId, vercelProjectName } = data
    return prisma.project.update({
        where: { id: projectId },
        data: {
            vercelProjectId,
            vercelProjectName,
        },
    })
}

async function updateProjectVercelDeployment(data: { projectId: string; url: string }) {
    const { projectId, url } = data
    return prisma.project.update({
        where: { id: projectId },
        data: {
            vercelDeploymentUrl: url,
            vercelLastDeployedAt: new Date(),
        },
    })
}

async function findUserGithubConnection(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            githubToken: true,
            githubUsername: true,
            githubConnected: true,
        },
    })
}

async function findProjectByIdAndUser(data: { projectId: string; userId: string }) {
    const { projectId, userId } = data
    return prisma.project.findFirst({
        where: {
            id: projectId,
            userId,
        },
    })
}

async function updateProjectGithub(data: {
    projectId: string
    githubRepoName: string
    githubRepoOwner: string
    githubRepoUrl: string
}) {
    const { projectId, githubRepoName, githubRepoOwner, githubRepoUrl } = data
    return prisma.project.update({
        where: { id: projectId },
        data: {
            githubRepoName,
            githubRepoOwner,
            githubRepoUrl,
        },
    })
}

async function findProjectVersionByIdAndProject(data: { versionId: string; projectId: string }) {
    const { versionId, projectId } = data
    return prisma.projectVersion.findFirst({
        where: {
            id: versionId,
            projectId,
        },
    })
}

async function updateProjectSynced(projectId: string) {
    return prisma.project.update({
        where: { id: projectId },
        data: {
            githubLastSyncedAt: new Date(),
        },
    })
}

async function unlinkProjectGithub(projectId: string) {
    return prisma.project.update({
        where: { id: projectId },
        data: {
            githubRepoName: null,
            githubRepoOwner: null,
            githubRepoUrl: null,
            githubLastSyncedAt: null,
        },
    })
}

async function unlinkProjectVercel(projectId: string) {
    return prisma.project.update({
        where: { id: projectId },
        data: {
            vercelProjectId: null,
            vercelProjectName: null,
            vercelDeploymentUrl: null,
            vercelLastDeployedAt: null,
        },
    })
}

async function getProjectMemories(projectId: string) {
    return prisma.projectMemory.findMany({
        where: { projectId },
    })
}

export const platformRepository = {
    findProjectForDeployment,
    updateProjectDecemberDeployment,
    getVercelCredentials,
    findProjectById,
    updateProjectVercelLink,
    updateProjectVercelDeployment,
    findUserGithubConnection,
    findProjectByIdAndUser,
    updateProjectGithub,
    findProjectVersionByIdAndProject,
    updateProjectSynced,
    unlinkProjectGithub,
    unlinkProjectVercel,
    getProjectMemories,
}
