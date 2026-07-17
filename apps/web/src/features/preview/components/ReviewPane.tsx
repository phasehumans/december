import React, { useState } from 'react'

interface ReviewComment {
    id: string
    content: string
    prUrl?: string
    githubCommentId?: string
    createdAt: string
}

export const ReviewPane: React.FC = () => {
    const [comments, setComments] = useState<ReviewComment[]>([
        {
            id: '1',
            content: 'Looks good, but check the padding on the header.',
            prUrl: 'https://github.com/org/repo/pull/1',
            createdAt: new Date().toISOString(),
        },
    ])
    const [newComment, setNewComment] = useState('')
    const [prUrl, setPrUrl] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!newComment.trim()) return
        const comment: ReviewComment = {
            id: Math.random().toString(),
            content: newComment,
            prUrl: prUrl || undefined,
            createdAt: new Date().toISOString(),
        }
        setComments([comment, ...comments])
        setNewComment('')
        setPrUrl('')
    }

    return (
        <div className="flex flex-col h-full bg-white text-gray-900 border-l border-gray-200">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">Review & Feedback</h2>
                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                    {comments.length} Comments
                </span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
                {comments.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        <svg
                            className="mx-auto h-12 w-12 text-gray-400 mb-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1}
                                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                            />
                        </svg>
                        <p>No reviews yet.</p>
                    </div>
                ) : (
                    comments.map((c) => (
                        <div
                            key={c.id}
                            className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm transition-shadow hover:shadow-md"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center space-x-2">
                                    <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                                        You
                                    </div>
                                    <span className="text-xs text-gray-500 font-medium">
                                        {new Date(c.createdAt).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed">{c.content}</p>
                            {c.prUrl && (
                                <a
                                    href={c.prUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-3 inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-md transition-colors"
                                >
                                    <svg
                                        className="w-4 h-4 mr-1.5"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                    View PR on GitHub
                                </a>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="p-6 bg-white border-t border-gray-200">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow text-sm"
                            rows={3}
                            placeholder="Add a review comment..."
                        />
                    </div>
                    <div>
                        <input
                            type="url"
                            value={prUrl}
                            onChange={(e) => setPrUrl(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow text-sm"
                            placeholder="Optional PR URL (e.g., https://github.com/...)"
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors shadow-sm focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 outline-none"
                    >
                        Submit Review
                    </button>
                </form>
            </div>
        </div>
    )
}
