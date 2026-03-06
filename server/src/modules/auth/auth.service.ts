import { prisma } from '../../config/db'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { sendOTP } from '../../utils/sendEmail'

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
        throw new Error('email already exists')
    }

    const hashPassword = await bcrypt.hash(password, 10)
    const userName = email.split('@')[0]?.replace(/\d+/g, '')
    const otp = crypto.randomInt(100000, 1000000).toString()
    const otpHash = await bcrypt.hash(otp, 10)

    const newUser = await prisma.user.create({
        data: {
            name: userName!,
            email: email,
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
        throw new Error('user not found')
    }

    if (user.emailVerified) {
        throw new Error('email already verified')
    }

    if (!user.otpHash || !user.otpExpiresAt) {
        throw new Error('otp not found, request new one')
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

        throw new Error('otp expired')
    }

    const isValid = await bcrypt.compare(otp, user.otpHash)

    if (!isValid) {
        throw new Error('invalid otp')
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
            expiresIn: '7d',
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
        throw new Error('invalid email or password')
    }

    if (!existingUser.emailVerified) {
        throw new Error('please verify your email')
    }

    const isPasswordMatch = await bcrypt.compare(password, existingUser.password!)

    if (!isPasswordMatch) {
        throw new Error('invalid email or password')
    }

    const token = jwt.sign(
        {
            userId: existingUser.id,
        },
        process.env.JWT_SECRET!,
        {
            expiresIn: '7d',
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

    if (!user) {
        user = await prisma.user.create({
            data: {
                email: email,
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
            expiresIn: '7d',
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
