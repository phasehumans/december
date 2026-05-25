import '../../../tests/env'

import bcrypt from 'bcrypt'
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'

import { prisma } from '../../../src/config/db'
import { integrationsService } from '../../../src/modules/integrations/integrations.service'

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
        await prisma.session.deleteMany()
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

        it('should fail for soft-deleted user', async () => {
            const deleted = await createUser({ isDeleted: true })

            await expect(
                integrationsService.connectGithub({
                    userId: deleted.id,
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
})
