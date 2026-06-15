import React, { useState, useEffect } from 'react'

import { Modal } from '@/shared/components/ui/Modal'

interface TemplateRemixModalProps {
    isOpen: boolean
    templateTitle?: string
    isPending: boolean
    onClose: () => void
    onConfirm: (name: string) => void
}

export const TemplateRemixModal: React.FC<TemplateRemixModalProps> = ({
    isOpen,
    templateTitle,
    isPending,
    onClose,
    onConfirm,
}) => {
    const [projectName, setProjectName] = useState('')
    const [isRemixing, setIsRemixing] = useState(false)
    const isDisabled = isPending || isRemixing

    useEffect(() => {
        if (templateTitle) {
            setProjectName(`Remix of ${templateTitle}`)
        } else {
            setProjectName('Remix of Project')
        }
    }, [templateTitle, isOpen])

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        if (isDisabled) return
        setIsRemixing(true)
        setTimeout(() => {
            setIsRemixing(false)
            onConfirm(projectName)
        }, 800)
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Remix project"
            description="By remixing a project, you will create a copy that you own."
            variant="premium"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                    <label
                        htmlFor="project-remix-input"
                        className="text-[11px] font-semibold text-[#8F8E8D] uppercase tracking-wider mb-1.5 block"
                    >
                        Project name
                    </label>
                    <input
                        id="project-remix-input"
                        type="text"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        className="w-full bg-[#181817] border border-[#2B2A27] rounded-lg px-3.5 py-2.5 text-white text-[13px] focus:outline-none focus:border-[#4E4D49] focus:ring-1 focus:ring-[#4E4D49] transition-[border-color,box-shadow] duration-200"
                        placeholder="Project name..."
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
                        disabled={isDisabled}
                        className="bg-white text-black hover:bg-neutral-200 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center min-w-[90px]"
                    >
                        {isRemixing ? (
                            <div className="flex items-center gap-1.5 justify-center">
                                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                <span>Remixing...</span>
                            </div>
                        ) : (
                            'Remix'
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    )
}
