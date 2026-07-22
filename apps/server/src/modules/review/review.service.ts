import { AppError } from '../../shared/appError'

import { triggerAsyncReview } from './review.engine'
import { reviewRepository } from './review.repository'
import type {
    CreatePullRequestReviewDto,
    GetReviewsQueryDto,
    UpdateReviewPreferencesDto,
} from './review.schema'

export async function createPullRequestReview(userId: string, data: CreatePullRequestReviewDto) {
    const { prUrl, sessionId, preferences } = data

    // Extract repo & PR number from URL
    const match = prUrl.match(
        /(?:github\.com|gitlab\.com)\/([^/]+\/[^/]+)\/(?:pull|merge_requests)\/(\d+)/i
    )
    const repository = match && match[1] ? match[1] : 'december-ai/app'
    const prNumberStr = match && match[2] ? match[2] : ''
    const prNumber = prNumberStr ? parseInt(prNumberStr, 10) : Math.floor(Math.random() * 800) + 100
    const provider = prUrl.includes('gitlab.com') ? 'GITLAB' : 'GITHUB'

    // Get user preferences
    const userPrefs = await reviewRepository.findPreferencesByUserId(userId)
    const effectivePreferences = preferences || {
        strictness: userPrefs?.defaultStrictness || 'STANDARD',
        focusAreas: userPrefs?.focusAreas || ['SECURITY', 'PERFORMANCE', 'CLEAN_CODE'],
    }

    const title = `Review PR #${prNumber} in ${repository}`
    const author = 'External Author'

    const review = await reviewRepository.createReview({
        userId,
        sessionId,
        prUrl,
        prNumber,
        repository,
        provider,
        title,
        author,
        status: 'PENDING',
        isAutoReview: false,
        preferences: effectivePreferences as any,
    })

    // Trigger async processing
    triggerAsyncReview(review.id, prUrl).catch((err) => {
        console.error('Async review execution error:', err)
    })

    return review
}

export async function getUserReviews(userId: string, query: GetReviewsQueryDto) {
    const filters = {
        repository: query.repository,
        status: query.status,
        isAutoReview:
            query.isAutoReview === 'true'
                ? true
                : query.isAutoReview === 'false'
                  ? false
                  : undefined,
        search: query.search,
        page: query.page,
        limit: query.limit,
    }

    return reviewRepository.findReviewsByUserId(userId, filters)
}

export async function getReviewById(userId: string, reviewId: string) {
    const review = await reviewRepository.findReviewById(reviewId, userId)
    if (!review) throw new AppError('Review not found', 404)
    return review
}

export async function deleteReview(userId: string, reviewId: string) {
    const deleted = await reviewRepository.deleteReview(reviewId, userId)
    if (!deleted) throw new AppError('Review not found', 404)
    return { success: true }
}

export async function getUserPreferences(userId: string) {
    const prefs = await reviewRepository.findPreferencesByUserId(userId)
    if (!prefs) {
        return reviewRepository.upsertPreferences(userId, {})
    }
    return prefs
}

export async function updateUserPreferences(userId: string, data: UpdateReviewPreferencesDto) {
    return reviewRepository.upsertPreferences(userId, data)
}

export const reviewService = {
    createPullRequestReview,
    getUserReviews,
    getReviewById,
    deleteReview,
    getUserPreferences,
    updateUserPreferences,
}
