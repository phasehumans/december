import crypto from 'crypto'

import { prisma } from '@december/database'

import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import type { Request, Response } from 'express'

function generateUserCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return `${result.substring(0, 4)}-${result.substring(4, 8)}`
}

const generateDeviceCode = asyncHandler(async (req: Request, res: Response) => {
    const deviceCode = crypto.randomBytes(32).toString('hex')
    const userCode = generateUserCode()
    const expiresIn = 900 // 15 minutes

    await prisma.deviceCode.create({
        data: {
            deviceCode,
            userCode,
            expiresAt: new Date(Date.now() + expiresIn * 1000),
            status: 'PENDING',
        },
    })

    return sendSuccess(res, 'Device code generated', {
        deviceCode,
        userCode,
        verificationUri: 'http://localhost:3000/activate', // Change to actual production URL later
        expiresIn,
        interval: 5,
    })
})

const pollDeviceToken = asyncHandler(async (req: Request, res: Response) => {
    const { deviceCode } = req.body

    if (!deviceCode) {
        throw new AppError('deviceCode is required', 400)
    }

    const codeRecord = await prisma.deviceCode.findUnique({
        where: { deviceCode },
    })

    if (!codeRecord) {
        throw new AppError('invalid_client', 400)
    }

    if (codeRecord.expiresAt < new Date()) {
        await prisma.deviceCode.update({
            where: { id: codeRecord.id },
            data: { status: 'EXPIRED' },
        })
        throw new AppError('expired_token', 400)
    }

    if (codeRecord.status === 'PENDING') {
        throw new AppError('authorization_pending', 400)
    }

    if (codeRecord.status === 'APPROVED' && codeRecord.userId) {
        // Find user to generate token
        const user = await prisma.user.findUnique({
            where: { id: codeRecord.userId },
        })

        if (!user) {
            throw new AppError('User not found', 404)
        }

        const userAgent = req.get('user-agent') || 'device-cli'
        const ipAddress =
            (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
            req.socket.remoteAddress ||
            'unknown'

        // Let's create a new session
        const session = await prisma.authSession.create({
            data: {
                userId: user.id,
                refreshTokenHash: crypto
                    .createHash('sha256')
                    .update(crypto.randomBytes(32).toString('hex'))
                    .digest('hex'),
                userAgent,
                ipAddress,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            },
        })

        const jwt = await import('jsonwebtoken')
        const { env } = await import('../../env')

        const token = jwt.sign(
            { userId: user.id, sessionId: session.id },
            env.ACCESS_TOKEN_SECRET,
            { expiresIn: env.ACCESS_TOKEN_EXPIRES_IN }
        )

        // In this flow we just return the token directly (not via cookies because it's the CLI making the call)
        // Delete the device code to prevent replay attacks
        await prisma.deviceCode.delete({
            where: { id: codeRecord.id },
        })

        return sendSuccess(res, 'Token retrieved successfully', {
            token,
            email: user.email,
        })
    }

    throw new AppError('authorization_pending', 400)
})

const verifyUserCode = asyncHandler(async (req: Request, res: Response) => {
    // This endpoint should be protected by authMiddleware so we have req.user
    const { userCode } = req.body

    if (!userCode) {
        throw new AppError('userCode is required', 400)
    }

    const userId = req.user?.userId
    if (!userId) {
        throw new AppError('Unauthorized', 401)
    }

    const codeRecord = await prisma.deviceCode.findUnique({
        where: { userCode },
    })

    if (!codeRecord) {
        throw new AppError('Invalid code', 404)
    }

    if (codeRecord.expiresAt < new Date()) {
        throw new AppError('This code has expired', 400)
    }

    if (codeRecord.status !== 'PENDING') {
        throw new AppError('This code is no longer pending', 400)
    }

    await prisma.deviceCode.update({
        where: { id: codeRecord.id },
        data: {
            status: 'APPROVED',
            userId,
        },
    })

    return sendSuccess(res, 'Device successfully authorized')
})

export const authDeviceController = {
    generateDeviceCode,
    pollDeviceToken,
    verifyUserCode,
}
