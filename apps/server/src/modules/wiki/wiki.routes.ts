import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { wikiController } from './wiki.controller'

const wikiRouter = Router()

wikiRouter.use(authMiddleware)

wikiRouter.get('/github-repos', wikiController.getGitHubRepos)
wikiRouter.post('/generate', wikiController.generateWiki)
wikiRouter.get('/repos/:owner/:repo', wikiController.getWikiByRepo)
wikiRouter.post('/pages', wikiController.createPage)
wikiRouter.put('/pages/:id', wikiController.updatePage)
wikiRouter.delete('/pages/:id', wikiController.deletePage)
wikiRouter.post('/chat', wikiController.chatWithWiki)

export default wikiRouter
