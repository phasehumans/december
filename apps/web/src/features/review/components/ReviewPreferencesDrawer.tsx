import React, { useState, useEffect } from 'react'

import { reviewAPI, type ReviewPreference } from '../api/review'

import { Icons } from '@/shared/components/ui/Icons'
import { Modal } from '@/shared/components/ui/Modal'

interface ReviewPreferencesDrawerProps {
    isOpen: boolean
    onClose: () => void
    onSaved?: () => void
}

export const ReviewPreferencesDrawer: React.FC<ReviewPreferencesDrawerProps> = ({
    isOpen,
    onClose,
    onSaved,
}) => {
    const [autoReview, setAutoReview] = useState(true)
    const [strictness, setStrictness] = useState<'LENIENT' | 'STANDARD' | 'STRICT'>('STANDARD')
    const [focusAreas, setFocusAreas] = useState<string[]>([
        'SECURITY',
        'PERFORMANCE',
        'CLEAN_CODE',
    ])
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setIsLoading(true)
            reviewAPI
                .getPreferences()
                .then((res: any) => {
                    const data: ReviewPreference = res.data || res
                    if (data) {
                        setAutoReview(data.autoReviewAgentPrs)
                        setStrictness(data.defaultStrictness || 'STANDARD')
                        setFocusAreas(data.focusAreas || ['SECURITY', 'PERFORMANCE', 'CLEAN_CODE'])
                    }
                })
                .catch((err) => console.error('Failed to load preferences:', err))
                .finally(() => setIsLoading(false))
        }
    }, [isOpen])

    const toggleFocusArea = (area: string) => {
        setFocusAreas((prev) =>
            prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
        )
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSaving(true)
        try {
            await reviewAPI.updatePreferences({
                autoReviewAgentPrs: autoReview,
                defaultStrictness: strictness,
                focusAreas,
            })
            if (onSaved) onSaved()
            onClose()
        } catch (err) {
            console.error('Failed to update preferences:', err)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Review Preferences"
            description="Configure automated code review rules, strictness, and focus areas."
            variant="premium"
        >
            <form onSubmit={handleSave} className="flex flex-col gap-5">
                <p className="text-[13px] text-[#8F8E8D] leading-relaxed">
                    Set default AI reviewer behavior for both external PR submissions and
                    automatically generated December agent PRs.
                </p>

                {/* Auto Review Toggle */}
                <div className="flex items-center justify-between bg-[#202020] border border-[#282828] p-3.5 rounded-xl">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-medium text-white">
                            Auto-review Agent PRs
                        </span>
                        <span className="text-[11.5px] text-[#8F8E8D]">
                            Automatically run AI code reviews on PRs created by December agents
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAutoReview(!autoReview)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            autoReview ? 'bg-blue-600' : 'bg-[#383736]'
                        }`}
                    >
                        <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                autoReview ? 'translate-x-5' : 'translate-x-0'
                            }`}
                        />
                    </button>
                </div>

                {/* Strictness Level */}
                <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-semibold text-[#8F8E8D] uppercase tracking-wider block">
                        Review Strictness
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {(['LENIENT', 'STANDARD', 'STRICT'] as const).map((level) => (
                            <button
                                key={level}
                                type="button"
                                onClick={() => setStrictness(level)}
                                className={`py-2 px-3 rounded-lg border text-[12px] font-medium transition-all ${
                                    strictness === level
                                        ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                                        : 'border-[#282828] bg-[#202020] text-[#8F8E8D] hover:bg-[#272727] hover:text-white'
                                }`}
                            >
                                {level.charAt(0) + level.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Focus Areas */}
                <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-semibold text-[#8F8E8D] uppercase tracking-wider block">
                        Focus Areas
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { id: 'SECURITY', label: 'Security & Safety' },
                            { id: 'PERFORMANCE', label: 'Performance' },
                            { id: 'CLEAN_CODE', label: 'Clean Code & Architecture' },
                            { id: 'TESTING', label: 'Test Coverage' },
                        ].map((area) => {
                            const isChecked = focusAreas.includes(area.id)
                            return (
                                <button
                                    key={area.id}
                                    type="button"
                                    onClick={() => toggleFocusArea(area.id)}
                                    className={`flex items-center gap-2 py-2 px-3 rounded-lg border text-[12px] font-medium transition-all text-left ${
                                        isChecked
                                            ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                                            : 'border-[#282828] bg-[#202020] text-[#8F8E8D] hover:bg-[#272727] hover:text-white'
                                    }`}
                                >
                                    <div
                                        className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                                            isChecked
                                                ? 'bg-blue-500 border-blue-500 text-white'
                                                : 'border-[#383736] bg-[#141414]'
                                        }`}
                                    >
                                        {isChecked && <Icons.Check className="w-2.5 h-2.5" />}
                                    </div>
                                    <span>{area.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="mt-2 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="bg-transparent text-white hover:bg-white/5 active:scale-95 transition-all text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving || isLoading}
                        className="bg-white text-black hover:bg-neutral-200 active:scale-95 transition-all text-[13px] font-medium px-5 py-2 rounded-lg focus:outline-none disabled:opacity-40 flex items-center justify-center min-w-[85px]"
                    >
                        {isSaving ? 'Saving...' : 'Save Preferences'}
                    </button>
                </div>
            </form>
        </Modal>
    )
}
