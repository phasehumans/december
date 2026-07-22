import type {
    CreatePullRequestReviewDto,
    GetReviewsQueryDto,
    UpdateReviewPreferencesDto,
} from './review.schema'

export type ReviewStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
export type ReviewProvider = 'GITHUB' | 'GITLAB'

export type CreatePullRequestReview = {
    userId: string
    data: CreatePullRequestReviewDto
}

export type GetUserReviews = {
    userId: string
    query: GetReviewsQueryDto
}

export type GetReviewById = {
    userId: string
    reviewId: string
}

export type DeleteReview = {
    userId: string
    reviewId: string
}

export type GetUserPreferences = {
    userId: string
}

export type UpdateUserPreferences = {
    userId: string
    data: UpdateReviewPreferencesDto
}
