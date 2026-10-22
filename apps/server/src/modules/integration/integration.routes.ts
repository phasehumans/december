import { Router } from 'express'

import { integrationsController } from './integration.controller'

const integrationsRouter = Router()

integrationsRouter.get('/vercel/connect', integrationsController.connectVercel)
integrationsRouter.get('/github/connect', integrationsController.connectGithub)

export default integrationsRouter
