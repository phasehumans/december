import '../../env'

import { prisma } from '@december/database'
import bcrypt from 'bcrypt'
import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test'

mock.module('axios', () => ({
    default: {
        post: mock(async (url: string) => {
            if (url.includes('supabase.com')) {
                return {
                    data: {
                        access_token: 'supa_access',
                        refresh_token: 'supa_refresh',
                        expires_in: 3600,
                        scope: 'all',
                    },
                }
            }
            if (url.includes('notion.com')) {
                return {
                    data: {
                        access_token: 'notion_access',
                        workspace_id: 'ws_123',
                        workspace_name: 'My Workspace',
                    },
                }
            }
            return { data: {} }
        }),
    },
}))

global.fetch = mock(async (url: string | URL | Request) => {
    if (url.toString().includes('vercel.com')) {
        return {
            ok: true,
            text: async () => JSON.stringify({ access_token: 'vercel_access' }),
        }
    }
    return { ok: false, text: async () => 'error' }
}) as any

import { integrationsService } from '../../../src/modules/integration/integration.service'

const HASHED_PASSWORD = await bcrypt.hash('Password123', 10)

const createUser = async (overrides: Record<string, unknown> = {}) => {
    return prisma.user.create({
        data: {
            name: 'Integration Tester',
            email: `test-${crypto.randomUUID()}@example.com`,
            username: `user_${crypto.randomUUID().slice(0, 12)}`,
            password: HASHED_PASSWORD,
            emailVerified: true,
            isDeleted: false,
            ...overrides,
        },
    })
}

describe('integrations.service.integration', () => {
    let userId: string

    beforeEach(async () => {
        await prisma.authSession.deleteMany()
        await prisma.user.deleteMany()

        const user = await createUser()
        userId = user.id
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    describe('connectGithub', () => {
        it('should connect github successfully', async () => {
            const result = await integrationsService.connectGithub({
                userId,
                username: 'githubUser',
                accessToken: 'token123',
            })

            expect(result.githubConnected).toBe(true)
            expect(result.githubUsername).toBe('githubUser')
        })

        it('should fail if user not found', async () => {
            await expect(
                integrationsService.connectGithub({
                    userId: 'invalid',
                    username: 'x',
                    accessToken: 'y',
                })
            ).rejects.toThrow('user not found')
        })

        it('should persist github connection in database', async () => {
            await integrationsService.connectGithub({
                userId,
                username: 'ghuser',
                accessToken: 'tok',
            })

            const db = await prisma.user.findUnique({ where: { id: userId } })
            expect(db!.githubConnected).toBe(true)
            expect(db!.githubUsername).toBe('ghuser')
            expect(db!.githubToken).toBe('tok')
        })
    })

    describe('connectVercel', () => {
        it('should connect vercel successfully', async () => {
            const result = await integrationsService.connectVercel({
                userId,
                code: 'valid_code',
                teamId: 'team123',
                configurationId: 'config123',
            })

            expect(result.vercelConnected).toBe(true)
            expect(result.vercelAccessToken).toBe('vercel_access')
            expect(result.vercelTeamId).toBe('team123')
            expect(result.vercelConfigurationId).toBe('config123')
        })

        it('should fail if user not found', async () => {
            await expect(
                integrationsService.connectVercel({
                    userId: 'invalid',
                    code: 'x',
                })
            ).rejects.toThrow('user not found')
        })
    })

    describe('connectSupabase', () => {
        it('should connect supabase successfully', async () => {
            const result = await integrationsService.connectSupabase({
                userId,
                code: 'valid_code',
            })

            expect(result.supabaseConnected).toBe(true)
            expect(result.supabaseAccessToken).toBe('supa_access')
            expect(result.supabaseRefreshToken).toBe('supa_refresh')
            expect(result.supabaseTokenScope).toBe('all')
            expect(result.supabaseTokenExpiresAt).toBeDefined()
        })

        it('should fail if user not found', async () => {
            await expect(
                integrationsService.connectSupabase({
                    userId: 'invalid',
                    code: 'x',
                })
            ).rejects.toThrow('user not found')
        })
    })

    describe('connectNotion', () => {
        it('should connect notion successfully', async () => {
            const result = await integrationsService.connectNotion({
                userId,
                code: 'valid_code',
            })

            expect(result.notionAccessToken).toBe('notion_access')
            expect(result.notionWorkspaceId).toBe('ws_123')
            expect(result.notionWorkspaceName).toBe('My Workspace')
        })

        it('should fail if user not found', async () => {
            await expect(
                integrationsService.connectNotion({
                    userId: 'invalid',
                    code: 'x',
                })
            ).rejects.toThrow('user not found')
        })
    })
})
