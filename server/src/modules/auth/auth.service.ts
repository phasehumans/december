import crypto from 'crypto'

import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

import { prisma } from '../../config/db'
import { sendOTP } from './auth.utils'
import { getUsernameFromEmail } from './auth.utils'
import { AppError } from '../../utils/appError'

type Signup = {
    email: string
    password: string
}

type VerifyOpt = {
    email: string
    otp: string
}

type Login = {
    email: string
    password: string
}

type Google = {
    name: string
    email: string
    sub: string
}

const signup = async (data: Signup) => {
    const { email, password } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            email: email,
        },
    })

    if (existingUser) {
        throw new AppError('email already exists', 409)
    }

    let userName = getUsernameFromEmail(email)

    if (userName == undefined || userName == '') {
        userName = 'emptyusername'
    }

    const hashPassword = await bcrypt.hash(password, 10)
    const otp = crypto.randomInt(100000, 1000000).toString()
    const otpHash = await bcrypt.hash(otp, 10)

    const newUser = await prisma.user.create({
        data: {
            name: userName!,
            email: email,
            username: userName,
            password: hashPassword,
            emailVerified: false,
            otpHash: otpHash,
            otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
    })

    await sendOTP(newUser.email, otp)

    return { message: 'otp sent successfully' }
}

const verifyOtp = async (data: VerifyOpt) => {
    const { email, otp } = data

    const user = await prisma.user.findUnique({
        where: {
            email: email,
        },
    })

    if (!user) {
        throw new AppError('user not found', 404)
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

        throw new AppError('otp expired', 400)
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

    const token = jwt.sign(
        {
            userId: user.id,
        },
        process.env.JWT_SECRET!,
        {
            expiresIn: '30d',
        }
    )

    return token
}

const login = async (data: Login) => {
    const { email, password } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            email: email,
        },
    })

    if (!existingUser) {
        throw new AppError('invalid email or password', 401)
    }

    if (!existingUser.emailVerified) {
        throw new AppError('please verify your email', 401)
    }

    const isPasswordMatch = await bcrypt.compare(password, existingUser.password!)

    if (!isPasswordMatch) {
        throw new AppError('invalid email or password', 401)
    }

    const token = jwt.sign(
        {
            userId: existingUser.id,
        },
        process.env.JWT_SECRET!,
        {
            expiresIn: '30d',
        }
    )

    return token
}

const google = async (data: Google) => {
    const { name, email, sub } = data

    let user = await prisma.user.findUnique({
        where: {
            email: email,
        },
    })

    let userName = getUsernameFromEmail(email)

    if (userName == undefined || userName == '') {
        userName = 'emptyusername'
    }

    if (!user) {
        user = await prisma.user.create({
            data: {
                email: email,
                username: userName,
                emailVerified: true,
                googleId: sub,
                name: name,
            },
        })
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
    } else if (user.googleId != sub) {
        throw new Error('google id mismatch')
    }

    const token = jwt.sign(
        {
            userId: user.id,
        },
        process.env.JWT_SECRET!,
        {
            expiresIn: '30d',
        }
    )
    return token
}

export const authService = {
    signup,
    verifyOtp,
    login,
    google,
}
