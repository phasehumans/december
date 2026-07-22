import React, { useState, useEffect } from 'react'

import { Icons } from '@/shared/components/ui/Icons'
import { Modal } from '@/shared/components/ui/Modal'

interface SessionTagsModalProps {
    isOpen: boolean
    session: any | null
    isPending: boolean
    onClose: () => void
    onSave: (tags: string[]) => void
}

export const SessionTagsModal: React.FC<SessionTagsModalProps> = ({
    isOpen,
    session,
    isPending,
    onClose,
    onSave,
}) => {
    const [tagInput, setTagInput] = useState<string>('')

    useEffect(() => {
        if (isOpen && session) {
            setTagInput(session.tags?.[0] || '')
        }
    }, [session, isOpen])

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault()
        if (isPending) return
        const trimmed = tagInput.trim()
        onSave(trimmed ? [trimmed] : [])
    }

    const handleClear = () => {
        setTagInput('')
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Manage Session Tag"
            description="Add, edit, or remove the tag for this session."
            variant="premium"
        >
            <form onSubmit={handleSave} className="flex flex-col gap-4">
                <p className="text-[13px] text-[#8F8E8D] leading-relaxed">
                    Assign a custom tag to{' '}
                    <span className="font-semibold text-white">
                        "{session?.title || 'this session'}"
                    </span>{' '}
                    for quick identification and categorization.
                </p>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <label
                            htmlFor="session-tag-input"
                            className="text-[11px] font-semibold text-[#8F8E8D] uppercase tracking-wider block"
                        >
                            Session Tag
                        </label>
                        {tagInput.trim() ? (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="text-[12px] text-red-400/90 hover:text-red-300 transition-colors focus:outline-none flex items-center gap-1"
                            >
                                <Icons.X className="w-3 h-3" />
                                Clear tag
                            </button>
                        ) : null}
                    </div>

                    <div className="relative flex items-center">
                        <input
                            id="session-tag-input"
                            type="text"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value.slice(0, 30))}
                            className="w-full bg-[#202020] border border-[#282828] rounded-lg px-3.5 py-2.5 text-white text-[13px] focus:border-[#4A4948] focus:outline-none transition-colors"
                            placeholder="Enter tag name (e.g. React, CLI, AI)..."
                            disabled={isPending}
                        />
                    </div>
                </div>

                <div className="mt-2 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isPending}
                        className="bg-transparent text-white hover:bg-white/5 active:scale-95 transition-all text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isPending}
                        className="bg-white text-black hover:bg-neutral-200 active:scale-95 transition-all text-[13px] font-medium px-5 py-2 rounded-lg focus:outline-none disabled:opacity-40 flex items-center justify-center min-w-[85px]"
                    >
                        {isPending ? (
                            <div className="flex items-center gap-1.5 justify-center">
                                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                <span>Saving...</span>
                            </div>
                        ) : (
                            'Save'
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    )
}
