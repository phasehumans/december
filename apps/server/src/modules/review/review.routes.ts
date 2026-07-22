import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { reviewController } from './review.controller'

const reviewRouter = Router()

reviewRouter.use(authMiddleware)

// 1. Preferences routes
reviewRouter.get('/preferences', reviewController.getPreferences)
reviewRouter.put('/preferences', reviewController.updatePreferences)

// 2. PR Review routes
reviewRouter.post('/', reviewController.createReview)
reviewRouter.get('/', reviewController.getReviews)
reviewRouter.get('/:id', reviewController.getReviewById)
reviewRouter.delete('/:id', reviewController.deleteReview)

export default reviewRouter
