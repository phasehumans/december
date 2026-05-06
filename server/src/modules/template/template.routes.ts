import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { templateController } from './template.controller'
const templateRouter = Router()

templateRouter.use(authMiddleware)
templateRouter.get('/', templateController.getAllTemplates)
templateRouter.get('/featured', templateController.getFeaturedTemplates)
templateRouter.get('/:templateId', templateController.getTemplateById)
templateRouter.post('/:templateId/remix', templateController.remixTemplate)
templateRouter.post('/:templateId/like', templateController.toggleLike)

export default templateRouter
