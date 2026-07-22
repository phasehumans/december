import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'
import { sendSuccess } from '../../shared/response'

import {
    createPullRequestReviewSchema,
    getReviewsQuerySchema,
    updateReviewPreferencesSchema,
} from './review.schema'
import * as reviewService from './review.service'

const router = Router()

router.use(authMiddleware)

// 1. Preferences routes
router.get('/preferences', async (req, res, next) => {
    try {
        const userId = req.user!.userId
        const preferences = await reviewService.getUserPreferences(userId)
        sendSuccess(res, preferences, 'Review preferences retrieved successfully')
    } catch (err) {
        next(err)
    }
})

router.put('/preferences', async (req, res, next) => {
    try {
        const userId = req.user!.userId
        const data = updateReviewPreferencesSchema.parse(req.body)
        const preferences = await reviewService.updateUserPreferences(userId, data)
        sendSuccess(res, preferences, 'Review preferences updated successfully')
    } catch (err) {
        next(err)
    }
})

// 2. PR Review routes
router.post('/', async (req, res, next) => {
    try {
        const userId = req.user!.userId
        const data = createPullRequestReviewSchema.parse(req.body)
        const review = await reviewService.createPullRequestReview(userId, data)
        sendSuccess(res, review, 'PR review initiated successfully', 201)
    } catch (err) {
        next(err)
    }
})

router.get('/', async (req, res, next) => {
    try {
        const userId = req.user!.userId
        const query = getReviewsQuerySchema.parse(req.query)
        const result = await reviewService.getUserReviews(userId, query)
        sendSuccess(
            res,
            { reviews: result.reviews, pagination: result.pagination },
            'PR reviews retrieved successfully'
        )
    } catch (err) {
        next(err)
    }
})

router.get('/:id', async (req, res, next) => {
    try {
        const userId = req.user!.userId
        const { id } = req.params
        const review = await reviewService.getReviewById(userId, id)
        sendSuccess(res, review, 'PR review retrieved successfully')
    } catch (err) {
        next(err)
    }
})

router.delete('/:id', async (req, res, next) => {
    try {
        const userId = req.user!.userId
        const { id } = req.params
        await reviewService.deleteReview(userId, id)
        sendSuccess(res, { success: true }, 'PR review deleted successfully')
    } catch (err) {
        next(err)
    }
})

export default router
