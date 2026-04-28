import { Router } from 'express'
import multer from 'multer'
import { authMiddleware } from '../../middleware/auth.middleware'
import { uploadController } from './upload.controller'

const uploadRouter = Router()
export const importRouter = Router()
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024,
        files: 1,
    },
})

uploadRouter.use(authMiddleware)
uploadRouter.get('/github/repos', uploadController.getUserGithubRepos) //use in profile page
uploadRouter.post('/imports/github', uploadController.importFromGithub)
uploadRouter.post('/imports/zip', upload.single('file'), uploadController.importFromZip)
uploadRouter.get('/imports/:id', uploadController.getImportStatus)
uploadRouter.post('/imports/:id/retry', uploadController.retryImport)

importRouter.use(authMiddleware)
importRouter.post('/imports/github', uploadController.importFromGithub)
importRouter.post('/imports/zip', upload.single('file'), uploadController.importFromZip)
importRouter.get('/imports/:id', uploadController.getImportStatus)
importRouter.post('/imports/:id/retry', uploadController.retryImport)

export default uploadRouter
