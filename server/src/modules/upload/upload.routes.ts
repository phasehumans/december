import { Router } from 'express'
import multer from 'multer'
import { authMiddleware } from '../../middleware/auth.middleware'
import { uploadController } from './upload.controller'

const uploadRouter = Router()
const upload = multer({
    storage: multer.memoryStorage(),
})

uploadRouter.use(authMiddleware)
uploadRouter.get('/github/repos', uploadController.getUserGithubRepos) //use in profile page
uploadRouter.post('/imports/github', uploadController.importFromGithub)
uploadRouter.post('/imports/zip', upload.single('file'), uploadController.importFromZip)

export default uploadRouter
