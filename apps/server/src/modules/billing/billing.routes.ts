import { Router } from 'express'

import { env } from '../../env'
import { authMiddleware } from '../../middleware/auth.middleware'
import { createRateLimiter } from '../../middleware/rate-limiter'

import { billingController } from './billing.controller'

const billingRouter = Router()

billingRouter.post(
    '/webhook/razorpay',
    createRateLimiter({
        windowMs: 60 * 1000,
        max: env.NODE_ENV === 'test' ? 1000 : 120,
        message: 'Too many webhook requests.',
    }),
    billingController.handleRazorpayWebhook
)

billingRouter.use(authMiddleware)
billingRouter.get('/overview', billingController.getOverview)
billingRouter.get('/credits/history', billingController.getCreditsHistory)
billingRouter.get('/transactions', billingController.listTransactions)
billingRouter.get('/transactions/:id/receipt', billingController.getReceipt)
billingRouter.get('/referral', billingController.getReferral)
// spend limits and the low balance alert (#638 section 1)
billingRouter.get('/limits', billingController.getLimits)
billingRouter.patch('/limits', billingController.updateLimits)

billingRouter.post(
    '/wallet/order/razorpay',
    createRateLimiter({
        windowMs: 60 * 1000,
        max: env.NODE_ENV === 'test' ? 1000 : 15,
        message: 'Too many order requests. Please try again in a minute.',
        prefix: 'rl:billing:order:',
    }),
    billingController.createRazorpayOrder
)

billingRouter.post(
    '/wallet/verify/razorpay',
    createRateLimiter({
        windowMs: 60 * 1000,
        max: env.NODE_ENV === 'test' ? 1000 : 30,
        message: 'Too many verification attempts. Please try again in a minute.',
        prefix: 'rl:billing:verify:',
    }),
    billingController.verifyRazorpayPayment
)

billingRouter.get('/credit-request', billingController.getFreeCreditRequest)
billingRouter.post(
    '/credit-request',
    createRateLimiter({
        windowMs: 60 * 60 * 1000,
        max: env.NODE_ENV === 'test' ? 1000 : 5,
        message: 'Too many requests. Please try again later.',
        prefix: 'rl:billing:credit-request:',
    }),
    billingController.requestFreeCredits
)

export default billingRouter
