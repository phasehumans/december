import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'
import { createRateLimiter } from '../../middleware/rate-limiter'

import { byokController } from './byok.controller'

// saving or checking a key calls the provider. a tight per-user limit keeps this
// route from being used to test stolen keys in bulk.
const keyCheckLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: 'Too many key checks. Try again in 15 minutes.',
    prefix: 'rl:byok-check:',
})

const byokRouter = Router()

byokRouter.use(authMiddleware)

byokRouter.get('/', byokController.listCredentials)
byokRouter.put('/:provider', keyCheckLimiter, byokController.saveCredential)
byokRouter.post('/:provider/refresh', keyCheckLimiter, byokController.refreshCredential)
byokRouter.delete('/:provider', byokController.deleteCredential)

export default byokRouter
