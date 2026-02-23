import React, { useState, useEffect } from 'react'
import { Icons } from '../../ui/Icons'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import type { Project } from '../../../types'

interface ProjectListProps {
    onNewProject: () => void
    projects: Project[]
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>
}

export const ProjectList: React.FC<ProjectListProps> = ({
    onNewProject,
    projects,
    setProjects,
}) => {
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

    // Modal States
    const [renameModal, setRenameModal] = useState<{
        isOpen: boolean
        project: Project | null
        value: string
    }>({
        isOpen: false,
        project: null,
        value: '',
    })
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; project: Project | null }>({
        isOpen: false,
        project: null,
    })

    useEffect(() => {
        const handleClickOutside = () => setMenuOpenId(null)
        if (menuOpenId) window.addEventListener('click', handleClickOutside)
        return () => window.removeEventListener('click', handleClickOutside)
    }, [menuOpenId])

    const toggleStar = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setProjects((prev) =>
            prev.map((p) => (p.id === id ? { ...p, isStarred: !p.isStarred } : p))
        )
    }

    const [isRenaming, setIsRenaming] = useState(false)

    const handleRename = (e: React.FormEvent) => {
        e.preventDefault()
        if (renameModal.project && renameModal.value.trim()) {
            setIsRenaming(true)
            setTimeout(() => {
                setProjects((prev) =>
                    prev.map((p) =>
                        p.id === renameModal.project?.id
                            ? { ...p, title: renameModal.value.trim() }
                            : p
                    )
                )
                setRenameModal({ isOpen: false, project: null, value: '' })
                setIsRenaming(false)
            }, 1000)
        }
    }

    const handleDelete = () => {
        if (deleteModal.project) {
            setProjects((prev) => prev.filter((p) => p.id !== deleteModal.project?.id))
            setDeleteModal({ isOpen: false, project: null })
        }
    }

    return (
        <div className="flex-1 overflow-y-auto no-scrollbar px-8 pb-8 pt-20 md:p-16 animate-in fade-in duration-500 w-full font-sans bg-background relative h-full">
            <div className="max-w-6xl mx-auto relative z-10">
                <div className="flex flex-col gap-2 mb-12">
                    <h1 className="text-3xl font-medium text-textMain tracking-tight">Projects</h1>
                    <p className="text-neutral-500 text-sm max-w-md leading-relaxed">
                        View and manage your generated interfaces.
                    </p>
                </div>

                <div className="grid grid-cols-12 gap-4 px-6 py-3 text-[11px] font-medium text-neutral-500 uppercase tracking-wider border-b border-white/5 mb-2 select-none">
                    <div className="col-span-6">Name</div>
                    <div className="col-span-4">Last Edited</div>
                    <div className="col-span-2 text-right"></div>
                </div>

                <div className="flex flex-col gap-1">
                    {projects.map((project) => (
                        <div
                            key={project.id}
                            className="group grid grid-cols-12 gap-4 items-center px-6 py-4 rounded-xl hover:bg-surface/40 border border-transparent hover:border-white/5 transition-all duration-200 cursor-pointer relative"
                            onClick={onNewProject}
                        >
                            <div className="col-span-6 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-surface border border-white/5 hidden md:flex items-center justify-center text-neutral-500 group-hover:text-white transition-colors shrink-0 shadow-sm">
                                    <Icons.Globe className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                                    <span className="text-[15px] font-medium text-textMain truncate group-hover:text-white transition-colors">
                                        {project.title}
                                    </span>
                                    <span className="text-xs text-neutral-600 truncate group-hover:text-neutral-500 transition-colors">
                                        {project.description}
                                    </span>
                                </div>
                            </div>
                            <div className="col-span-4 text-sm text-neutral-500 group-hover:text-neutral-400 transition-colors font-medium">
                                {project.updatedAt}
                            </div>
                            <div className="col-span-2 flex items-center justify-end gap-2 relative">
                                <button
                                    onClick={(e) => toggleStar(project.id, e)}
                                    className="p-2 rounded-lg transition-all duration-200 hover:bg-white/5 focus:outline-none"
                                    title={project.isStarred ? 'Unstar' : 'Star'}
                                >
                                    <Icons.Star
                                        className={`w-4 h-4 transition-colors ${project.isStarred ? 'fill-white text-white' : 'text-neutral-600 hover:text-white'}`}
                                    />
                                </button>
                                <div
                                    className={`relative ${menuOpenId === project.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setMenuOpenId(
                                                menuOpenId === project.id ? null : project.id
                                            )
                                        }}
                                        className={`p-2 text-neutral-600 hover:text-white rounded-lg hover:bg-white/5 transition-all ${menuOpenId === project.id ? 'text-white bg-white/5' : ''}`}
                                    >
                                        <Icons.MoreHorizontal className="w-4 h-4" />
                                    </button>
                                    {menuOpenId === project.id && (
                                        <div
                                            className="absolute top-9 right-0 bg-[#1C1C1E] border border-white/10 rounded-lg shadow-xl z-30 w-48 py-1.5 flex flex-col ring-1 ring-black/50 animate-in fade-in zoom-in-95 duration-100"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setRenameModal({
                                                        isOpen: true,
                                                        project,
                                                        value: project.title,
                                                    })
                                                    setMenuOpenId(null)
                                                }}
                                                className="flex items-center gap-2 px-3 py-2 text-[13px] text-neutral-300 hover:text-white hover:bg-white/5 text-left transition-colors mx-1 rounded-md w-full"
                                            >
                                                <Icons.Edit className="w-3.5 h-3.5" /> Rename
                                            </button>
                                            <div className="h-px bg-white/5 my-1 mx-1" />
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setDeleteModal({ isOpen: true, project })
                                                    setMenuOpenId(null)
                                                }}
                                                className="flex items-center gap-2 px-3 py-2 text-[13px] text-red-400 hover:text-red-300 hover:bg-white/5 text-left transition-colors mx-1 rounded-md w-full"
                                            >
                                                <Icons.Trash className="w-3.5 h-3.5" /> Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {projects.length === 0 && (
                        <div className="py-20 text-center flex flex-col items-center justify-center gap-3 text-neutral-600">
                            <span className="text-sm">No projects found.</span>
                            <button
                                onClick={onNewProject}
                                className="text-xs text-[#E8E8E6] hover:underline"
                            >
                                Create a new one
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <Modal
                isOpen={renameModal.isOpen}
                onClose={() => setRenameModal({ ...renameModal, isOpen: false })}
                title="Rename project"
                description="Update how this project appears in your workspace."
            >
                <form onSubmit={handleRename} className="flex flex-col gap-4">
                    <Input
                        label="Display Name"
                        autoFocus
                        value={renameModal.value}
                        onChange={(e) =>
                            setRenameModal((prev) => ({ ...prev, value: e.target.value }))
                        }
                    />
                    <div className="flex items-center justify-end gap-3 mt-4">
                        <Button
                            variant="ghost"
                            type="button"
                            onClick={() => setRenameModal({ ...renameModal, isOpen: false })}
                            disabled={isRenaming}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!renameModal.value.trim() || isRenaming}
                            isLoading={isRenaming}
                        >
                            Save
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                title="Delete project?"
                maxWidth="max-w-[400px]"
            >
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-neutral-400 leading-relaxed">
                        Are you sure you want to delete{' '}
                        <span className="text-white font-medium">
                            "{deleteModal.project?.title}"
                        </span>
                        ? This action cannot be undone.
                    </p>
                    <div className="flex items-center justify-end gap-3 mt-2">
                        <Button
                            variant="ghost"
                            onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            className="bg-red-600 text-white border-0 hover:bg-red-700"
                            onClick={handleDelete}
                        >
                            Continue
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
