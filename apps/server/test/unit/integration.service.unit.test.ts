import { describe, it, expect } from 'bun:test'

import { integrationRepository } from '../../src/modules/integration/integration.repository'
import { integrationsService } from '../../src/modules/integration/integration.service'
import { notificationService } from '../../src/modules/notification/notification.service'

describe('Integration Service - Unit Tests', () => {
    describe('connectGithub', () => {
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
    })

    // The GitHub App webhook matches installers by GitHub id, so connecting from Settings
    // has to save it too
    describe('saving the github id on connect', () => {
        const connectWith = async (opts: {
            user: { githubId?: string | null }
            holder: { id: string } | null
            githubId?: string
        }) => {
            const originalFind = integrationRepository.findUserFirst
            const originalFindByGithubId = integrationRepository.findUserByGithubId
            const originalUpdate = integrationRepository.updateUserGithub
            const originalSendNotif = notificationService.sendNotificationToUser
            let updatePayload: any = null
            integrationRepository.findUserFirst = (async () => ({
                id: 'u1',
                isDeleted: false,
                ...opts.user,
            })) as any
            integrationRepository.findUserByGithubId = (async () => opts.holder) as any
            integrationRepository.updateUserGithub = (async (data: any) => {
                updatePayload = data
                return { id: data.id, githubConnected: true } as any
            }) as any
            notificationService.sendNotificationToUser = async () => ({}) as any
            try {
                await integrationsService.connectGithub({
                    userId: 'u1',
                    accessToken: 'gho_token',
                    username: 'octocat',
                    githubId: opts.githubId,
                })
                return updatePayload
            } finally {
                integrationRepository.findUserFirst = originalFind
                integrationRepository.findUserByGithubId = originalFindByGithubId
                integrationRepository.updateUserGithub = originalUpdate
                notificationService.sendNotificationToUser = originalSendNotif
            }
        }

        it('saves the github id when the user has none and no one else holds it', async () => {
            const payload = await connectWith({
                user: { githubId: null },
                holder: null,
                githubId: '583231',
            })
            expect(payload.githubId).toBe('583231')
        })

        it('keeps the github id the user already has (their github login identity)', async () => {
            const payload = await connectWith({
                user: { githubId: '111' },
                holder: null,
                githubId: '583231',
            })
            expect(payload.githubId).toBeUndefined()
        })

        it('does not take a github id that another account holds', async () => {
            const payload = await connectWith({
                user: { githubId: null },
                holder: { id: 'other-user' },
                githubId: '583231',
            })
            expect(payload.githubId).toBeUndefined()
            expect(payload.username).toBe('octocat')
        })
    })
})
