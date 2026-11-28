import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { hookController } from './hook.controller'

// user hooks saved on the account (connections page), mounted at /connections/hooks. the
// server only saves them: a cloud session runs them in its own sandbox
const hookRouter = Router()

hookRouter.use(authMiddleware)

hookRouter.get('/', hookController.listHooks)
hookRouter.post('/', hookController.createHook)
hookRouter.put('/', hookController.replaceHooks)
hookRouter.patch('/:id', hookController.updateHook)
hookRouter.delete('/:id', hookController.deleteHook)

export default hookRouter
