import { prisma } from '@december/database'

import { AppError } from '../../shared/appError'

import type { Prisma } from '@december/database'

export const billingRepository = {
    async findUserForOverview(id: string) {
        return prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                subscriptionPlan: true,
                subscriptionStatus: true,
                currentPeriodEnd: true,
                subscription: true,
                createdAt: true,
                creditBalance: true,
                giftedCredits: true,
            },
        })
    },

    async aggregateUsage(userId: string, periodStart: Date, periodEnd: Date, isPro: boolean) {
        return prisma.usageEvent.aggregate({
            where: {
                userId,
                ...(isPro ? { periodStart } : {}),
                createdAt: {
                    gte: periodStart,
                    lt: periodEnd,
                },
            },
            _sum: {
                costInCents: true,
                inputTokens: true,
                outputTokens: true,
                totalTokens: true,
            },
        })
    },

    async findRedeemCodeClaims(userId: string) {
        return prisma.redeemCodeClaim.findMany({
            where: { userId },
            include: {
                redeemCode: true,
            },
        })
    },

    async findUserForCreateSub(id: string) {
        return prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                subscriptionPlan: true,
                subscriptionStatus: true,
                currentPeriodEnd: true,
                subscription: true,
            },
        })
    },

    async findSubscriptionByProviderId(providerSubscriptionId: string) {
        return prisma.subscription.findUnique({
            where: {
                providerSubscriptionId,
            },
            select: {
                userId: true,
            },
        })
    },

    async findUserPlan(id: string) {
        return prisma.user.findUnique({
            where: { id },
            select: {
                subscriptionPlan: true,
            },
        })
    },

    async findSubscriptionByUserId(userId: string) {
        return prisma.subscription.findUnique({
            where: { userId },
            select: {
                currentPeriodStart: true,
                plan: true,
            },
        })
    },

    async persistProviderSubscription(data: {
        userId: string
        userPlan: string
        userStatus: string
        periodEnd: Date
        nextCreditBalance?: number
        providerSubscriptionId: string
        providerCustomerId: string | null
        providerPlanId: string
        status: string
        cancelAtPeriodEnd: boolean
        periodStart: Date
    }) {
        const {
            userId,
            userPlan,
            userStatus,
            periodEnd,
            nextCreditBalance,
            providerSubscriptionId,
            providerCustomerId,
            providerPlanId,
            status,
            cancelAtPeriodEnd,
            periodStart,
        } = data

        return prisma.$transaction([
            prisma.subscription.upsert({
                where: {
                    userId,
                },
                create: {
                    userId,
                    provider: 'razorpay',
                    providerSubscriptionId,
                    providerCustomerId,
                    providerPlanId,
                    status,
                    plan: 'PRO',
                    cancelAtPeriodEnd,
                    currentPeriodStart: periodStart,
                    currentPeriodEnd: periodEnd,
                },
                update: {
                    provider: 'razorpay',
                    providerSubscriptionId,
                    providerCustomerId,
                    providerPlanId,
                    status,
                    plan: 'PRO',
                    cancelAtPeriodEnd,
                    currentPeriodStart: periodStart,
                    currentPeriodEnd: periodEnd,
                },
            }),
            prisma.user.update({
                where: {
                    id: userId,
                },
                data: {
                    subscriptionPlan: userPlan,
                    subscriptionStatus: userStatus,
                    currentPeriodEnd: periodEnd,
                    ...(nextCreditBalance !== undefined
                        ? { creditBalance: nextCreditBalance }
                        : {}),
                },
            }),
        ])
    },

    async cancelSubscription(data: {
        userId: string
        providerStatus: string
        cancelAtPeriodEnd: boolean
        periodStart: Date
        periodEnd: Date
        nextUserPlan: string
        nextUserStatus: string
    }) {
        const {
            userId,
            providerStatus,
            cancelAtPeriodEnd,
            periodStart,
            periodEnd,
            nextUserPlan,
            nextUserStatus,
        } = data

        return prisma.$transaction([
            prisma.subscription.update({
                where: {
                    userId,
                },
                data: {
                    status: providerStatus,
                    cancelAtPeriodEnd,
                    currentPeriodStart: periodStart,
                    currentPeriodEnd: periodEnd,
                },
            }),
            prisma.user.update({
                where: {
                    id: userId,
                },
                data: {
                    subscriptionPlan: nextUserPlan,
                    subscriptionStatus: nextUserStatus,
                    currentPeriodEnd: periodEnd,
                },
            }),
        ])
    },

    async findManyUsageEvents(where: any, offset: number, limit: number) {
        return prisma.usageEvent.findMany({
            where,
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                project: {
                    select: {
                        name: true,
                    },
                },
            },
            skip: offset,
            take: limit,
        })
    },

    async countUsageEvents(where: any) {
        return prisma.usageEvent.count({
            where,
        })
    },

    async findUserById(id: string) {
        return prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                isDeleted: true,
            },
        })
    },

    async redeemCode(data: { userId: string; codeHash: string }) {
        const { userId, codeHash } = data
        return prisma.$transaction(async (tx) => {
            const dbCode = await tx.redeemCode.findUnique({
                where: { codeHash },
            })

            if (!dbCode) {
                throw new AppError('invalid or expired redeem code', 404)
            }

            const now = new Date()
            if (dbCode.expiresAt && dbCode.expiresAt < now) {
                throw new AppError('this redeem code has expired', 400)
            }

            if (dbCode.maxRedemptions !== null && dbCode.redemptionCount >= dbCode.maxRedemptions) {
                throw new AppError('this redeem code has reached its maximum redemptions', 400)
            }

            const existingClaim = await tx.redeemCodeClaim.findUnique({
                where: {
                    redeemCodeId_userId: {
                        redeemCodeId: dbCode.id,
                        userId,
                    },
                },
            })

            if (existingClaim) {
                throw new AppError('you have already redeemed this code', 409)
            }

            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: {
                    giftedCredits: {
                        increment: dbCode.creditAmount,
                    },
                },
            })

            await tx.redeemCodeClaim.create({
                data: {
                    redeemCodeId: dbCode.id,
                    userId,
                },
            })

            await tx.redeemCode.update({
                where: { id: dbCode.id },
                data: {
                    redemptionCount: {
                        increment: 1,
                    },
                },
            })

            return {
                creditAmount: dbCode.creditAmount,
                newBalance: updatedUser.giftedCredits,
            }
        })
    },

    async findUserByIdForCredits(id: string) {
        return prisma.user.findUnique({
            where: { id },
        })
    },

    async addCredits(userId: string, amountInCents: number) {
        return prisma.user.update({
            where: { id: userId },
            data: {
                creditBalance: {
                    increment: amountInCents,
                },
            },
        })
    },
}
