import React, { useState } from 'react'

import type { ProjectRenameModalProps } from '@/features/projects/types'

import { Modal } from '@/shared/components/ui/Modal'

export const ProjectRenameModal: React.FC<ProjectRenameModalProps> = ({
    isOpen,
    value,
    isPending,
    onClose,
    onChange,
    onSubmit,
}) => {
    const [isSaving, setIsSaving] = useState(false)
    const isDisabled = isPending || isSaving

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        if (!value.trim() || isDisabled) return
        setIsSaving(true)
        setTimeout(() => {
            setIsSaving(false)
            onSubmit(event)
        }, 800)
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Rename project"
            description="Update how this project appears in your workspace."
            variant="premium"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                    <label
                        htmlFor="project-rename-input"
                        className="text-[11px] font-semibold text-[#8F8E8D] uppercase tracking-wider mb-1.5 block"
                    >
                        Project name
                    </label>
                    <input
                        id="project-rename-input"
                        type="text"
                        autoFocus
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full bg-[#2A2A2A] border border-[#2B2A27] rounded-lg px-3.5 py-2.5 text-white text-[13px] focus:outline-none focus:border-[#4E4D49] focus:ring-1 focus:ring-[#4E4D49] transition-[border-color,box-shadow] duration-200"
                        placeholder="Enter project name..."
                        disabled={isDisabled}
                    />
                </div>

                <div className="mt-1 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isDisabled}
                        className="border border-[#2B2A27] bg-transparent text-white hover:bg-white/5 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!value.trim() || isDisabled}
                        className="bg-white text-black hover:bg-neutral-200 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center min-w-[85px]"
                    >
                        {isSaving ? (
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
