import { Router } from 'express'

import { admintotpController } from './admintotp.controller'

// mounted inside the admin router, after requireAdmin and before requireAdminCode
const admintotpRouter = Router()

admintotpRouter.post('/setup', admintotpController.startSetup)
admintotpRouter.post('/enable', admintotpController.enable)
admintotpRouter.post('/verify', admintotpController.verify)

export default admintotpRouter
