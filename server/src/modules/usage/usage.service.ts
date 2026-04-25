import { prisma } from '../../config/db'

const getCurrentUsage = async (data: string) => {
    const user = await prisma.user.findUnique({
        where: {
            id: data,
        },
    })

    //
}

export const usageService = {
    getCurrentUsage,
}
