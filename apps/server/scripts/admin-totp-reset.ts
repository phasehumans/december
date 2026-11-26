/**
 * Removes the admin's authenticator app, for a lost phone (T5). There are no recovery codes
 * on purpose: only someone who can run commands on the server can reset it.
 *
 * On the server:
 *   sudo docker exec -it december-server bun apps/server/scripts/admin-totp-reset.ts <email>
 *
 * It also signs the admin out of every device, so only a new sign-in can set up the next
 * authenticator. The next visit to the admin panel shows the setup screen again.
 */
import { prisma } from '@december/database'

import { admintotpService } from '../src/modules/admintotp/admintotp.service'

const main = async () => {
    const email = process.argv[2]?.trim().toLowerCase()
    if (!email) {
        console.error('usage: bun apps/server/scripts/admin-totp-reset.ts <email>')
        process.exit(1)
    }

    const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, email: true },
    })
    if (!user) {
        console.error(`no account with the email ${email}`)
        process.exit(1)
    }

    // S2: also signs the admin out everywhere, so an old sign-in can't set up first
    const { endedSignIns } = await admintotpService.resetAuthenticator({ userId: user.id })
    await prisma.adminAuditLog.create({
        data: {
            adminUserId: user.id,
            action: 'admin.code_reset',
            targetType: 'admin',
            targetId: user.id,
            metadata: { by: 'server script' },
        },
    })
    console.log(
        `authenticator removed for ${user.email} and ${endedSignIns} sign-ins ended. sign in again and set it up on the next admin visit.`
    )
    await prisma.$disconnect()
}

main().catch(async (err) => {
    console.error(err)
    await prisma.$disconnect()
    process.exit(1)
})
