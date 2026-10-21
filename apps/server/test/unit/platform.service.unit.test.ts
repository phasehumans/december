import { describe, it, expect, afterEach } from 'bun:test'

import { platformRepository } from '../../src/modules/platform/platform.repository'
import { platformService } from '../../src/modules/platform/platform.service'
import { setMockSandboxRunner } from '../../src/modules/platform/platform.utils'
import { vercelService } from '../../src/modules/platform/vercel.service'
import { AppError } from '../../src/shared/appError'

describe('Platform Service - Unit Tests', () => {
    afterEach(() => {
        setMockSandboxRunner(null)
    })

    describe('downloadSession', () => {
        it('should throw AppError 404 if session not found', async () => {
            const originalFind = platformRepository.findSessionByIdAndUser
            platformRepository.findSessionByIdAndUser = (async () => null) as any

            try {
                await expect(
                    platformService.downloadSession({
                        userId: 'u1',
                        sessionId: 'missing-session',
                    })
                ).rejects.toThrow(new AppError('Session not found', 404))
            } finally {
                platformRepository.findSessionByIdAndUser = originalFind
            }
        })

        it('should return github archive download url when session is linked to github', async () => {
            const originalFind = platformRepository.findSessionByIdAndUser
            platformRepository.findSessionByIdAndUser = (async () => ({
                id: 's1',
                title: 'My Cool App',
                githubRepoOwner: 'phasehumans',
                githubRepoName: 'cool-app',
            })) as any

            try {
                const res = await platformService.downloadSession({
                    userId: 'u1',
                    sessionId: 's1',
                })

                expect(res.fileName).toBe('My-Cool-App.zip')
                expect(res.downloadUrl).toBe(
                    'https://github.com/phasehumans/cool-app/archive/refs/heads/main.zip'
                )
                expect(res.zip).toBeUndefined()
            } finally {
                platformRepository.findSessionByIdAndUser = originalFind
            }
        })

        it('should return git archive zip from sandbox when session is not linked to github', async () => {
            const originalFind = platformRepository.findSessionByIdAndUser
            platformRepository.findSessionByIdAndUser = (async () => ({
                id: 's1',
                title: 'Unlinked App',
                githubRepoOwner: null,
                githubRepoName: null,
                vmId: 'sb-12345',
            })) as any

            try {
                const res = await platformService.downloadSession({
                    userId: 'u1',
                    sessionId: 's1',
                })

                expect(res.fileName).toBe('Unlinked-App.zip')
                expect(res.zip).toBeDefined()
                expect(res.downloadUrl).toBeUndefined()
            } finally {
                platformRepository.findSessionByIdAndUser = originalFind
            }
        })
    })

    describe('updateRepo', () => {
        it('should throw AppError 400 if session is not linked to github', async () => {
            const originalFind = platformRepository.findSessionByIdAndUser
            platformRepository.findSessionByIdAndUser = (async () => ({
                id: 's1',
                githubRepoOwner: null,
                githubRepoName: null,
            })) as any

            try {
                await expect(
                    platformService.updateRepo({
                        userId: 'u1',
                        sessionId: 's1',
                    })
                ).rejects.toThrow(
                    new AppError('Session is not linked to any GitHub repository', 400)
                )
            } finally {
                platformRepository.findSessionByIdAndUser = originalFind
            }
        })

        it('should execute native git commands in sandbox and update session synced', async () => {
            const originalFind = platformRepository.findSessionByIdAndUser
            const originalFindGithub = platformRepository.findUserGithubConnection
            const originalUpdateSynced = platformRepository.updateSessionSynced

            platformRepository.findSessionByIdAndUser = (async () => ({
                id: 's1',
                githubRepoOwner: 'owner1',
                githubRepoName: 'repo1',
                vmId: 'sb-git-vm',
            })) as any

            platformRepository.findUserGithubConnection = (async () => ({
                githubToken: 'gh-token-abc',
                githubConnected: true,
            })) as any

            let sessionSyncedId = ''
            platformRepository.updateSessionSynced = (async (id: string) => {
                sessionSyncedId = id
                return { id, githubLastSyncedAt: new Date() } as any
            }) as any

            const executedCommands: string[] = []
            setMockSandboxRunner(async (opts) => {
                executedCommands.push(opts.command)
                return {
                    exitCode: 0,
                    stdout: 'commit-sha-789xyz\n',
                    stderr: '',
                }
            })

            try {
                const res = await platformService.updateRepo({
                    userId: 'u1',
                    sessionId: 's1',
                    commitMessage: 'feat: add native git sync',
                })

                expect(sessionSyncedId).toBe('s1')
                expect(res.commitSha).toBe('commit-sha-789xyz')
                expect(executedCommands.some((c) => c.includes('git add -A'))).toBe(true)
                expect(executedCommands.some((c) => c.includes('git push origin'))).toBe(true)
                expect(
                    executedCommands.some((c) =>
                        c.includes("git commit -m 'feat: add native git sync'")
                    )
                ).toBe(true)
            } finally {
                platformRepository.findSessionByIdAndUser = originalFind
                platformRepository.findUserGithubConnection = originalFindGithub
                platformRepository.updateSessionSynced = originalUpdateSynced
            }
        })
    })

    describe('deployVercelDirect', () => {
        it('should throw AppError 400 if vercel credentials are not connected', async () => {
            const originalFind = platformRepository.findSessionByIdAndUser
            const originalCreds = platformRepository.getVercelCredentials

            platformRepository.findSessionByIdAndUser = (async () => ({ id: 's1' })) as any
            platformRepository.getVercelCredentials = (async () => ({
                vercelConnected: false,
                vercelAccessToken: null,
            })) as any

            try {
                await expect(
                    platformService.deployVercelDirect({
                        userId: 'u1',
                        sessionId: 's1',
                        vercelProjectId: 'v-prj',
                        vercelProjectName: 'v-name',
                    })
                ).rejects.toThrow(new AppError('vercel account not connected', 400))
            } finally {
                platformRepository.findSessionByIdAndUser = originalFind
                platformRepository.getVercelCredentials = originalCreds
            }
        })

        it('should invoke vercel CLI in sandbox and record deployment url', async () => {
            const originalFind = platformRepository.findSessionByIdAndUser
            const originalCreds = platformRepository.getVercelCredentials
            const originalUpdateDeploy = platformRepository.updateSessionVercelDeployment

            platformRepository.findSessionByIdAndUser = (async () => ({
                id: 's1',
                vmId: 'sb-vercel-vm',
            })) as any

            platformRepository.getVercelCredentials = (async () => ({
                vercelConnected: true,
                vercelAccessToken: 'v-token-secret',
                vercelTeamId: 'team_xyz',
            })) as any

            let updatedDeployment: any = null
            platformRepository.updateSessionVercelDeployment = (async (data: any) => {
                updatedDeployment = data
                return {} as any
            }) as any

            const commandsRun: string[] = []
            setMockSandboxRunner(async (opts) => {
                commandsRun.push(opts.command)
                return {
                    exitCode: 0,
                    stdout: 'Vercel CLI 34.0.0\nDeploying...\nhttps://my-app.vercel.app\n',
                    stderr: '',
                }
            })

            try {
                const res = await platformService.deployVercelDirect({
                    userId: 'u1',
                    sessionId: 's1',
                    vercelProjectId: 'v-prj',
                    vercelProjectName: 'v-name',
                })

                expect(
                    commandsRun.some((cmd) => cmd.includes('vercel deploy --token v-token-secret'))
                ).toBe(true)
                expect(commandsRun.some((cmd) => cmd.includes('--scope team_xyz'))).toBe(true)
                expect(updatedDeployment?.url).toBe('https://my-app.vercel.app')
                expect(res.url).toBe('https://my-app.vercel.app')
                expect(res.readyState).toBe('READY')
            } finally {
                platformRepository.findSessionByIdAndUser = originalFind
                platformRepository.getVercelCredentials = originalCreds
                platformRepository.updateSessionVercelDeployment = originalUpdateDeploy
            }
        })
    })

    describe('getUserGithubRepos', () => {
        it('should throw AppError 404 if user not found', async () => {
            const originalFind = platformRepository.findUserGithubConnection
            platformRepository.findUserGithubConnection = (async () => null) as any

            try {
                await expect(platformService.getUserGithubRepos({ userId: 'u1' })).rejects.toThrow(
                    new AppError('user not found', 404)
                )
            } finally {
                platformRepository.findUserGithubConnection = originalFind
            }
        })

        it('should throw AppError 401 if github is not connected', async () => {
            const originalFind = platformRepository.findUserGithubConnection
            platformRepository.findUserGithubConnection = (async () => ({
                githubConnected: false,
                githubToken: null,
            })) as any

            try {
                await expect(platformService.getUserGithubRepos({ userId: 'u1' })).rejects.toThrow(
                    new AppError('github is not connected', 401)
                )
            } finally {
                platformRepository.findUserGithubConnection = originalFind
            }
        })
    })

    describe('unlinkGithubRepo and unlinkVercelProject', () => {
        it('unlinkGithubRepo should unlink and return success message', async () => {
            const originalFind = platformRepository.findSessionByIdAndUser
            const originalUnlink = platformRepository.unlinkSessionGithub

            platformRepository.findSessionByIdAndUser = (async () => ({ id: 's1' })) as any
            platformRepository.unlinkSessionGithub = async () => ({}) as any

            try {
                const res = await platformService.unlinkGithubRepo({
                    userId: 'u1',
                    sessionId: 's1',
                })
                expect(res.message).toBe('GitHub repository unlinked successfully')
            } finally {
                platformRepository.findSessionByIdAndUser = originalFind
                platformRepository.unlinkSessionGithub = originalUnlink
            }
        })

        it('unlinkVercelProject should unlink and return success message', async () => {
            const originalFind = platformRepository.findSessionByIdAndUser
            const originalUnlink = platformRepository.unlinkSessionVercel

            platformRepository.findSessionByIdAndUser = (async () => ({ id: 's1' })) as any
            platformRepository.unlinkSessionVercel = async () => ({}) as any

            try {
                const res = await platformService.unlinkVercelProject({
                    userId: 'u1',
                    sessionId: 's1',
                })
                expect(res.message).toBe('Vercel project unlinked successfully')
            } finally {
                platformRepository.findSessionByIdAndUser = originalFind
                platformRepository.unlinkSessionVercel = originalUnlink
            }
        })
    })

    describe('syncEnvironmentVariables', () => {
        it('should throw AppError 400 if session is not linked to a Vercel project', async () => {
            const originalFind = platformRepository.findSessionByIdAndUser
            platformRepository.findSessionByIdAndUser = (async () => ({
                id: 's1',
                vercelProjectId: null,
            })) as any

            try {
                await expect(
                    platformService.syncEnvironmentVariables({
                        userId: 'u1',
                        sessionId: 's1',
                    })
                ).rejects.toThrow(new AppError('Session is not linked to a Vercel project', 400))
            } finally {
                platformRepository.findSessionByIdAndUser = originalFind
            }
        })

        it('should sync filtered environment variables to Vercel', async () => {
            const originalFind = platformRepository.findSessionByIdAndUser
            const originalGetMemories = platformRepository.getSessionMemories
            const originalAddEnv = vercelService.addEnvVars

            platformRepository.findSessionByIdAndUser = (async () => ({
                id: 's1',
                vercelProjectId: 'prj_123',
            })) as any

            platformRepository.getSessionMemories = (async () => [
                { key: 'API_KEY', value: 'secret' },
                { key: 'PORT', value: '3000' },
            ]) as any

            let passedVars: any = null
            vercelService.addEnvVars = (async (data: any) => {
                passedVars = data.envVars
                return {} as any
            }) as any

            try {
                const res = await platformService.syncEnvironmentVariables({
                    userId: 'u1',
                    sessionId: 's1',
                    keys: ['API_KEY'],
                })

                expect(res.message).toBe('Environment variables synced successfully')
                expect(passedVars.length).toBe(1)
                expect(passedVars[0].key).toBe('API_KEY')
            } finally {
                platformRepository.findSessionByIdAndUser = originalFind
                platformRepository.getSessionMemories = originalGetMemories
                vercelService.addEnvVars = originalAddEnv
            }
        })
    })
})
