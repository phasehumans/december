import '../../env'

import crypto from 'crypto'
import fs from 'fs'
import { prisma } from '@december/database'
import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'

// Mock external storage, runtime, and network calls
let mockTextFile: any = 'text content'
let mockBinaryFile: any = { body: new Uint8Array([1, 2, 3]) }
mock.module('../../../src/shared/project-storage', () => ({
    getTextFile: async () => mockTextFile,
    getBinaryFile: async () => mockBinaryFile,
}))

let mockCheckSuccess = true
let mockCheckErrors = ''
mock.module('../../../src/modules/runtime/runtime.service', () => ({
    runtimeService: {
        checkSandboxCompilation: async () => ({
            success: mockCheckSuccess,
            errors: mockCheckErrors || undefined,
        }),
    },
}))

let mockAxiosPostResponse: any = {
    data: { id: 'dep-123', url: 'https://test.vercel.app', state: 'READY' },
}
let mockAxiosGetResponse: any = {
    data: {
        id: 'dep-123',
        url: 'https://test.vercel.app',
        readyState: 'READY',
        deployments: [{ uid: 'dep-123', url: 'https://test.vercel.app', state: 'READY' }],
    },
}
let mockAxiosPatchResponse: any = { data: { id: 'dep-123', status: 'CANCELLED' } }
let mockAxiosPostError: any = null
let mockAxiosGetError: any = null
let mockAxiosPatchError: any = null

mock.module('axios', () => ({
    default: {
        post: async (url: string, data: any, config: any) => {
            if (mockAxiosPostError) throw mockAxiosPostError
            return mockAxiosPostResponse
        },
        get: async (url: string, config: any) => {
            if (mockAxiosGetError) throw mockAxiosGetError
            return mockAxiosGetResponse
        },
        patch: async (url: string, data: any, config: any) => {
            if (mockAxiosPatchError) throw mockAxiosPatchError
            return mockAxiosPatchResponse
        },
    },
}))

let customFetchHandler: ((url: string, options?: any) => Promise<any>) | null = null
const originalFetch = globalThis.fetch
globalThis.fetch = async (url: any, options?: any) => {
    if (customFetchHandler) {
        return customFetchHandler(url.toString(), options)
    }
    return originalFetch(url, options)
}

// Override fs methods directly for december deployment simulation
const originalExistsSync = fs.existsSync
const originalMkdirSync = fs.mkdirSync
const originalReaddirSync = fs.readdirSync
const originalRmSync = fs.rmSync
const originalCopyFileSync = fs.copyFileSync
const originalPromisesMkdir = fs.promises.mkdir
const originalPromisesReaddir = fs.promises.readdir
const originalPromisesRm = fs.promises.rm
const originalPromisesCopyFile = fs.promises.copyFile

fs.existsSync = () => true
fs.mkdirSync = (() => {}) as any
fs.readdirSync = (() => []) as any
fs.rmSync = (() => {}) as any
fs.copyFileSync = (() => {}) as any
fs.promises.mkdir = async () => {}
fs.promises.readdir = async () => []
fs.promises.rm = async () => {}
fs.promises.copyFile = async () => {}

afterAll(async () => {
    fs.existsSync = originalExistsSync
    fs.mkdirSync = originalMkdirSync
    fs.readdirSync = originalReaddirSync
    fs.rmSync = originalRmSync
    fs.copyFileSync = originalCopyFileSync
    fs.promises.mkdir = originalPromisesMkdir
    fs.promises.readdir = originalPromisesReaddir
    fs.promises.rm = originalPromisesRm
    fs.promises.copyFile = originalPromisesCopyFile
    globalThis.fetch = originalFetch
    await prisma.$disconnect()
}, 15000)

import { platformService } from '../../../src/modules/platform/platform.service'

const createUser = async (overrides: Record<string, unknown> = {}) => {
    return prisma.user.create({
        data: {
            name: 'Platform Integration User',
            email: `platform-${crypto.randomUUID()}@example.com`,
            username: `platform-${crypto.randomUUID()}`,
            password: 'hashed-password',
            emailVerified: true,
            isDeleted: false,
            ...overrides,
        },
    })
}

const createProject = async (userId: string, overrides: Record<string, unknown> = {}) => {
    return prisma.project.create({
        data: {
            name: 'Platform Integration Project',
            prompt: 'Test project prompt',
            userId,
            ...overrides,
        },
    })
}

const createProjectVersion = async (projectId: string, overrides: Record<string, unknown> = {}) => {
    return prisma.projectVersion.create({
        data: {
            projectId,
            versionNumber: 1,
            sourcePrompt: 'Test source prompt',
            objectStoragePrefix: 'test-prefix',
            manifestJson: [
                { path: 'index.html', key: 'key1', contentType: 'text/html' },
                { path: 'image.png', key: 'key2', contentType: 'image/png' },
            ],
            ...overrides,
        },
    })
}

describe('platform.service.integration', () => {
    let isCleaningUp = false

    beforeEach(async () => {
        if (isCleaningUp) return

        mockCheckSuccess = true
        mockCheckErrors = ''
        mockAxiosPostError = null
        mockAxiosGetError = null
        mockAxiosPatchError = null
        customFetchHandler = null

        await prisma.projectMemory.deleteMany({
            where: { project: { user: { email: { startsWith: 'platform-' } } } },
        })
        await prisma.projectVersion.deleteMany({
            where: { project: { user: { email: { startsWith: 'platform-' } } } },
        })
        await prisma.project.deleteMany({ where: { user: { email: { startsWith: 'platform-' } } } })
        await prisma.user.deleteMany({ where: { email: { startsWith: 'platform-' } } })
    })

    describe('deployDecemberProject', () => {
        it('should successfully deploy project and update DB deployment URL', async () => {
            const user = await createUser()
            const project = await createProject(user.id)
            const version = await createProjectVersion(project.id)
            await prisma.project.update({
                where: { id: project.id },
                data: { currentVersionId: version.id },
            })

            const result = await platformService.deployDecemberProject({
                projectId: project.id,
                userId: user.id,
            })
            expect(result.deploymentUrl).toBe(`http://${project.id}.december.localhost:8085`)

            const updatedProject = await prisma.project.findUnique({ where: { id: project.id } })
            expect(updatedProject!.decemberDeploymentUrl).toBe(
                `http://${project.id}.december.localhost:8085`
            )
            expect(updatedProject!.decemberLastDeployedAt).not.toBeNull()
        })

        it('should throw 404 if project does not exist', async () => {
            const user = await createUser()
            expect(
                platformService.deployDecemberProject({ projectId: 'fake-id', userId: user.id })
            ).rejects.toThrow('project not found')
        })

        it('should throw 400 if project has no compiled version', async () => {
            const user = await createUser()
            const project = await createProject(user.id)
            expect(
                platformService.deployDecemberProject({ projectId: project.id, userId: user.id })
            ).rejects.toThrow('project has no compiled version to deploy')
        })
    })

    describe('downloadProject', () => {
        it('should successfully generate zip buffer for project with active version', async () => {
            const user = await createUser()
            const project = await createProject(user.id, { name: 'Download Project' })
            const version = await createProjectVersion(project.id)
            await prisma.project.update({
                where: { id: project.id },
                data: { currentVersionId: version.id },
            })

            const result = await platformService.downloadProject({
                projectId: project.id,
                userId: user.id,
            })
            expect(result.fileName).toBe('Download-Project.zip')
            expect(result.zip).toBeInstanceOf(Uint8Array)
        })
    })

    describe('getUserGithubRepos', () => {
        it('should return user repos when github is connected', async () => {
            const user = await createUser({
                githubConnected: true,
                githubToken: 'gh_token',
                githubUsername: 'gh_user',
            })
            customFetchHandler = async () => ({
                ok: true,
                json: async () => [{ id: 1, name: 'integ-repo', owner: { login: 'gh_user' } }],
            })

            const repos = await platformService.getUserGithubRepos({ userId: user.id })
            expect(repos.length).toBe(1)
            expect(repos[0].name).toBe('integ-repo')
        })

        it('should throw 401 if github is not connected', async () => {
            const user = await createUser({ githubConnected: false })
            expect(platformService.getUserGithubRepos({ userId: user.id })).rejects.toThrow(
                'github is not connected'
            )
        })
    })

    describe('createRepo', () => {
        it('should create repo on GitHub and link to project in DB', async () => {
            const user = await createUser({
                githubConnected: true,
                githubToken: 'gh_token',
                githubUsername: 'gh_user',
            })
            const project = await createProject(user.id)
            const version = await createProjectVersion(project.id)
            await prisma.project.update({
                where: { id: project.id },
                data: { currentVersionId: version.id },
            })

            customFetchHandler = async (url) => {
                if (url.includes('/user/repos')) {
                    return {
                        ok: true,
                        json: async () => ({
                            name: 'new-repo',
                            owner: { login: 'gh_user' },
                            html_url: 'https://github.com/gh_user/new-repo',
                        }),
                    }
                }
                if (url.includes('/repos/')) {
                    if (url.endsWith('/main'))
                        return { ok: true, json: async () => ({ object: { sha: 'sha1' } }) }
                    if (url.includes('/commits/'))
                        return { ok: true, json: async () => ({ tree: { sha: 'tree1' } }) }
                    if (url.includes('/blobs'))
                        return { ok: true, json: async () => ({ sha: 'blob1' }) }
                    if (url.includes('/trees'))
                        return { ok: true, json: async () => ({ sha: 'tree2' }) }
                    if (url.includes('/commits'))
                        return { ok: true, json: async () => ({ sha: 'commit2' }) }
                    if (url.includes('/refs/heads/main'))
                        return { ok: true, json: async () => ({}) }
                    return { ok: true, json: async () => ({ default_branch: 'main' }) }
                }
                return { ok: true, json: async () => ({}) }
            }

            const result = await platformService.createRepo({
                userId: user.id,
                projectId: project.id,
                name: 'new-repo',
                private: true,
            })
            expect(result.githubRepoName).toBe('new-repo')
            expect(result.githubRepoOwner).toBe('gh_user')

            const updatedProject = await prisma.project.findUnique({ where: { id: project.id } })
            expect(updatedProject!.githubRepoName).toBe('new-repo')
            expect(updatedProject!.githubRepoOwner).toBe('gh_user')
            expect(updatedProject!.githubRepoUrl).toBe('https://github.com/gh_user/new-repo')
        })
    })

    describe('updateRepo', () => {
        it('should sync project files to GitHub and update githubLastSyncedAt in DB', async () => {
            const user = await createUser({
                githubConnected: true,
                githubToken: 'gh_token',
                githubUsername: 'gh_user',
            })
            const project = await createProject(user.id, {
                githubRepoName: 'existing-repo',
                githubRepoOwner: 'gh_user',
                githubRepoUrl: 'https://github.com/gh_user/existing-repo',
            })
            const version = await createProjectVersion(project.id)
            await prisma.project.update({
                where: { id: project.id },
                data: { currentVersionId: version.id },
            })

            customFetchHandler = async (url) => {
                if (url.includes('/repos/')) {
                    if (url.endsWith('/main'))
                        return { ok: true, json: async () => ({ object: { sha: 'sha1' } }) }
                    if (url.includes('/commits/'))
                        return { ok: true, json: async () => ({ tree: { sha: 'tree1' } }) }
                    if (url.includes('/blobs'))
                        return { ok: true, json: async () => ({ sha: 'blob1' }) }
                    if (url.includes('/trees'))
                        return { ok: true, json: async () => ({ sha: 'tree2' }) }
                    if (url.includes('/commits'))
                        return { ok: true, json: async () => ({ sha: 'commit2' }) }
                    if (url.includes('/refs/heads/main'))
                        return { ok: true, json: async () => ({}) }
                    return { ok: true, json: async () => ({ default_branch: 'main' }) }
                }
                return { ok: true, json: async () => ({}) }
            }

            const result = await platformService.updateRepo({
                userId: user.id,
                projectId: project.id,
            })
            expect(result.commitSha).toBe('commit2')

            const updatedProject = await prisma.project.findUnique({ where: { id: project.id } })
            expect(updatedProject!.githubLastSyncedAt).not.toBeNull()
        })
    })

    describe('unlinkGithubRepo', () => {
        it('should unlink github repo and clear fields in DB', async () => {
            const user = await createUser()
            const project = await createProject(user.id, {
                githubRepoName: 'repo',
                githubRepoOwner: 'owner',
                githubRepoUrl: 'url',
                githubLastSyncedAt: new Date(),
            })

            await platformService.unlinkGithubRepo({ userId: user.id, projectId: project.id })

            const updatedProject = await prisma.project.findUnique({ where: { id: project.id } })
            expect(updatedProject!.githubRepoName).toBeNull()
            expect(updatedProject!.githubRepoOwner).toBeNull()
            expect(updatedProject!.githubRepoUrl).toBeNull()
            expect(updatedProject!.githubLastSyncedAt).toBeNull()
        })
    })

    describe('unlinkVercelProject', () => {
        it('should unlink vercel project and clear fields in DB', async () => {
            const user = await createUser()
            const project = await createProject(user.id, {
                vercelProjectId: 'v1',
                vercelProjectName: 'vname',
                vercelDeploymentUrl: 'url',
                vercelLastDeployedAt: new Date(),
            })

            await platformService.unlinkVercelProject({ userId: user.id, projectId: project.id })

            const updatedProject = await prisma.project.findUnique({ where: { id: project.id } })
            expect(updatedProject!.vercelProjectId).toBeNull()
            expect(updatedProject!.vercelProjectName).toBeNull()
            expect(updatedProject!.vercelDeploymentUrl).toBeNull()
            expect(updatedProject!.vercelLastDeployedAt).toBeNull()
        })
    })

    describe('syncEnvironmentVariables', () => {
        it('should fetch project memories from DB and sync to Vercel', async () => {
            const user = await createUser({ vercelConnected: true, vercelAccessToken: 'v_token' })
            const project = await createProject(user.id, { vercelProjectId: 'v_proj_123' })

            await prisma.projectMemory.createMany({
                data: [
                    { projectId: project.id, key: 'VAR1', value: 'val1' },
                    { projectId: project.id, key: 'VAR2', value: 'val2' },
                ],
            })

            const result = await platformService.syncEnvironmentVariables({
                userId: user.id,
                projectId: project.id,
            })
            expect(result.message).toBe('Environment variables synced successfully')
        })
    })

    describe('deployVercelDirect', () => {
        it('should deploy direct to vercel and update vercelDeploymentUrl in DB', async () => {
            const user = await createUser({ vercelConnected: true, vercelAccessToken: 'v_token' })
            const project = await createProject(user.id, {
                vercelProjectId: 'v_proj_123',
                vercelProjectName: 'v_name',
            })
            const version = await createProjectVersion(project.id)
            await prisma.project.update({
                where: { id: project.id },
                data: { currentVersionId: version.id },
            })

            const result = await platformService.deployVercelDirect({
                userId: user.id,
                projectId: project.id,
                vercelProjectId: 'v_proj_123',
                vercelProjectName: 'v_name',
            })
            expect(result.url).toBe('https://test.vercel.app')

            const updatedProject = await prisma.project.findUnique({ where: { id: project.id } })
            expect(updatedProject!.vercelDeploymentUrl).toBe('https://test.vercel.app')
        })
    })
})
