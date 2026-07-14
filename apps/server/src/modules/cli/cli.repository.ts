import { prisma } from '@december/database'

export const createSession = async (data: { userId: string; title: string; messages: any[] }) => {
    return prisma.session.create({
        data: {
            userId: data.userId,
            title: data.title,
            type: 'CLI',
            messages: {
                create: data.messages.map((msg: any, i: number) => ({
                    role:
                        msg.role === 'assistant'
                            ? 'ASSISTANT'
                            : msg.role === 'system'
                              ? 'SYSTEM'
                              : 'USER',
                    content:
                        typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
                    sequence: i,
                })),
            },
        },
    })
}

export const cliRepository = {
    createSession,
}
