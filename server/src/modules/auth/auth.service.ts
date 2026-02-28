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
        throw new Error('email already exists')
    }

    const hashPassword = await bcrypt.hash(password, 10)

    const newUser = await prisma.user.create({
        data: {
            name: name,
            email: email,
            password: hashPassword,
        },
    })

    return newUser
    // let the controller decide the shape of res
}

const login = async (data: loginInput) => {
    const { email, password } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            email: email,
        },
    })

    if (!existingUser) {
        throw new Error('invalid email or password')
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

const logout = async () => {
    return {
        message: 'logout successful',
    }
}

export const authService = {
    signup,
    login,
    logout,
}
