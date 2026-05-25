import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { billingController } from './billing.controller'

const billingRouter = Router()

billingRouter.post('/webhooks/razorpay', billingController.handleRazorpayWebhook)

billingRouter.use(authMiddleware)
billingRouter.get('/overview', billingController.getOverview)
billingRouter.get('/plans', billingController.getPlans)
billingRouter.post('/subscription', billingController.createSubscription)
billingRouter.post('/subscription/verify', billingController.verifySubscription)
billingRouter.post('/subscription/cancel', billingController.cancelSubscription)
billingRouter.get('/credits/history', billingController.getCreditsHistory)
billingRouter.post('/portal', billingController.createPortalSession)

export default billingRouter
