import { describe, it, expect } from 'bun:test'

import { integrationRepository } from '../../src/modules/integration/integration.repository'
import { integrationsService } from '../../src/modules/integration/integration.service'
import { notificationService } from '../../src/modules/notification/notification.service'

describe('Integration Service - Unit Tests', () => {
    describe('connectGithub and handleGitHubOAuth', () => {
        it('should update user github connection details', async () => {
            const originalFind = integrationRepository.findUserFirst
            const originalUpdate = integrationRepository.updateUserGithub
            const originalSendNotif = notificationService.sendNotificationToUser

            integrationRepository.findUserFirst = (async () => ({
                id: 'u1',
                isDeleted: false,
            })) as any
            let updatePayload: any = null
            integrationRepository.updateUserGithub = (async (data) => {
                updatePayload = data
                return { id: data.id, githubConnected: true, githubUsername: data.username } as any
            }) as any
            notificationService.sendNotificationToUser = async () => ({}) as any

            try {
                const res = await integrationsService.connectGithub({
                    userId: 'u1',
                    accessToken: 'gho_token123',
                    username: 'octocat',
                })

                expect(updatePayload).toEqual({
                    id: 'u1',
                    accessToken: 'gho_token123',
                    username: 'octocat',
                })
                expect((res as any).githubConnected).toBe(true)
            } finally {
                integrationRepository.findUserFirst = originalFind
                integrationRepository.updateUserGithub = originalUpdate
                notificationService.sendNotificationToUser = originalSendNotif
            }
        })

        it('should fetch access token and github username in handleGitHubOAuth', async () => {
            const originalFind = integrationRepository.findUserFirst
            const originalUpdate = integrationRepository.updateUserGithub
            const originalSendNotif = notificationService.sendNotificationToUser
            const originalFetch = globalThis.fetch

            integrationRepository.findUserFirst = (async () => ({
                id: 'u1',
                isDeleted: false,
            })) as any
            let updatePayload: any = null
            integrationRepository.updateUserGithub = (async (data) => {
                updatePayload = data
                return { id: data.id, githubConnected: true, githubUsername: data.username } as any
            }) as any
            notificationService.sendNotificationToUser = async () => ({}) as any

            globalThis.fetch = (async (url: string) => {
                if (url.includes('github.com/login/oauth/access_token')) {
                    return {
                        json: async () => ({ access_token: 'mock-gh-token' }),
                    } as any
                }
                if (url.includes('api.github.com/user')) {
                    return {
                        ok: true,
                        json: async () => ({ login: 'test-user' }),
                    } as any
                }
                return { ok: false } as any
            }) as any

            try {
                const res = await integrationsService.handleGitHubOAuth({
                    code: 'gh-code-123',
                    userId: 'u1',
                })

                expect(updatePayload).toEqual({
                    id: 'u1',
                    accessToken: 'mock-gh-token',
                    username: 'test-user',
                })
                expect((res as any).githubConnected).toBe(true)
            } finally {
                globalThis.fetch = originalFetch
                integrationRepository.findUserFirst = originalFind
                integrationRepository.updateUserGithub = originalUpdate
                notificationService.sendNotificationToUser = originalSendNotif
            }
        })
    })
})
