import { Router } from 'express'

import { requireAdmin } from '../../middleware/admin.middleware'
import { authMiddleware } from '../../middleware/auth.middleware'

import { adminController } from './admin.controller'

const adminRouter = Router()

// every route: signed in, verified, and listed in ADMIN_EMAILS
adminRouter.use(authMiddleware, requireAdmin)

adminRouter.get('/me', adminController.getMe)

// a1
adminRouter.get('/credit-requests', adminController.listCreditRequests)
adminRouter.post('/credit-requests/:id/approve', adminController.approveCreditRequest)
adminRouter.post('/credit-requests/:id/reject', adminController.rejectCreditRequest)

// a2
adminRouter.get('/feedback', adminController.listFeedback)

// a3 and a5
adminRouter.get('/users', adminController.listUsers)
adminRouter.get('/users/:id', adminController.getUser)
adminRouter.post('/users/:id/credits', adminController.adjustCredits)
adminRouter.post('/users/:id/restore', adminController.restoreUser)

// a4
adminRouter.get('/redeem-codes', adminController.listRedeemCodes)
adminRouter.post('/redeem-codes', adminController.createRedeemCode)

// a6
adminRouter.get('/github-installations', adminController.listInstallations)
adminRouter.post('/github-installations/:id/assign', adminController.assignInstallation)

// a7 and a8
adminRouter.get('/announcements', adminController.listAnnouncements)
adminRouter.post('/announcements/test', adminController.sendTestAnnouncement)
adminRouter.post('/announcements/send', adminController.sendAnnouncement)

// a9
adminRouter.get('/sandboxes', adminController.listSandboxes)
adminRouter.post('/sandboxes/:id/:action', adminController.controlSandbox)
adminRouter.get('/usage/daily', adminController.dailyUsage)

adminRouter.get('/audit-log', adminController.listAuditLog)

export default adminRouter
