import { describe, it, expect, afterEach } from 'bun:test'

import { platformRepository } from '../../src/modules/platform/platform.repository'
import { platformService } from '../../src/modules/platform/platform.service'
import { setMockSandboxRunner } from '../../src/modules/platform/platform.utils'
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

    describe('unlinkGithubRepo', () => {
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
    })
})
