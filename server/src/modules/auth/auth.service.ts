import { prisma } from "../../utils/db"
import bcrypt from "bcrypt"

type signupInput = {
    name: string,
    email: string,
    password: string
}

const signup = async (data: signupInput) => {
    const {name, email, password} = data

    const existingUser = await prisma.user.findUnique({
        where:{
            email: email
        }
    })

    if(existingUser){
        throw new Error("user already exists")
    }

    const hashPassword = await bcrypt.hash(password, 10)

    const newUser = await prisma.user.create({
        data: {
            name: name,
            email: email,
            password: hashPassword,
        }
    })

    return {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email
    }
}


export const authService = {
    signup
}