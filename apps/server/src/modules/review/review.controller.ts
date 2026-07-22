import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'
import {
    createPullRequestReviewSchema,
    getReviewsQuerySchema,
    updateReviewPreferencesSchema,
} from './review.schema'
import { reviewService } from './review.service'

import type { Request, Response } from 'express'

const getPreferences = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const preferences = await reviewService.getUserPreferences(userId)
    return sendSuccess(res, 'review preferences retrieved successfully', preferences)
})

const updatePreferences = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const data = updateReviewPreferencesSchema.parse(req.body)
    const preferences = await reviewService.updateUserPreferences(userId, data)
    return sendSuccess(res, 'review preferences updated successfully', preferences)
})

const createReview = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const data = createPullRequestReviewSchema.parse(req.body)
    const review = await reviewService.createPullRequestReview(userId, data)
    return sendSuccess(res, 'pr review initiated successfully', review, 201)
})

const getReviews = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const query = getReviewsQuerySchema.parse(req.query)
    const result = await reviewService.getUserReviews(userId, query)
    return sendSuccess(res, 'pr reviews retrieved successfully', {
        reviews: result.reviews,
        pagination: result.pagination,
    })
})

const getReviewById = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const id = req.params.id as string
    if (!id) throw new AppError('review id is required', 400)

    const review = await reviewService.getReviewById(userId, id)
    return sendSuccess(res, 'pr review retrieved successfully', review)
})

const deleteReview = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const id = req.params.id as string
    if (!id) throw new AppError('review id is required', 400)

    await reviewService.deleteReview(userId, id)
    return sendSuccess(res, 'pr review deleted successfully', null)
})

export const reviewController = {
    getPreferences,
    updatePreferences,
    createReview,
    getReviews,
    getReviewById,
    deleteReview,
}
