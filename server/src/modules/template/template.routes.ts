import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { templateController } from './template.controller'
const templateRouter = Router()

templateRouter.use(authMiddleware)
templateRouter.get('/', templateController.getAllTemplates)
templateRouter.get('/:templateId', templateController.getTemplateById)
templateRouter.get('/:category', templateController.getTemplatesByCategory)
templateRouter.post('/remix/:templateId', templateController.remixProject)

export default templateRouter
