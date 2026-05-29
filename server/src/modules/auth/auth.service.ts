import crypto from 'crypto'

import bcrypt from 'bcrypt'

import { prisma } from '../../config/db'
import { AppError } from '../../utils/appError'

// import { authSession, deleteSessionById, isSessionExpired } from './auth.session'
// import { authToken } from './auth.token'
import { sendNotificationToUser } from '../notification/notification.service'

import {
    sendOTP,
    getNameFromEmail,
    getUsername,
    generateAccessToken,
    generateRefreshToken,
    getRefreshTokenExpiryDate,
    verifyRefreshToken,
    isSessionExpired,
} from './auth.utils'

type Signup = {
    email: string
    password: string
}

type VerifyOtp = {
    email: string
    otp: string
    userAgent?: string
    ipAddress?: string
}

type Login = {
    email: string
    password: string
    userAgent?: string
    ipAddress?: string
}

type Google = {
    name: string
    email: string
    sub: string
    userAgent?: string
    ipAddress?: string
}

type RefreshSession = {
    refreshToken?: string
}

type RequestPasswordReset = {
    email: string
}

type VerifyPasswordResetOtp = {
    email: string
    otp: string
}

type ResetPassword = VerifyPasswordResetOtp & {
    newPassword: string
}

const signup = async (data: Signup) => {
    const { email, password } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            email: email,
        },
    })

    if (existingUser) {
        if (!existingUser.password) {
            throw new AppError('google_account_exists', 400)
        }
        throw new AppError('email already exists', 409)
    }

    let name = getNameFromEmail(email)
    const username = getUsername()

    if (!name) {
        name = username
    }

    const hashPassword = await bcrypt.hash(password, 10)
    const otp = crypto.randomInt(100000, 1000000).toString()
    const otpHash = await bcrypt.hash(otp, 10)

    const newUser = await prisma.user.create({
        data: {
            name: name,
            email: email,
            username: username,
            password: hashPassword,
            emailVerified: false,
            otpHash: otpHash,
            otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
    })

    console.log(otp)

    await sendOTP(newUser.email, otp)

    return { message: 'otp sent successfully' }
}

const verifyOtp = async (data: VerifyOtp) => {
    const { email, otp, userAgent, ipAddress } = data

    const user = await prisma.user.findUnique({
        where: {
            email: email,
        },
    })

    if (!user) {
        throw new AppError('user not found', 404)
    }

    if (user.deletedAt || user.isDeleted) {
        throw new AppError('account has been deleted', 403)
    }

    if (user.emailVerified) {
        throw new AppError('email already verified', 400)
    }

    if (!user.otpHash || !user.otpExpiresAt) {
        throw new AppError('otp not found, request new one', 400)
    }

    if (user.otpExpiresAt < new Date()) {
        await prisma.user.update({
            where: {
                id: user.id,
            },
            data: {
                otpHash: null,
                otpExpiresAt: null,
            },
        })

        throw new AppError('otp expired', 401)
    }

    const isValid = await bcrypt.compare(otp, user.otpHash)

    if (!isValid) {
        throw new AppError('invalid otp', 401)
    }

    await prisma.user.update({
        where: {
            id: user.id,
        },
        data: {
            emailVerified: true,
            otpHash: null,
            otpExpiresAt: null,
        },
    })

    const sessionId = crypto.randomUUID()

    const accessToken = generateAccessToken({
        userId: user.id,
        sessionId,
    })

    // added jti; to grab specific token
    const refreshToken = generateRefreshToken({
        userId: user.id,
        sessionId,
    })

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10)

    await prisma.session.create({
        data: {
            id: sessionId,
            userId: user.id,
            refreshTokenHash: refreshTokenHash,
            userAgent: userAgent,
            ipAddress: ipAddress,
            expiresAt: getRefreshTokenExpiryDate(),
        },
    })

    try {
        await sendNotificationToUser({
            userId: user.id,
            title: 'Welcome to December',
            message:
                'Your account has been created successfully. You can now start building apps, generating code, and turning your ideas into production-ready projects with AI.',
            type: 'SUCCESS',
        })
    } catch (error) {
        console.error('failed to send welcome notification:', error)
    }

    return {
        accessToken,
        refreshToken,
    }
}

const login = async (data: Login) => {
    const { email, password, userAgent, ipAddress } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            email,
        },
    })

    if (!existingUser) {
        throw new AppError('invalid email or password', 401)
    }

    // add CTA to contact support @ for recover account
    if (existingUser.deletedAt || existingUser.isDeleted) {
        throw new AppError('account has been deleted', 401)
    }

    if (!existingUser.emailVerified) {
        throw new AppError('please verify your email', 401)
    }

    if (!existingUser.password) {
        throw new AppError('please continue with google login', 401)
    }

    const isPasswordMatch = await bcrypt.compare(password, existingUser.password)

    if (!isPasswordMatch) {
        throw new AppError('invalid email or password', 401)
    }

    const sessionId = crypto.randomUUID()

    const accessToken = generateAccessToken({
        userId: existingUser.id,
        sessionId,
    })

    const refreshToken = generateRefreshToken({
        userId: existingUser.id,
        sessionId,
    })

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10)

    await prisma.session.create({
        data: {
            id: sessionId,
            userId: existingUser.id,
            refreshTokenHash: refreshTokenHash,
            userAgent: userAgent,
            ipAddress: ipAddress,
            expiresAt: getRefreshTokenExpiryDate(),
        },
    })

    try {
        await sendNotificationToUser({
            userId: existingUser.id,
            title: 'Successful Sign-in',
            message: 'You have successfully signed in to your account.',
            type: 'SUCCESS',
        })
    } catch (error) {
        console.error('failed to send sign-in notification:', error)
    }

    return {
        accessToken,
        refreshToken,
    }
}

const requestPasswordReset = async (data: RequestPasswordReset) => {
    const user = await prisma.user.findUnique({
        where: {
            email: data.email,
        },
    })

    if (!user || user.deletedAt || user.isDeleted || !user.emailVerified) {
        return
    }

    const otp = crypto.randomInt(100000, 1000000).toString()
    const otpHash = await bcrypt.hash(otp, 10)

    await prisma.user.update({
        where: {
            id: user.id,
        },
        data: {
            otpHash,
            otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
    })

    console.log(otp)

    await sendOTP(user.email, otp)
}

const verifyPasswordResetOtp = async (data: VerifyPasswordResetOtp) => {
    const { email, otp } = data
    const user = await prisma.user.findUnique({
        where: {
            email,
        },
    })

    if (!user || user.deletedAt || user.isDeleted || !user.emailVerified) {
        throw new AppError('invalid or expired reset code', 401)
    }

    if (!user.otpHash || !user.otpExpiresAt) {
        throw new AppError('invalid or expired reset code', 401)
    }

    if (user.otpExpiresAt < new Date()) {
        await prisma.user.update({
            where: {
                id: user.id,
            },
            data: {
                otpHash: null,
                otpExpiresAt: null,
            },
        })

        throw new AppError('invalid or expired reset code', 401)
    }

    const isValid = await bcrypt.compare(otp, user.otpHash)

    if (!isValid) {
        throw new AppError('invalid or expired reset code', 401)
    }

    return user
}

const resetPassword = async (data: ResetPassword) => {
    const { email, otp, newPassword } = data

    const user = await prisma.user.findUnique({
        where: {
            email,
        },
    })

    if (!user || user.deletedAt || user.isDeleted || !user.emailVerified) {
        throw new AppError('invalid or expired reset code', 401)
    }

    if (!user.otpHash || !user.otpExpiresAt) {
        throw new AppError('invalid or expired reset code', 401)
    }

    if (user.otpExpiresAt < new Date()) {
        await prisma.user.update({
            where: {
                id: user.id,
            },
            data: {
                otpHash: null,
                otpExpiresAt: null,
            },
        })

        throw new AppError('invalid or expired reset code', 401)
    }

    const isValid = await bcrypt.compare(otp, user.otpHash)

    if (!isValid) {
        throw new AppError('invalid or expired reset code', 401)
    }

    const password = await bcrypt.hash(newPassword, 10)

    await prisma.$transaction([
        prisma.user.update({
            where: {
                id: user.id,
            },
            data: {
                password,
                otpHash: null,
                otpExpiresAt: null,
            },
        }),
        prisma.session.updateMany({
            where: {
                userId: user.id,
                isRevoked: false,
            },
            data: {
                isRevoked: true,
                revokedAt: new Date(),
            },
        }),
    ])
}

const google = async (data: Google) => {
    const { name, email, sub, userAgent, ipAddress } = data

    let user = await prisma.user.findUnique({
        where: {
            email: email,
        },
    })

    const username = getUsername()
    let isNewUser = false

    if (!user) {
        isNewUser = true
        user = await prisma.user.create({
            data: {
                email: email,
                username: username,
                emailVerified: true,
                googleId: sub,
                name: name,
            },
        })

        try {
            await sendNotificationToUser({
                userId: user.id,
                title: 'Welcome to December',
                message:
                    'Your account has been created successfully via Google. You can now start building apps, generating code, and turning your ideas into production-ready projects with AI.',
                type: 'SUCCESS',
            })
        } catch (error) {
            console.error('failed to send welcome notification:', error)
        }
    } else if (user.deletedAt || user.isDeleted) {
        throw new AppError('account has been deleted', 403)
    } else if (!user.googleId) {
        user = await prisma.user.update({
            where: {
                id: user.id,
            },
            data: {
                googleId: sub,
                emailVerified: true,
                otpHash: null,
                otpExpiresAt: null,
            },
        })
    } else if (user.googleId !== sub) {
        throw new AppError('google id mismatch', 400)
    }

    if (!isNewUser) {
        try {
            await sendNotificationToUser({
                userId: user.id,
                title: 'Successful Sign-in',
                message: 'You have successfully signed in to your account via Google.',
                type: 'SUCCESS',
            })
        } catch (error) {
            console.error('failed to send Google sign-in notification:', error)
        }
    }

    const sessionId = crypto.randomUUID()

    const accessToken = generateAccessToken({
        userId: user.id,
        sessionId,
    })

    const refreshToken = generateRefreshToken({
        userId: user.id,
        sessionId,
    })

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10)

    await prisma.session.create({
        data: {
            id: sessionId,
            userId: user.id,
            refreshTokenHash,
            userAgent: userAgent,
            ipAddress: ipAddress,
            expiresAt: getRefreshTokenExpiryDate(),
        },
    })

    return {
        accessToken,
        refreshToken,
    }
}

const refreshSession = async (data: RefreshSession) => {
    const { refreshToken } = data

    if (!refreshToken) {
        throw new AppError('refresh token is required', 401)
    }

    let payload: { userId: string; sessionId: string }

    try {
        payload = verifyRefreshToken(refreshToken)
    } catch {
        throw new AppError('invalid or expired refresh token', 401)
    }

    const { userId, sessionId } = payload

    const session = await prisma.session.findUnique({
        where: {
            id: sessionId,
        },
    })

    if (!session) {
        throw new AppError('session not found', 401)
    }

    if (session.userId !== userId) {
        await prisma.session.deleteMany({
            where: {
                id: session.id,
            },
        })
        throw new AppError('invalid session', 401)
    }

    if (isSessionExpired(session.expiresAt)) {
        await prisma.session.deleteMany({
            where: {
                id: session.id,
            },
        })
        throw new AppError('session expired', 401)
    }

    const isRefreshTokenValid = await bcrypt.compare(refreshToken, session.refreshTokenHash)

    if (!isRefreshTokenValid) {
        await prisma.session.deleteMany({
            where: {
                id: session.id,
            },
        })
        throw new AppError('invalid refresh token', 401)
    }

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    })

    if (!user) {
        await prisma.session.deleteMany({
            where: {
                id: session.id,
            },
        })
        throw new AppError('user not found', 401)
    }

    if (user.deletedAt || user.isDeleted) {
        await prisma.session.deleteMany({
            where: {
                id: session.id,
            },
        })
        throw new AppError('account no longer exists', 401)
    }

    const accessToken = generateAccessToken({
        userId: user.id,
        sessionId: session.id,
    })

    const newRefreshToken = generateRefreshToken({
        userId: user.id,
        sessionId: session.id,
    })

    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10)

    await prisma.session.update({
        where: {
            id: session.id,
        },
        data: {
            refreshTokenHash: newRefreshTokenHash,
            expiresAt: getRefreshTokenExpiryDate(),
        },
    })

    return {
        accessToken,
        refreshToken: newRefreshToken,
    }
}

export const authService = {
    signup,
    verifyOtp,
    login,
    requestPasswordReset,
    verifyPasswordResetOtp,
    resetPassword,
    google,
    refreshSession,
}
