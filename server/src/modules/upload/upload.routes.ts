import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { uploadController } from './upload.controller'

const uploadRouter = Router()

uploadRouter.use(authMiddleware)
uploadRouter.get('/github/repos', uploadController.listGithubRepos)
uploadRouter.post('/imports/github', uploadController.importFromGithub)
uploadRouter.post('/imports/zip', uploadController.importFromZip)

export default uploadRouter
