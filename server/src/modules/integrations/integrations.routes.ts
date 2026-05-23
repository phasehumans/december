import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { integrationsController } from './integrations.controller'

const integrationsRouter = Router()

integrationsRouter.use(authMiddleware)
integrationsRouter.get('/github/repos', integrationsController.getUserGithubRepos)

integrationsRouter.get('/vercel/connect', integrationsController.connectVercel)
integrationsRouter.get('/supabase/connect', integrationsController.connectSupabase)
integrationsRouter.get('/notion/connect', integrationsController.connectNotion)
integrationsRouter.get('/stripe/connect', integrationsController.connectStripe)

export default integrationsRouter
