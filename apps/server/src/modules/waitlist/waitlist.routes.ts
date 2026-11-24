import { Router } from 'express'

import { requireAdmin } from '../../middleware/admin.middleware'
import { authMiddleware } from '../../middleware/auth.middleware'

import { waitlistController } from './waitlist.controller'

const waitlistRouter = Router()

waitlistRouter.use(authMiddleware)

waitlistRouter.get('/:feature', waitlistController.getState)
waitlistRouter.post('/:feature/join', waitlistController.join)
waitlistRouter.post('/:feature/seen', waitlistController.markPopupSeen)

// admin only (ADMIN_EMAILS): shown on /admin#waitlist
waitlistRouter.get('/:feature/admin', requireAdmin, waitlistController.listEntries)
waitlistRouter.post('/:feature/admin/launch', requireAdmin, waitlistController.launch)

export default waitlistRouter
