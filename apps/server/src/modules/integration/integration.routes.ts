import { Router } from 'express'

import { integrationsController } from './integration.controller'

const integrationsRouter = Router()

integrationsRouter.get('/vercel/connect', integrationsController.connectVercel)
integrationsRouter.get('/github/connect', integrationsController.connectGithub)
integrationsRouter.get('/supabase/connect', integrationsController.connectSupabase)
integrationsRouter.get('/notion/connect', integrationsController.connectNotion)

export default integrationsRouter
