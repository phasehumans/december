import { Router } from 'express'

import { limitAdminWrites, requireAdmin, requireAdminCode } from '../../middleware/admin.middleware'
import admincloudflareRouter from '../admincloudflare/admincloudflare.routes'
import adminstatsRouter from '../adminstats/adminstats.routes'
import admintotpRouter from '../admintotp/admintotp.routes'

import { adminController } from './admin.controller'

const adminRouter = Router()

// every route: the admin's web sign-in only (no CLI token, only the app's origin). anyone
// else gets the same 404 as an unknown path
adminRouter.use(requireAdmin)
adminRouter.use(limitAdminWrites)

// before the authenticator code: who am I, and set up or enter the code
adminRouter.get('/me', adminController.getMe)
adminRouter.use('/totp', admintotpRouter)

// everything below needs a code entered in this sign-in in the last 12 hours
adminRouter.use(requireAdminCode)

// overview, analytics and system
adminRouter.use(adminstatsRouter)
// Cloudflare, read only: visitors, deploys, edge traffic and page speed
adminRouter.use(admincloudflareRouter)

// credit requests (shown on the Users tab) and today's total for the daily limit
adminRouter.post('/credit-requests/:id/approve', adminController.approveCreditRequest)
adminRouter.post('/credit-requests/:id/reject', adminController.rejectCreditRequest)
adminRouter.get('/credit-ledger', adminController.listCreditLedger)

// users
adminRouter.get('/users', adminController.listUsers)
adminRouter.get('/users/:id', adminController.getUser)
// the only user action: add credits, within the daily limits ($10 a user, $50 in total)
adminRouter.post('/users/:id/credits', adminController.adjustCredits)

// sandboxes (system tab)
adminRouter.get('/sandboxes', adminController.listSandboxes)
adminRouter.post('/sandboxes/:id/:action', adminController.controlSandbox)

export default adminRouter
