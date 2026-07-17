import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { CreateReviewSchema } from './review.schema'
import * as reviewService from './review.service'

const router = Router()

router.use(authMiddleware)

router.get('/:sessionId', async (req, res, next) => {
    try {
        const userId = req.user!.userId
        const { sessionId } = req.params
        const reviews = await reviewService.getReviewsForSession(userId, sessionId)
        res.json({ reviews })
    } catch (err: any) {
        if (err.message === 'Unauthorized or session not found') {
            res.status(403).json({ error: err.message })
        } else {
            next(err)
        }
    }
})

router.post('/', async (req, res, next) => {
    try {
        const data = CreateReviewSchema.parse(req.body)
        const userId = req.user!.userId
        const review = await reviewService.createReview(userId, data)
        res.status(201).json({ review })
    } catch (err: any) {
        if (err.message === 'Unauthorized or session not found') {
            res.status(403).json({ error: err.message })
        } else {
            next(err)
        }
    }
})

export default router
