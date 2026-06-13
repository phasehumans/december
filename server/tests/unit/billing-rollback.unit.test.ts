import { describe, expect, test, mock } from 'bun:test'
import { usageService } from '../../src/modules/usage/usage.service'

let mockUserBalance = 10
let mockUserGifted = 0

mock.module('../../src/config/db', () => ({
    prisma: {
        user: {
            findUnique: async () => ({
                id: 'user-id',
                isDeleted: false,
                subscriptionPlan: 'FREE',
                subscriptionStatus: 'FREE',
                createdAt: new Date(),
                creditBalance: mockUserBalance,
                giftedCredits: mockUserGifted,
            }),
        },
    },
}))

describe('billing and rollback enforcements', () => {
    test('canRunSelfCorrection returns true if user balance is above threshold', async () => {
        mockUserBalance = 10
        mockUserGifted = 0
        const result = await usageService.canRunSelfCorrection('user-id')
        expect(result).toBe(true)
    })

    test('canRunSelfCorrection returns false if user balance is below threshold', async () => {
        mockUserBalance = 2
        mockUserGifted = 0
        const result = await usageService.canRunSelfCorrection('user-id')
        expect(result).toBe(false)
    })

    test('canRunSelfCorrection accounts for gifted credits too', async () => {
        mockUserBalance = 2
        mockUserGifted = 4
        const result = await usageService.canRunSelfCorrection('user-id')
        expect(result).toBe(true)
    })
})
