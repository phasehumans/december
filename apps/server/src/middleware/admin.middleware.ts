import { prisma } from '@december/database'

import { isAdminEmail } from '../modules/admin/admin.utils'

import type { NextFunction, Request, Response } from 'express'

/**
 * Runs after authMiddleware. Only a signed-in, verified account whose email is in
 * ADMIN_EMAILS gets through; hiding the page in the web app is not enough (#624 d8).
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.userId
    if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, emailVerified: true, isDeleted: true },
        })
        if (!user || user.isDeleted || !user.emailVerified || !isAdminEmail(user.email)) {
            return res.status(403).json({ success: false, message: 'Forbidden' })
        }
        return next()
    } catch (err) {
        return next(err)
    }
}
