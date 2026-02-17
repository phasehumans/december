import { prisma } from '../../utils/db'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

type signupInput = {
    name: string
    email: string
    password: string
}

type loginInput = {
    email: string
    password: string
}

const signup = async (data: signupInput) => {
    const { name, email, password } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            email: email,
        },
    })

    if (existingUser) {
        throw new Error('user already exists')
    }

    const hashPassword = await bcrypt.hash(password, 10)

    const newUser = await prisma.user.create({
        data: {
            name: name,
            email: email,
            password: hashPassword,
        },
    })

    return {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
    }
}

const login = async (data: loginInput) => {
    const { email, password } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            email: email,
        },
    })

    if (!existingUser) {
        throw new Error('invalid credentials')
    }

    const isPasswordMatch = await bcrypt.compare(password, existingUser.password!)

    if (!isPasswordMatch) {
        throw new Error('invalid credentials')
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

    return {
        name: existingUser.name,
        email: existingUser.email,
        token: token,
    }
}

const logout = async () => {
    return {
        message: 'logged out successfully',
    }
}

export const authService = {
    signup,
    login,
    logout,
}
