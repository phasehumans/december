import { email } from "zod"
import { prisma } from "../../utils/db"

type getProfileType = {
    userId: string
}

const getProfile = async (data: getProfileType) => {
    const profile = await prisma.user.findUnique({
        where: {
            id: data.userId
        }
    })

    if(!profile){
        throw new Error("user doesnot exist")
    }

    return {
        name: profile.name,
        email: profile.email,
    }
}

export const profileService = {
    getProfile
}