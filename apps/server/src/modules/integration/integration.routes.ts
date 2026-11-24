import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { integrationsController } from './integration.controller'

const integrationsRouter = Router()

integrationsRouter.get('/github/connect', integrationsController.connectGithub)

// gitlab (#627): start and callback are browser redirects, so they check the user themselves
integrationsRouter.get('/gitlab', authMiddleware, integrationsController.getGitlabStatus)
integrationsRouter.delete('/gitlab', authMiddleware, integrationsController.disconnectGitlab)
integrationsRouter.get('/gitlab/start', integrationsController.startGitlab)
integrationsRouter.get('/gitlab/callback', integrationsController.gitlabCallback)

export default integrationsRouter
