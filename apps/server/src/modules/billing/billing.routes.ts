import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'
import { createRateLimiter } from '../../middleware/ratelimit'

import { billingController } from './billing.controller'

const billingRouter = Router()

billingRouter.post('/webhooks/coinbase', billingController.handleCoinbaseWebhook)

billingRouter.use(authMiddleware)
billingRouter.get('/overview', billingController.getOverview)
billingRouter.get('/credits/history', billingController.getCreditsHistory)
billingRouter.post('/credits/add', billingController.addCredits)

billingRouter.post('/wallet/order/razorpay', billingController.createRazorpayOrder)
billingRouter.post('/wallet/verify/razorpay', billingController.verifyRazorpayPayment)
billingRouter.post('/wallet/order/crypto', billingController.createCryptoOrder)

billingRouter.post(
    '/redeem-code',
    createRateLimiter({
        windowMs: 15 * 60 * 1000,
        max: 5,
        message: 'Too many redemption attempts. Please try again in 15 minutes.',
    }),
    billingController.redeemCode
)

export default billingRouter
export { billingRouter }
