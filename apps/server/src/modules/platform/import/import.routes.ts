import { Router } from 'express'

import { authMiddleware } from '../../../middleware/auth.middleware'

import { uploadController } from './import.controller'

const importRouter = Router()

importRouter.use(authMiddleware)
importRouter.post('/github', uploadController.importFromGithub)
importRouter.get('/:id', uploadController.getImportStatus)

export default importRouter
