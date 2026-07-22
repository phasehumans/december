import React, { useState, useEffect, useCallback } from 'react'

import { reviewAPI, type PullRequestReview } from '../../review/api/review'
import { ReviewDetailsDrawer } from '../../review/components/ReviewDetailsDrawer'
import { ReviewPreferencesDrawer } from '../../review/components/ReviewPreferencesDrawer'

import { Icons } from '@/shared/components/ui/Icons'

export const ReviewPage: React.FC = () => {
    const [prUrl, setPrUrl] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)

    const [reviews, setReviews] = useState<PullRequestReview[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [tabFilter, setTabFilter] = useState<'ALL' | 'AGENT' | 'EXTERNAL'>('ALL')

    const [selectedReview, setSelectedReview] = useState<PullRequestReview | null>(null)
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const [isPreferencesOpen, setIsPreferencesOpen] = useState(false)

    const fetchReviews = useCallback(async () => {
        try {
            const res: any = await reviewAPI.getReviews({ limit: 50 })
            const list = res?.data?.reviews || res?.reviews || []
            setReviews(list)
        } catch (err) {
            console.error('Failed to fetch reviews:', err)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchReviews()
    }, [fetchReviews])

    // Poll for pending or in-progress reviews
    useEffect(() => {
        const hasPending = reviews.some((r) => r.status === 'PENDING' || r.status === 'IN_PROGRESS')
        if (!hasPending) return

        const interval = setInterval(() => {
            fetchReviews()
        }, 2500)

        return () => clearInterval(interval)
    }, [reviews, fetchReviews])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!prUrl.trim() || isSubmitting) return

        setIsSubmitting(true)
        setSubmitError(null)

        try {
            const newReview = await reviewAPI.submitReview(prUrl.trim())
            setPrUrl('')
            fetchReviews()
            if (newReview) {
                const item = (newReview as any).data || newReview
                setSelectedReview(item)
                setIsDetailsOpen(true)
            }
        } catch (err: any) {
            setSubmitError(err.message || 'Failed to submit PR for review')
        } finally {
            setIsSubmitting(false)
        }
    }

    const filteredReviews = reviews.filter((r) => {
        if (tabFilter === 'AGENT') return r.isAutoReview
        if (tabFilter === 'EXTERNAL') return !r.isAutoReview
        return true
    })

    return (
        <div className="relative h-full w-full flex-1 overflow-y-auto bg-[#141414] px-4 pb-8 pt-16 font-sans no-scrollbar md:p-16">
            <div className="relative z-10 mx-auto max-w-6xl flex flex-col gap-8">
                {/* Top Header */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col">
                        <h1 className="text-[24px] font-medium text-[#D6D5C9] mb-1">PR Reviews</h1>
                        <p className="text-[13px] text-[#7B7A79]">
                            Review GitHub or GitLab pull requests with automated AI code quality
                            summaries, security checks, and diff analysis.
                        </p>
                    </div>

                    <button
                        onClick={() => setIsPreferencesOpen(true)}
                        className="flex items-center gap-2 rounded-lg border border-[#282828] bg-[#202020] px-4 py-2 text-[13px] font-medium text-[#949494] transition-colors hover:bg-[#282828] hover:text-white"
                    >
                        <Icons.Settings className="h-4 w-4" />
                        <span>Preferences</span>
                    </button>
                </div>

                {/* Main PR Submission Hero Box */}
                <div className="w-full rounded-2xl border border-[#282828] bg-[#1E1E1E] p-6 md:p-8 flex flex-col gap-4 shadow-xl">
                    <h2 className="text-[16px] font-semibold text-white">
                        Review any Pull Request
                    </h2>
                    <p className="text-[13px] text-[#8F8E8D] leading-relaxed">
                        Paste a public or private pull request URL from GitHub or GitLab to generate
                        an AI review report.
                    </p>

                    <form
                        onSubmit={handleSubmit}
                        className="relative w-full flex items-center gap-3"
                    >
                        <div className="relative flex-1">
                            <Icons.GitPullRequest className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7B7A79]" />
                            <input
                                type="text"
                                value={prUrl}
                                onChange={(e) => setPrUrl(e.target.value)}
                                placeholder="https://github.com/owner/repo/pull/123"
                                className="w-full bg-[#202020] border border-[#282828] hover:border-[#383736] focus:border-[#4A4948] rounded-xl pl-10 pr-4 py-3 text-[13.5px] text-white placeholder:text-[#555453] transition-colors focus:outline-none"
                                disabled={isSubmitting}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!prUrl.trim() || isSubmitting}
                            className="bg-white text-black hover:bg-neutral-200 active:scale-95 transition-all text-[13px] font-medium px-6 py-3 rounded-xl focus:outline-none disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2 shrink-0 min-w-[120px] justify-center"
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                    <span>Analyzing...</span>
                                </>
                            ) : (
                                <>
                                    <span>Submit PR</span>
                                    <Icons.ExternalLink className="w-3.5 h-3.5" />
                                </>
                            )}
                        </button>
                    </form>

                    {submitError && (
                        <div className="text-[12px] text-red-400 bg-red-950/30 border border-red-900/30 px-3 py-2 rounded-lg">
                            {submitError}
                        </div>
                    )}
                </div>

                {/* Filter Tabs & Recent Reviews Section */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[16px] font-semibold text-[#D6D5C9]">
                            Recent Pull Request Reviews
                        </h3>

                        {/* Filter Tabs */}
                        <div className="flex items-center gap-1 bg-[#202020] border border-[#282828] p-1 rounded-lg">
                            {(['ALL', 'AGENT', 'EXTERNAL'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setTabFilter(tab)}
                                    className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                                        tabFilter === tab
                                            ? 'bg-[#282828] text-white'
                                            : 'text-[#949494] hover:text-white'
                                    }`}
                                >
                                    {tab === 'ALL'
                                        ? 'All Reviews'
                                        : tab === 'AGENT'
                                          ? 'December Agent PRs'
                                          : 'External PRs'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Review List Table */}
                    {isLoading ? (
                        <div className="p-12 text-center text-[#7B7A79] text-[13px] bg-[#1E1E1E] rounded-xl border border-[#282828]">
                            Loading PR reviews...
                        </div>
                    ) : filteredReviews.length === 0 ? (
                        <div className="p-12 text-center text-[#7B7A79] text-[13px] bg-[#1E1E1E] rounded-xl border border-[#282828]">
                            No pull request reviews found. Submit a PR URL above to generate your
                            first review report!
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {filteredReviews.map((review) => {
                                const isPending =
                                    review.status === 'PENDING' || review.status === 'IN_PROGRESS'
                                return (
                                    <div
                                        key={review.id}
                                        onClick={() => {
                                            setSelectedReview(review)
                                            setIsDetailsOpen(true)
                                        }}
                                        className="group grid grid-cols-[minmax(0,2fr)_minmax(120px,1fr)_minmax(100px,auto)_minmax(120px,auto)_2.5rem] items-center gap-4 p-4 rounded-xl border border-[#282828] bg-[#1E1E1E] hover:bg-[#242323] cursor-pointer transition-colors"
                                    >
                                        {/* PR Title & Repo */}
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[14px] font-medium text-white group-hover:text-blue-400 transition-colors truncate">
                                                    {review.title}
                                                </span>
                                                {review.isAutoReview && (
                                                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-medium border border-blue-500/20 shrink-0">
                                                        Agent
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[12px] font-mono text-[#7B7A79] truncate">
                                                {review.repository} #{review.prNumber}
                                            </span>
                                        </div>

                                        {/* Author */}
                                        <div className="text-[13px] text-[#949494] truncate">
                                            {review.author}
                                        </div>

                                        {/* Status Badge */}
                                        <div>
                                            {isPending ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-[11px] font-medium text-amber-400">
                                                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                                                    {review.status === 'PENDING'
                                                        ? 'Queued'
                                                        : 'Analyzing...'}
                                                </span>
                                            ) : review.status === 'COMPLETED' ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-400">
                                                    <Icons.Check className="w-3 h-3" />
                                                    Completed
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-[11px] font-medium text-red-400">
                                                    Failed
                                                </span>
                                            )}
                                        </div>

                                        {/* Score Pill */}
                                        <div className="flex items-center justify-end">
                                            {review.score > 0 ? (
                                                <span className="px-3 py-1 rounded-lg bg-[#202020] border border-[#282828] text-[12px] font-bold text-white">
                                                    {review.score} / 100
                                                </span>
                                            ) : (
                                                <span className="text-[12px] text-[#7B7A79]">
                                                    --
                                                </span>
                                            )}
                                        </div>

                                        {/* External link action */}
                                        <div className="flex justify-end text-[#7B7A79] group-hover:text-white transition-colors">
                                            <Icons.ExternalLink className="w-4 h-4" />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Drawers */}
            <ReviewDetailsDrawer
                isOpen={isDetailsOpen}
                review={selectedReview}
                onClose={() => {
                    setIsDetailsOpen(false)
                    setSelectedReview(null)
                }}
            />

            <ReviewPreferencesDrawer
                isOpen={isPreferencesOpen}
                onClose={() => setIsPreferencesOpen(false)}
                onSaved={fetchReviews}
            />
        </div>
    )
}
