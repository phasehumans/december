import fs from 'fs'
import path from 'path'

import { prisma } from '../../config/db'
import { AppError } from '../../shared/appError'
import { runtimeService } from '../runtime/runtime.service'
import type { DeployProject } from './platform.types'

function copyDirRecursive(src: string, dest: string) {
    fs.mkdirSync(dest, { recursive: true })
    const entries = fs.readdirSync(src, { withFileTypes: true })

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)

        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath)
        } else {
            fs.copyFileSync(srcPath, destPath)
        }
    }
}

const deployDecemberProject = async (data: DeployProject) => {
    const { projectId, userId } = data

    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId,
            isDeleted: false,
            user: { isDeleted: false },
        },
        include: {
            currentVersion: true,
        },
    })

    if (!project) {
        throw new AppError('project not found', 404)
    }

    if (!project.currentVersionId) {
        throw new AppError('project has no compiled version to deploy', 400)
    }

    let compilationFailed = false
    let compilationError = ''
    try {
        const checkResult = await runtimeService.checkSandboxCompilation(projectId)
        if (!checkResult.success) {
            compilationFailed = true
            compilationError = checkResult.errors || 'Unknown compilation error'
        }
    } catch (err: any) {
        console.error('[deploy] failed to run checkSandboxCompilation:', err)
    }

    const workspacesRoot =
        process.env.RUNTIME_WORKSPACE_ROOT ||
        path.resolve(__dirname, '../../../../runtime/workspaces')
    const distPath = path.join(workspacesRoot, projectId, 'dist')

    if (compilationFailed) {
        throw new AppError(`Compilation check failed: ${compilationError}`, 400)
    }

    if (!fs.existsSync(distPath)) {
        throw new AppError(
            'Built production assets not found. Please trigger a preview first to compile the project.',
            400
        )
    }

    const deploymentsRoot = path.resolve(__dirname, '../../../../infra/nginx/deployments')
    const projectDeployPath = path.join(deploymentsRoot, projectId)

    if (fs.existsSync(projectDeployPath)) {
        fs.rmSync(projectDeployPath, { recursive: true, force: true })
    }

    copyDirRecursive(distPath, projectDeployPath)

    const deployUrl = `http://${projectId}.december.localhost:8085`
    const updated = await prisma.project.update({
        where: { id: projectId },
        data: {
            decemberDeploymentUrl: deployUrl,
            decemberLastDeployedAt: new Date(),
        },
    })

    return {
        message: 'Project deployed successfully to December local hosting',
        deploymentUrl: deployUrl,
        lastDeployedAt: updated.decemberLastDeployedAt,
    }
}

export const platformService = {
    deployDecemberProject,
}
