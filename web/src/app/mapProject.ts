import type { Project } from '@/features/projects/types'
import type { BackendProject } from '@/features/projects/api/project'

export const mapBackendProjectToUIProject = (project: BackendProject): Project => {
    const updatedAt = new Date(project.updatedAt)

    return {
        id: project.id,
        title: project.name,
        description: project.description ?? '',
        isStarred: project.isStarred,
        updatedAt: updatedAt.toLocaleString(),
    }
}
