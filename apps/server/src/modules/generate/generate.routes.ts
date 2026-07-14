import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { generateProjectStream } from './generate.controller'

const generateRouter = Router()

generateRouter.use(authMiddleware)
generateRouter.post('/', generateProjectStream)
generateRouter.post('/edit', generateProjectStream)
generateRouter.post('/fix', generateProjectStream)

export default generateRouter
