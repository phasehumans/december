import { Prisma, prisma } from '@december/database'

const findByUser = async (userId: string) => prisma.adminTotp.findUnique({ where: { userId } })

const findUserEmail = async (userId: string) =>
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } })

/**
 * A new pending secret, only while the app is not turned on (S3). The check is in the write,
 * so a setup can never replace an authenticator that was just turned on. Returns false when
 * it is on.
 */
const savePendingSecret = async (data: { userId: string; secretEncrypted: string }) => {
    const { userId, secretEncrypted } = data
    const updated = await prisma.adminTotp.updateMany({
        where: { userId, enabledAt: null },
        data: { secretEncrypted, lastUsedStep: null, failedCount: 0, lockedUntil: null },
    })
    if (updated.count === 1) return true
    try {
        await prisma.adminTotp.create({ data: { userId, secretEncrypted } })
        return true
    } catch (err) {
        // a row is there and it is turned on (or another setup made it a moment ago)
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            return false
        }
        throw err
    }
}

/**
 * Takes the code's step only when it is newer than the last one used, so a code works once.
 * Returns false when another request used this step (or a later one) first.
 */
const claimStep = async (data: { userId: string; step: number; enable: boolean }) => {
    const { userId, step, enable } = data
    const result = await prisma.adminTotp.updateMany({
        where: {
            userId,
            OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }],
        },
        data: {
            lastUsedStep: step,
            failedCount: 0,
            lockedUntil: null,
            ...(enable ? { enabledAt: new Date() } : {}),
        },
    })
    return result.count === 1
}

/**
 * Takes one attempt before the code is checked, in one statement: refused while locked or
 * while 5 attempts are already counted. Parallel requests can't get more than 5 tries.
 * Returns the attempt number, or null when no attempt is left. A right code sets it back to 0.
 */
const reserveAttempt = async (data: { userId: string; maxAttempts: number; lockMs: number }) => {
    const { userId, maxAttempts, lockMs } = data
    // B1: one update counts the attempt and, at the last one, sets the lock. A lock that ran
    // out starts the count again. Every value comes from the row itself, which Postgres reads
    // again under the row lock, so parallel attempts can't lose a count
    const rows = await prisma.$queryRaw<Array<{ failedCount: number; lockedUntil: Date | null }>>`
        UPDATE "AdminTotp"
        SET "failedCount" = CASE WHEN "lockedUntil" IS NOT NULL AND "lockedUntil" <= now()
                                 THEN 1 ELSE "failedCount" + 1 END,
            "lockedUntil" = CASE WHEN (CASE WHEN "lockedUntil" IS NOT NULL AND "lockedUntil" <= now()
                                            THEN 1 ELSE "failedCount" + 1 END) >= ${maxAttempts}
                                 THEN now() + (${lockMs} * interval '1 millisecond')
                                 ELSE NULL END,
            "updatedAt" = now()
        WHERE "userId" = ${userId}
            AND ("lockedUntil" IS NULL OR "lockedUntil" <= now())
        RETURNING "failedCount", "lockedUntil"
    `
    return rows[0] ?? null
}

const markSessionVerified = async (sessionId: string) =>
    prisma.authSession.update({
        where: { id: sessionId },
        data: { adminVerifiedAt: new Date() },
        select: { adminVerifiedAt: true },
    })

const findSessionVerifiedAt = async (sessionId: string) =>
    prisma.authSession.findUnique({
        where: { id: sessionId },
        select: { adminVerifiedAt: true },
    })

/** T5: the reset script. Removes the app and ends every code-verified sign-in. */
/**
 * Removes the authenticator and signs the admin out everywhere (S2): after a lost phone, an
 * old sign-in must not be able to set up its own authenticator first. Returns the sign-ins
 * that were ended, so the caller can drop them from the session cache.
 */
const resetForUser = async (userId: string) =>
    prisma.$transaction(async (tx) => {
        const live = await tx.authSession.findMany({
            where: { userId, isRevoked: false },
            select: { id: true },
        })
        await tx.adminTotp.deleteMany({ where: { userId } })
        await tx.authSession.updateMany({
            where: { userId },
            data: { adminVerifiedAt: null, isRevoked: true, revokedAt: new Date() },
        })
        return live.map((session) => session.id)
    })

export const admintotpRepository = {
    findByUser,
    findUserEmail,
    savePendingSecret,
    claimStep,
    reserveAttempt,
    markSessionVerified,
    findSessionVerifiedAt,
    resetForUser,
}
