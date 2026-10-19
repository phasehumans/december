export type ArtifactType = 'plan' | 'spec' | 'walkthrough' | 'review' | 'other'

export type ArtifactStatus = 'needs_review' | 'approved' | 'rejected' | 'draft'

export interface ArtifactEntry {
    id: string
    sessionId: string
    filename: string
    filePath: string
    title: string
    type: ArtifactType
    status: ArtifactStatus
    summary?: string
    content: string
    createdAt: number
    updatedAt: number
    requestFeedback?: boolean
}

export interface ArtifactReviewResult {
    action: 'proceed' | 'refine' | 'reject'
    feedback?: string
}
