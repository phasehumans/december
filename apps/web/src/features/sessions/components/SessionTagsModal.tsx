import React, { useState, useEffect } from 'react'

import { ModalActions, inputClass } from '@/features/connections/components/ConnectionsUi'
import { Icons } from '@/shared/components/ui/Icons'
import { Modal } from '@/shared/components/ui/Modal'
import { cn } from '@/shared/lib/utils'

/** the server takes a tag up to this long */
const MAX_TAG_LENGTH = 30

interface SessionTagsModalProps {
    isOpen: boolean
    session: any | null
    isPending: boolean
    onClose: () => void
    onSave: (tags: string[]) => void
}

/** the tag filter splits tags on commas, so a tag cannot hold one (T6) */
const cleanTag = (value: string) => value.replace(/,/g, '').slice(0, MAX_TAG_LENGTH)

export const SessionTagsModal: React.FC<SessionTagsModalProps> = ({
    isOpen,
    session,
    isPending,
    onClose,
    onSave,
}) => {
    const [tagInput, setTagInput] = useState<string>('')
    const currentTag: string = session?.tags?.[0] || ''

    useEffect(() => {
        if (isOpen && session) {
            setTagInput(session.tags?.[0] || '')
        }
    }, [session, isOpen])

    const trimmed = tagInput.trim()
    // Save stays off until the tag changes. an empty field saves "no tag" (T5)
    const isUnchanged = trimmed === currentTag.trim()

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault()
        if (isPending || isUnchanged) return
        onSave(trimmed ? [trimmed] : [])
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Tag"
            description="One tag per session. Filter by it on Sessions and Pull requests."
            variant="premium"
            showLogo={false}
            sheetOnPhone
        >
            <form onSubmit={handleSave} className="flex flex-col gap-4">
                <div className="relative flex items-center">
                    <input
                        id="session-tag-input"
                        type="text"
                        autoFocus
                        aria-label="Tag name"
                        value={tagInput}
                        onChange={(e) => setTagInput(cleanTag(e.target.value))}
                        className={cn(inputClass, 'pr-9')}
                        placeholder="Tag name"
                        disabled={isPending}
                    />
                    {tagInput.trim() ? (
                        <button
                            type="button"
                            onClick={() => setTagInput('')}
                            className="absolute right-2.5 p-1 rounded-md text-[#7B7A79] hover:text-white hover:bg-white/10 transition-colors focus:outline-none cursor-pointer"
                            aria-label="Clear tag"
                            title="Clear tag"
                        >
                            <Icons.X className="w-3.5 h-3.5" />
                        </button>
                    ) : null}
                </div>
                <ModalActions
                    onCancel={onClose}
                    submitLabel="Save"
                    submitDisabled={isUnchanged}
                    isPending={isPending}
                />
            </form>
        </Modal>
    )
}
