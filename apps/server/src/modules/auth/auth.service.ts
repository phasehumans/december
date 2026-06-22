import crypto from 'crypto'

import bcrypt from 'bcrypt'

import { env } from '../../env'
import { AppError } from '../../shared/appError'
import { sendNotificationToUser } from '../notification/notification.service'

import { authRepository } from './auth.repository'
import {
    sendOTP,
    sendWelcomeEmail,
    getUsername,
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
} from './auth.utils'

import type {
    VerifyOtp,
    Login,
    Google,
    Signup,
    RefreshSession,
    RequestPasswordReset,
    VerifyPasswordResetOtp,
    ResetPassword,
} from './auth.types'

const signup = async (data: Signup) => {
    const { email, password } = data

    const existingUser = await authRepository.findUserByEmail(email)

    if (existingUser) {
        if (!existingUser.password) {
            throw new AppError('google_account_exists', 400)
        }
        if (existingUser.emailVerified) {
            throw new AppError('email already exists', 409)
        }

        const hashPassword = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS)
        const otp = crypto.randomInt(100000, 1000000).toString()
        const otpHash = await bcrypt.hash(otp, env.BCRYPT_SALT_ROUNDS)

        await authRepository.updateUser(existingUser.id, {
            password: hashPassword,
            otpHash,
            otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        })

        await sendOTP(existingUser.email, otp)

        return { message: 'otp sent successfully' }
    }

    let name = email.split('@')[0]?.replace(/\d+/g, '')
    const username = getUsername()

    if (!name) {
        name = username
    }

    const hashPassword = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS)
    const otp = crypto.randomInt(100000, 1000000).toString()
    const otpHash = await bcrypt.hash(otp, env.BCRYPT_SALT_ROUNDS)

    const newUser = await authRepository.createUser({
        name: name,
        email: email,
        username: username,
        password: hashPassword,
        emailVerified: false,
        otpHash: otpHash,
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    })

    await sendOTP(newUser.email, otp)

    return { message: 'otp sent successfully' }
}

const verifyOtp = async (data: VerifyOtp) => {
    const { email, otp, userAgent, ipAddress } = data

    const user = await authRepository.findUserByEmail(email)

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
        await authRepository.updateUser(user.id, {
            otpHash: null,
            otpExpiresAt: null,
        })

        throw new AppError('otp expired', 401)
    }

    const isValid = await bcrypt.compare(otp, user.otpHash)

    if (!isValid) {
        throw new AppError('invalid otp', 401)
    }

    await authRepository.updateUser(user.id, {
        emailVerified: true,
        otpHash: null,
        otpExpiresAt: null,
    })

    const sessionId = crypto.randomUUID()

    const accessToken = generateAccessToken({
        userId: user.id,
        sessionId,
    })

    const refreshToken = generateRefreshToken({
        userId: user.id,
        sessionId,
    })

    const refreshTokenHash = await bcrypt.hash(refreshToken, env.BCRYPT_SALT_ROUNDS)

    await authRepository.createSession({
        id: sessionId,
        userId: user.id,
        refreshTokenHash: refreshTokenHash,
        userAgent: userAgent,
        ipAddress: ipAddress,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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

    try {
        await sendWelcomeEmail(user.email, user.name || '')
    } catch (error) {
        console.error('failed to send welcome email:', error)
    }

    return {
        accessToken,
        refreshToken,
    }
}

const login = async (data: Login) => {
    const { email, password, userAgent, ipAddress } = data

    const existingUser = await authRepository.findUserByEmail(email)

    if (!existingUser) {
        throw new AppError('invalid email or password', 401)
    }

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

    const refreshTokenHash = await bcrypt.hash(refreshToken, env.BCRYPT_SALT_ROUNDS)

    await authRepository.createSession({
        id: sessionId,
        userId: existingUser.id,
        refreshTokenHash: refreshTokenHash,
        userAgent: userAgent,
        ipAddress: ipAddress,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
    const user = await authRepository.findUserByEmail(data.email)

    if (!user || user.deletedAt || user.isDeleted || !user.emailVerified) {
        return
    }

    const otp = crypto.randomInt(100000, 1000000).toString()
    const otpHash = await bcrypt.hash(otp, env.BCRYPT_SALT_ROUNDS)

    await authRepository.updateUser(user.id, {
        otpHash,
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    })

    await sendOTP(user.email, otp)
}

const verifyPasswordResetOtp = async (data: VerifyPasswordResetOtp) => {
    const { email, otp } = data
    const user = await authRepository.findUserByEmail(email)

    if (!user || user.deletedAt || user.isDeleted || !user.emailVerified) {
        throw new AppError('invalid or expired reset code', 401)
    }

    if (!user.otpHash || !user.otpExpiresAt) {
        throw new AppError('invalid or expired reset code', 401)
    }

    if (user.otpExpiresAt < new Date()) {
        await authRepository.updateUser(user.id, {
            otpHash: null,
            otpExpiresAt: null,
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

    const user = await authRepository.findUserByEmail(email)

    if (!user || user.deletedAt || user.isDeleted || !user.emailVerified) {
        throw new AppError('invalid or expired reset code', 401)
    }

    if (!user.otpHash || !user.otpExpiresAt) {
        throw new AppError('invalid or expired reset code', 401)
    }

    if (user.otpExpiresAt < new Date()) {
        await authRepository.updateUser(user.id, {
            otpHash: null,
            otpExpiresAt: null,
        })

        throw new AppError('invalid or expired reset code', 401)
    }

    const isValid = await bcrypt.compare(otp, user.otpHash)

    if (!isValid) {
        throw new AppError('invalid or expired reset code', 401)
    }

    const password = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS)

    await authRepository.resetPasswordAndRevokeSessions(user.id, password)
}

const google = async (data: Google) => {
    const { name, email, sub, userAgent, ipAddress } = data

    let user = await authRepository.findUserByEmail(email)

    const username = getUsername()
    let isNewUser = false

    if (!user) {
        isNewUser = true
        user = await authRepository.createUser({
            email: email,
            username: username,
            emailVerified: true,
            googleId: sub,
            name: name,
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

        try {
            await sendWelcomeEmail(user.email, user.name || '')
        } catch (error) {
            console.error('failed to send welcome email:', error)
        }
    } else if (user.deletedAt || user.isDeleted) {
        throw new AppError('account has been deleted', 403)
    } else if (!user.googleId) {
        user = await authRepository.updateUser(user.id, {
            googleId: sub,
            emailVerified: true,
            otpHash: null,
            otpExpiresAt: null,
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

    const refreshTokenHash = await bcrypt.hash(refreshToken, env.BCRYPT_SALT_ROUNDS)

    await authRepository.createSession({
        id: sessionId,
        userId: user.id,
        refreshTokenHash,
        userAgent: userAgent,
        ipAddress: ipAddress,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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

    const session = await authRepository.findSessionById(sessionId)

    if (!session) {
        throw new AppError('session not found', 401)
    }

    if (session.userId !== userId) {
        await authRepository.deleteSessionsBySessionId(session.id)
        throw new AppError('invalid session', 401)
    }

    if (session.expiresAt.getTime() <= Date.now()) {
        await authRepository.deleteSessionsBySessionId(session.id)
        throw new AppError('session expired', 401)
    }

    const isRefreshTokenValid = await bcrypt.compare(refreshToken, session.refreshTokenHash)

    if (!isRefreshTokenValid) {
        await authRepository.deleteSessionsBySessionId(session.id)
        throw new AppError('invalid refresh token', 401)
    }

    const user = await authRepository.findUserById(userId)

    if (!user) {
        await authRepository.deleteSessionsBySessionId(session.id)
        throw new AppError('user not found', 401)
    }

    if (user.deletedAt || user.isDeleted) {
        await authRepository.deleteSessionsBySessionId(session.id)
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

    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, env.BCRYPT_SALT_ROUNDS)

    await authRepository.updateSession(session.id, {
        refreshTokenHash: newRefreshTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
