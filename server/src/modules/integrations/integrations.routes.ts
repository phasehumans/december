import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { integrationsController } from './integrations.controller'

const integrationsRouter = Router()

integrationsRouter.get('/vercel/connect', integrationsController.connectVercel)

integrationsRouter.use(authMiddleware)
integrationsRouter.get('/github/repos', integrationsController.getUserGithubRepos)
integrationsRouter.get('/supabase/connect', integrationsController.connectSupabase)
integrationsRouter.get('/notion/connect', integrationsController.connectNotion)

export default integrationsRouter
