import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { CreateWikiSchema, UpdateWikiSchema } from './wiki.schema'
import * as wikiService from './wiki.service'

const router = Router()

router.use(authMiddleware)

router.get('/project/:projectId', async (req, res, next) => {
    try {
        const userId = req.user!.userId
        const pages = await wikiService.getWikiPages(userId, req.params.projectId)
        res.json({ pages })
    } catch (err: any) {
        if (err.message.startsWith('Unauthorized')) {
            res.status(403).json({ error: err.message })
        } else {
            next(err)
        }
    }
})

router.get('/:id', async (req, res, next) => {
    try {
        const userId = req.user!.userId
        const page = await wikiService.getWikiPage(userId, req.params.id)
        res.json({ page })
    } catch (err: any) {
        if (err.message.startsWith('Unauthorized')) res.status(404).json({ error: err.message })
        else next(err)
    }
})

router.post('/', async (req, res, next) => {
    try {
        const data = CreateWikiSchema.parse(req.body)
        const userId = req.user!.userId
        const page = await wikiService.createWikiPage(userId, data)
        res.status(201).json({ page })
    } catch (err: any) {
        if (err.message === 'Title already exists in this project')
            res.status(409).json({ error: err.message })
        else if (err.message.startsWith('Unauthorized'))
            res.status(403).json({ error: err.message })
        else next(err)
    }
})

router.put('/:id', async (req, res, next) => {
    try {
        const data = UpdateWikiSchema.parse(req.body)
        const userId = req.user!.userId
        const page = await wikiService.updateWikiPage(userId, req.params.id, data)
        res.json({ page })
    } catch (err: any) {
        if (err.message === 'Title already exists in this project')
            res.status(409).json({ error: err.message })
        else if (err.message.startsWith('Unauthorized'))
            res.status(404).json({ error: err.message })
        else next(err)
    }
})

router.delete('/:id', async (req, res, next) => {
    try {
        const userId = req.user!.userId
        await wikiService.deleteWikiPage(userId, req.params.id)
        res.status(204).end()
    } catch (err: any) {
        if (err.message.startsWith('Unauthorized')) res.status(404).json({ error: err.message })
        else next(err)
    }
})

export default router
