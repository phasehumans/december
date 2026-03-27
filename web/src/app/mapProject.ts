import type { Project } from '@/features/projects/types'
import type { BackendProject } from '@/features/projects/api/project'

const MINUTE_IN_MS = 60 * 1000
const HOUR_IN_MS = 60 * MINUTE_IN_MS
const DAY_IN_MS = 24 * HOUR_IN_MS

const formatUnit = (value: number, unit: string) => {
    return `${value} ${unit}${value === 1 ? '' : 's'} ago`
}

const formatRelativeUpdatedAt = (updatedAt: Date, now: Date = new Date()) => {
    const updatedAtTime = updatedAt.getTime()
    const nowTime = now.getTime()

    if (Number.isNaN(updatedAtTime) || Number.isNaN(nowTime)) {
        return 'less than minute ago'
    }

    const diffInMs = Math.max(0, nowTime - updatedAtTime)

    if (diffInMs < MINUTE_IN_MS) {
        return 'less than minute ago'
    }

    if (diffInMs < HOUR_IN_MS) {
        return formatUnit(Math.floor(diffInMs / MINUTE_IN_MS), 'minute')
    }

    if (diffInMs < DAY_IN_MS) {
        return formatUnit(Math.floor(diffInMs / HOUR_IN_MS), 'hour')
    }

    const diffInDays = Math.floor(diffInMs / DAY_IN_MS)

    if (diffInDays < 7) {
        return formatUnit(diffInDays, 'day')
    }

    if (diffInDays < 30) {
        return formatUnit(Math.floor(diffInDays / 7), 'week')
    }

    if (diffInDays < 365) {
        return formatUnit(Math.floor(diffInDays / 30), 'month')
    }

    return formatUnit(Math.floor(diffInDays / 365), 'year')
}

export const mapBackendProjectToUIProject = (project: BackendProject): Project => {
    const updatedAt = new Date(project.updatedAt)

    return {
        id: project.id,
        title: project.name,
        description: project.description ?? '',
        isStarred: project.isStarred,
        updatedAt: formatRelativeUpdatedAt(updatedAt),
        versionCount: project.versionCount,
        currentVersionId: project.currentVersionId,
    }
}
