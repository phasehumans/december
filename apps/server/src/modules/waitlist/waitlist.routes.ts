import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { waitlistController } from './waitlist.controller'

const waitlistRouter = Router()

waitlistRouter.use(authMiddleware)

waitlistRouter.get('/:feature', waitlistController.getState)
waitlistRouter.post('/:feature/join', waitlistController.join)
waitlistRouter.post('/:feature/seen', waitlistController.markPopupSeen)

export default waitlistRouter
