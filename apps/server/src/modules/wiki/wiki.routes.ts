import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import {
    GenerateWikiSchema,
    CreatePageSchema,
    UpdatePageSchema,
    WikiChatSchema,
} from './wiki.schema'
import * as wikiService from './wiki.service'

const router = Router()

router.use(authMiddleware)

router.get('/github-repos', async (req, res, next) => {
    try {
        const userId = req.user!.userId
        const result = await wikiService.getUserGitHubRepos(userId)
        res.json(result)
    } catch (err) {
        next(err)
    }
})

router.post('/generate', async (req, res, next) => {
    try {
        const data = GenerateWikiSchema.parse(req.body)
        const userId = req.user!.userId
        const wiki = await wikiService.generateWiki(
            userId,
            data.repoOwner,
            data.repoName,
            data.repoUrl
        )
        res.status(200).json({ wiki })
    } catch (err: any) {
        if (err.name === 'ZodError') {
            res.status(400).json({ error: 'Validation error', details: err.errors })
        } else {
            next(err)
        }
    }
})

router.get('/repos/:owner/:repo', async (req, res, next) => {
    try {
        const userId = req.user!.userId
        const wiki = await wikiService.getWikiByRepo(userId, req.params.owner, req.params.repo)
        res.json({ wiki })
    } catch (err: any) {
        if (err.message === 'Wiki not found' || err.message.startsWith('Unauthorized')) {
            res.status(404).json({ error: err.message })
        } else {
            next(err)
        }
    }
})

router.post('/pages', async (req, res, next) => {
    try {
        const data = CreatePageSchema.parse(req.body)
        const userId = req.user!.userId
        const page = await wikiService.createWikiPage(userId, data)
        res.status(201).json({ page })
    } catch (err: any) {
        if (err.name === 'ZodError') {
            res.status(400).json({ error: 'Validation error', details: err.errors })
        } else if (err.message === 'Page slug already exists in this wiki') {
            res.status(409).json({ error: err.message })
        } else if (err.message.startsWith('Unauthorized')) {
            res.status(403).json({ error: err.message })
        } else {
            next(err)
        }
    }
})

router.put('/pages/:id', async (req, res, next) => {
    try {
        const data = UpdatePageSchema.parse(req.body)
        const userId = req.user!.userId
        const page = await wikiService.updateWikiPage(userId, req.params.id, data)
        res.json({ page })
    } catch (err: any) {
        if (err.name === 'ZodError') {
            res.status(400).json({ error: 'Validation error', details: err.errors })
        } else if (err.message === 'Page slug already exists in this wiki') {
            res.status(409).json({ error: err.message })
        } else if (err.message.startsWith('Unauthorized') || err.message.includes('not found')) {
            res.status(404).json({ error: err.message })
        } else {
            next(err)
        }
    }
})

router.delete('/pages/:id', async (req, res, next) => {
    try {
        const userId = req.user!.userId
        await wikiService.deleteWikiPage(userId, req.params.id)
        res.status(204).end()
    } catch (err: any) {
        if (err.message.startsWith('Unauthorized') || err.message.includes('not found')) {
            res.status(404).json({ error: err.message })
        } else {
            next(err)
        }
    }
})

router.post('/chat', async (req, res, next) => {
    try {
        const data = WikiChatSchema.parse(req.body)
        const userId = req.user!.userId
        const result = await wikiService.chatWithWiki(
            userId,
            data.prompt,
            data.repoFullName,
            data.wikiId
        )
        res.json(result)
    } catch (err: any) {
        if (err.name === 'ZodError') {
            res.status(400).json({ error: 'Validation error', details: err.errors })
        } else {
            next(err)
        }
    }
})

export default router
