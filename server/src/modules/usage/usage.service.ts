import { prisma } from '../../config/db'

const getCurrentUsage = async (data: string) => {
    const user = await prisma.user.findUnique({
        where: {
            id: data,
        },
    })

    //
}

const checkEnoughCredits = async (data: string) => {}

const recordUsageEvent = async () => {}

export const usageService = {
    getCurrentUsage,
    checkEnoughCredits,
    recordUsageEvent,
}
