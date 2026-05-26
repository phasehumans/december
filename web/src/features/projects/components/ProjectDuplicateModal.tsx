import React, { useState, useEffect } from 'react'

import type { ProjectDuplicateModalProps } from '@/features/projects/types'

import { Modal } from '@/shared/components/ui/Modal'

export const ProjectDuplicateModal: React.FC<ProjectDuplicateModalProps> = ({
    isOpen,
    projectTitle,
    isPending,
    onClose,
    onConfirm,
}) => {
    const [nameVal, setNameVal] = useState('')
    const [isDuplicating, setIsDuplicating] = useState(false)
    const isDisabled = isPending || isDuplicating

    useEffect(() => {
        if (projectTitle) {
            setNameVal(`Copy of ${projectTitle}`)
        } else {
            setNameVal('Copy of Project')
        }
    }, [projectTitle, isOpen])

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        if (isDisabled) return
        setIsDuplicating(true)
        setTimeout(() => {
            setIsDuplicating(false)
            onConfirm(nameVal)
        }, 800)
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Duplicate project"
            description="Create a copy of this project in your workspace."
            variant="premium"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                    <label
                        htmlFor="project-duplicate-input"
                        className="text-[11px] font-semibold text-[#8F8E8D] uppercase tracking-wider mb-1.5 block"
                    >
                        Project name
                    </label>
                    <input
                        id="project-duplicate-input"
                        type="text"
                        value={nameVal}
                        onChange={(e) => setNameVal(e.target.value)}
                        className="w-full bg-[#181817] border border-[#2B2A27] rounded-lg px-3.5 py-2.5 text-white text-[13px] focus:outline-none focus:border-[#4E4D49] focus:ring-1 focus:ring-[#4E4D49] transition-all"
                        placeholder="Project name..."
                        disabled={isDisabled}
                    />
                </div>

                <div className="mt-1 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isDisabled}
                        className="border border-[#2B2A27] bg-transparent text-white hover:bg-white/5 active:scale-95 transition-all text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isDisabled}
                        className="bg-white text-black hover:bg-neutral-200 active:scale-95 transition-all text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center min-w-[110px]"
                    >
                        {isDuplicating ? (
                            <div className="flex items-center gap-1.5 justify-center">
                                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                <span>Duplicating...</span>
                            </div>
                        ) : (
                            'Duplicate'
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    )
}
