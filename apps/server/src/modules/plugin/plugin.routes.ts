import { Router } from 'express'

import { env } from '../../env'
import { authMiddleware } from '../../middleware/auth.middleware'
import { createRateLimiter } from '../../middleware/rate-limiter'

import { pluginController } from './plugin.controller'

// an install or an update downloads a repository from github: a per-user limit keeps one
// account from making the server download all day
const pluginFetchLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: env.NODE_ENV === 'test' ? 1000 : 30,
    message: 'Too many plugin installs. Try again in 15 minutes.',
    prefix: 'rl:plugin-fetch:',
})

// plugins installed on the account (connections page), mounted at /connections/plugins
const pluginRouter = Router()

pluginRouter.use(authMiddleware)

pluginRouter.get('/', pluginController.listPlugins)
pluginRouter.get('/marketplace', pluginController.listMarketplace)
pluginRouter.post('/', pluginFetchLimiter, pluginController.installPlugin)
pluginRouter.patch('/:name', pluginController.setPluginEnabled)
pluginRouter.post('/:name/update', pluginFetchLimiter, pluginController.updatePlugin)
pluginRouter.delete('/:name', pluginController.uninstallPlugin)

export default pluginRouter
