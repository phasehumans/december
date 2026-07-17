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
    const [tag, setTag] = useState<string>('')
    const [inputVal, setInputVal] = useState<string>('')

    useEffect(() => {
        if (session) {
            const initialTag = session.tags?.[0] || ''
            setTag(initialTag)
            setInputVal(initialTag)
        } else {
            setTag('')
            setInputVal('')
        }
    }, [session, isOpen])

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault()
        if (isPending) return
        const finalTags = tag.trim() ? [tag.trim()] : []
        onSave(finalTags)
    }

    const handleAddTag = () => {
        if (inputVal.trim()) {
            setTag(inputVal.trim())
        }
    }

    const handleRemoveTag = () => {
        setTag('')
        setInputVal('')
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Manage Session Tag"
            description="Add or edit the tag for this session. A session can have at most one tag."
            variant="premium"
        >
            <form onSubmit={handleSave} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <label
                        htmlFor="session-tag-input"
                        className="text-[11px] font-semibold text-[#8F8E8D] uppercase tracking-wider block"
                    >
                        Session Tag
                    </label>

                    {tag ? (
                        <div className="flex items-center justify-between bg-white/[0.02] border border-[#2B2A27] rounded-xl p-3.5 animate-in fade-in duration-200">
                            <span className="inline-flex items-center rounded-md border border-[#383736] bg-[#242323] px-2.5 py-1 text-[13px] font-medium text-[#D6D5C9]">
                                {tag}
                            </span>
                            <button
                                type="button"
                                onClick={handleRemoveTag}
                                className="flex items-center gap-1.5 text-[12px] text-red-400/90 hover:text-red-300 transition-colors focus:outline-none"
                            >
                                <Icons.X className="w-3.5 h-3.5" />
                                Remove tag
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <input
                                id="session-tag-input"
                                type="text"
                                value={inputVal}
                                onChange={(e) => setInputVal(e.target.value.slice(0, 30))}
                                className="flex-1 bg-white/[0.03] border border-[#2B2A27] rounded-lg px-3.5 py-2.5 text-white text-[13px] focus:outline-none transition-[border-color,box-shadow] duration-200"
                                placeholder="Enter tag name (e.g. react, design)..."
                                disabled={isPending}
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={handleAddTag}
                                disabled={!inputVal.trim() || isPending}
                                className="bg-[#242323] text-[#D6D5C9] border border-[#383736] hover:bg-[#2F2E2D] disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-all text-[13px] font-medium px-4 py-2.5 rounded-lg focus:outline-none"
                            >
                                Add
                            </button>
                        </div>
                    )}
                </div>

                <div className="mt-2 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isPending}
                        className="bg-transparent text-white hover:bg-white/5 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isPending}
                        className="bg-white text-black hover:bg-neutral-200 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-5 py-2 rounded-lg focus:outline-none disabled:opacity-40 flex items-center justify-center min-w-[85px]"
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
