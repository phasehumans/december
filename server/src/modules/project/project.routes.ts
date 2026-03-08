import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { projectController } from './project.controller'

const projectRouter = Router()

projectRouter.use(authMiddleware)
projectRouter.get('/', projectController.getAllProjects)
projectRouter.get('/:projectId', projectController.getProjectById)
projectRouter.post('/', projectController.createProject)
projectRouter.patch('/:projectId', projectController.updateProject)
projectRouter.delete('/:projectId', projectController.deleteProject)
projectRouter.post('/:projectId/duplicate', projectController.duplicateProject)

export default projectRouter
