import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { templateController } from './template.controller'
const templateRouter = Router()

templateRouter.use(authMiddleware)
templateRouter.get('/', templateController.getAllTemplates)
templateRouter.get('/:templateId', templateController.getTemplateById)
// templateRouter.get('/category/:category', templateController.getTemplatesByCategory)
templateRouter.post('/:templateId/remix', templateController.remixTemplate)
templateRouter.post(':templateId/like', templateController.likeTemplate)
// templateRouter.delete(':templateId/like', templateController.dislikeTemplate)
templateRouter.get('/featured', templateController.featuredTemplates)

export default templateRouter
