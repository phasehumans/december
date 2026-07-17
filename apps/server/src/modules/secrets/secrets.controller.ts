import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { CreateSecretSchema } from './secrets.schema'
import * as secretsService from './secrets.service'

const router = Router()

router.use(authMiddleware)

router.get('/', async (req, res, next) => {
    try {
        const userId = req.user!.userId
        const secrets = await secretsService.getSecrets(userId)
        res.json({ secrets })
    } catch (err) {
        next(err)
    }
})

router.post('/', async (req, res, next) => {
    try {
        const data = CreateSecretSchema.parse(req.body)
        const userId = req.user!.userId
        const secret = await secretsService.createSecret(userId, data.name, data.value)
        res.status(201).json({ secret: { id: secret.id, name: secret.name } })
    } catch (err) {
        next(err)
    }
})

router.delete('/:name', async (req, res, next) => {
    try {
        const userId = req.user!.userId
        const { name } = req.params
        await secretsService.deleteSecret(userId, name)
        res.status(204).end()
    } catch (err) {
        next(err)
    }
})

export { router as secretsRouter }
