import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'
import { createRateLimiter } from '../../middleware/rate-limiter'

import { secretsController } from './secrets.controller'

// reading a plain value is the one route that gives a secret back. a tight per-user limit
// keeps a stolen session from reading every value in one go
const secretValueLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    message: 'Too many secret reads. Try again in 15 minutes.',
    prefix: 'rl:secret-value:',
})

const secretsRouter = Router()

secretsRouter.use(authMiddleware)

secretsRouter.get('/', secretsController.getSecrets)
secretsRouter.get('/:name/value', secretValueLimiter, secretsController.getSecretValue)
secretsRouter.post('/', secretsController.createSecret)
secretsRouter.post('/bulk', secretsController.bulkCreateSecrets)
secretsRouter.delete('/:name', secretsController.deleteSecret)

export default secretsRouter
