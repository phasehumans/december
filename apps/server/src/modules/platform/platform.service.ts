import fs from 'fs'
import path from 'path'

import { AppError } from '../../shared/appError'
import { getBinaryFile, getTextFile } from '../../shared/project-storage'
import { projectService } from '../project/project.service'
import { parseStoredProjectFiles } from '../project/project.utils'
import { runtimeService } from '../runtime/runtime.service'

import { platformRepository } from './platform.repository'
import { buildProjectZip } from './platform.utils'

import type {
    DeployProject,
    ListGithubRepos,
    GithubRepo,
    CreateRepo,
    UpdateRepo,
} from './platform.types'
import type { GetProject } from '../project/project.types'

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

    const project = await platformRepository.findProjectForDeployment({ projectId, userId })

    if (!project) {
        throw new AppError('project not found', 404)
    }

    if (!project.currentVersionId) {
        throw new AppError('project has no compiled version to deploy', 400)
    }

    let compilationFailed = false
    let compilationError = ''
    try {
        const checkResult = await runtimeService.checkSandboxCompilation({ projectId })
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
    const updated = await platformRepository.updateProjectDecemberDeployment({
        projectId,
        deployUrl,
    })

    return {
        message: 'project deployed successfully to december local hosting',
        deploymentUrl: deployUrl,
        lastDeployedAt: updated.decemberLastDeployedAt,
    }
}

const downloadProjectVersion = async (data: GetProject) => {
    const detail = await projectService.getProjectById(data)

    if (!detail.activeVersion) {
        throw new AppError('project version not found', 404)
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
    const fileName = `${safeProjectName}.zip`

    return {
        fileName,
        zip,
    }
}

const getUserGithubRepos = async (data: ListGithubRepos): Promise<GithubRepo[]> => {
    const { userId } = data
    const user = await platformRepository.findUserGithubConnection(userId)

    if (!user) {
        throw new AppError('user not found', 404)
    }

    if (user.githubConnected === false) {
        throw new AppError('github is not connected', 401)
    }

    if (!user.githubToken) {
        throw new AppError('github access token not found', 401)
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
        throw new AppError(`Failed to fetch GitHub repos: ${errorText}`, 401)
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
        language: repo.language ?? null,
        description: repo.description ?? null,
        owner: {
            login: repo.owner?.login,
            avatarUrl: repo.owner?.avatar_url,
        },
    }))
}

const createRepo = async (data: CreateRepo) => {
    const { userId, projectId } = data
    const user = await platformRepository.findUserGithubConnection(userId)

    if (!user || !user.githubConnected || !user.githubToken) {
        throw new AppError('GitHub account not connected', 400)
    }

    const project = await platformRepository.findProjectByIdAndUser({ projectId, userId })

    if (!project) {
        throw new AppError('Project not found', 404)
    }

    const response = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${user.githubToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: data.name,
            private: data.private,
            description: data.description ?? `Generated by December: ${project.name}`,
            auto_init: true,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new AppError(`GitHub repository creation failed: ${errorText}`, response.status)
    }

    const repoData = (await response.json()) as any
    const repoName = repoData.name
    const repoOwner = repoData.owner.login
    const repoUrl = repoData.html_url

    const updatedProject = await platformRepository.updateProjectGithub({
        projectId,
        githubRepoName: repoName,
        githubRepoOwner: repoOwner,
        githubRepoUrl: repoUrl,
    })

    try {
        await updateRepo({ userId, projectId, commitMessage: 'Initial sync from December' })
    } catch (syncError) {
        console.error('Initial sync failed:', syncError)
    }

    return updatedProject
}

const updateRepo = async (data: UpdateRepo) => {
    const { userId, projectId } = data
    const user = await platformRepository.findUserGithubConnection(userId)

    if (!user || !user.githubConnected || !user.githubToken) {
        throw new AppError('GitHub account not connected', 400)
    }

    const project = await platformRepository.findProjectByIdAndUser({ projectId, userId })

    if (!project) {
        throw new AppError('Project not found', 404)
    }

    if (!project.githubRepoName || !project.githubRepoOwner) {
        throw new AppError('Project is not linked to any GitHub repository', 400)
    }

    const repoOwner = project.githubRepoOwner
    const repoName = project.githubRepoName
    const githubToken = user.githubToken
    const commitMessage = data.commitMessage ?? 'Update project files'

    const activeVersionId = project.currentVersionId
    if (!activeVersionId) {
        throw new AppError('No active version found for this project', 400)
    }

    const activeVersion = await platformRepository.findProjectVersionByIdAndProject({
        versionId: activeVersionId,
        projectId,
    })

    if (!activeVersion) {
        throw new AppError('Active version not found', 404)
    }

    const manifest = parseStoredProjectFiles(activeVersion.manifestJson)
    if (manifest.length === 0) {
        throw new AppError('No files found in active project version to sync', 400)
    }

    const headers = {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
    }

    const repoResponse = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}`, {
        method: 'GET',
        headers,
    })

    if (!repoResponse.ok) {
        const errorText = await repoResponse.text()
        throw new AppError(
            `Failed to fetch GitHub repository details: ${errorText}`,
            repoResponse.status
        )
    }

    const repoDetails = (await repoResponse.json()) as any
    const defaultBranch = repoDetails.default_branch || 'main'

    const refResponse = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/git/ref/heads/${defaultBranch}`,
        {
            method: 'GET',
            headers,
        }
    )

    if (!refResponse.ok) {
        const errorText = await refResponse.text()
        throw new AppError(
            `Failed to fetch default branch reference: ${errorText}`,
            refResponse.status
        )
    }

    const refData = (await refResponse.json()) as any
    const latestCommitSha = refData.object.sha

    const commitResponse = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/git/commits/${latestCommitSha}`,
        {
            method: 'GET',
            headers,
        }
    )

    if (!commitResponse.ok) {
        const errorText = await commitResponse.text()
        throw new AppError(
            `Failed to fetch base commit details: ${errorText}`,
            commitResponse.status
        )
    }

    const commitData = (await commitResponse.json()) as any
    const baseTreeSha = commitData.tree.sha

    const treeEntries: any[] = []

    for (const file of manifest) {
        const isBinary =
            file.contentType &&
            !file.contentType.startsWith('text/') &&
            !file.contentType.includes('json') &&
            !file.contentType.includes('javascript') &&
            !file.contentType.includes('typescript') &&
            !file.contentType.includes('xml')

        if (isBinary) {
            const binaryFile = await getBinaryFile(file.key)
            if (binaryFile) {
                const base64Content = Buffer.from(binaryFile.body).toString('base64')
                const blobResponse = await fetch(
                    `https://api.github.com/repos/${repoOwner}/${repoName}/git/blobs`,
                    {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            content: base64Content,
                            encoding: 'base64',
                        }),
                    }
                )

                if (!blobResponse.ok) {
                    const errorText = await blobResponse.text()
                    throw new AppError(
                        `Failed to create binary blob for ${file.path}: ${errorText}`,
                        blobResponse.status
                    )
                }

                const blobData = (await blobResponse.json()) as any
                treeEntries.push({
                    path: file.path,
                    mode: '100644',
                    type: 'blob',
                    sha: blobData.sha,
                })
            }
        } else {
            const textContent = await getTextFile(file.key)
            treeEntries.push({
                path: file.path,
                mode: '100644',
                type: 'blob',
                content: textContent ?? '',
            })
        }
    }

    const treeResponse = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/git/trees`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({
                base_tree: baseTreeSha,
                tree: treeEntries,
            }),
        }
    )

    if (!treeResponse.ok) {
        const errorText = await treeResponse.text()
        throw new AppError(`Failed to create new Git tree: ${errorText}`, treeResponse.status)
    }

    const treeData = (await treeResponse.json()) as any
    const newTreeSha = treeData.sha

    const newCommitResponse = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/git/commits`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({
                message: commitMessage,
                tree: newTreeSha,
                parents: [latestCommitSha],
            }),
        }
    )

    if (!newCommitResponse.ok) {
        const errorText = await newCommitResponse.text()
        throw new AppError(`Failed to create Git commit: ${errorText}`, newCommitResponse.status)
    }

    const newCommitData = (await newCommitResponse.json()) as any
    const newCommitSha = newCommitData.sha

    const updateRefResponse = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/git/refs/heads/${defaultBranch}`,
        {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
                sha: newCommitSha,
                force: true,
            }),
        }
    )

    if (!updateRefResponse.ok) {
        const errorText = await updateRefResponse.text()
        throw new AppError(
            `Failed to update default branch reference: ${errorText}`,
            updateRefResponse.status
        )
    }

    const updatedProject = await platformRepository.updateProjectSynced(projectId)

    return {
        project: updatedProject,
        commitSha: newCommitSha,
    }
}

export const platformService = {
    deployDecemberProject,
    downloadProjectVersion,
    getUserGithubRepos,
    createRepo,
    updateRepo,
}
