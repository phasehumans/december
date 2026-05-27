import { Router } from 'express'
import multer from 'multer'

import { authMiddleware } from '../../middleware/auth.middleware'

import { uploadController } from './upload.controller'

const uploadRouter = Router()
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024,
        files: 1,
    },
})

uploadRouter.use(authMiddleware)
uploadRouter.post('/github', uploadController.importFromGithub)
uploadRouter.post('/zip', upload.single('file'), uploadController.importFromZip)
uploadRouter.get('/:id', uploadController.getImportStatus)
uploadRouter.post('/:id/retry', uploadController.retryImport)

export default uploadRouter
