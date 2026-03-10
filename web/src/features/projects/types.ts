import type { FormEvent, MouseEvent } from 'react'

export interface Project {
    id: string
    title: string
    description: string
    updatedAt: string
    isStarred: boolean
}

export interface BackendProject {
    id: string
    name: string
    description: string | null
    prompt: string
    isStarred: boolean
    projectStatus: 'DRAFT' | 'GENERATING' | 'READY' | 'DEPLOYED' | 'FAILED'
    createdAt: string
    updatedAt: string
    userId: string
}

export interface CreateProjectInput {
    name: string
    description?: string
    prompt: string
}

export interface UpdateProjectInput {
    rename?: string
    isStarred?: boolean
}

export interface ProjectListProps {
    onNewProject: () => void
    projects: Project[]
    isLoading: boolean
    isFetching: boolean
    errorMessage: string | null
}

export interface RenameModalState {
    isOpen: boolean
    project: Project | null
    value: string
}

export interface DeleteModalState {
    isOpen: boolean
    project: Project | null
}

export interface ProjectListRowProps {
    project: Project
    isMenuOpen: boolean
    isTogglePending: boolean
    onOpenProject: () => void
    onToggleStar: (id: string, event: MouseEvent) => void
    onToggleMenu: (id: string, event: MouseEvent) => void
    onOpenRename: (project: Project, event: MouseEvent) => void
    onOpenDelete: (project: Project, event: MouseEvent) => void
}

export interface ProjectRenameModalProps {
    isOpen: boolean
    value: string
    isPending: boolean
    onClose: () => void
    onChange: (nextValue: string) => void
    onSubmit: (event: FormEvent) => void
}

export interface ProjectDeleteModalProps {
    isOpen: boolean
    projectTitle?: string
    isPending: boolean
    onClose: () => void
    onConfirm: () => void
}
