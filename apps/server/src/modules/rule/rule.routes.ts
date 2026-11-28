import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { ruleController } from './rule.controller'

// account rules (connections, rules tab), under /connections/rules
const ruleRouter = Router()

ruleRouter.use(authMiddleware)

ruleRouter.get('/', ruleController.listRules)
ruleRouter.put('/:name', ruleController.saveRule)
ruleRouter.patch('/:name', ruleController.setRuleEnabled)
ruleRouter.delete('/:name', ruleController.deleteRule)

export default ruleRouter
