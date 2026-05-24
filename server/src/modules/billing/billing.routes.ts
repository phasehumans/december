import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'

const billingRouter = Router()

billingRouter.use(authMiddleware)

export default billingRouter
