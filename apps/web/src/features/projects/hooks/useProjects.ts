import { useQuery } from '@tanstack/react-query'

import { projectAPI } from '../api/project'

import { mapBackendProjectToUIProject } from '@/app/mapProject'
import { useAppStore } from '@/app/store'

export const useProjects = () => {
    const isAuthenticated = useAppStore((state) => state.isAuthenticated)

    return useQuery({
        queryKey: ['projects'],
        queryFn: projectAPI.getProjects,
        enabled: isAuthenticated,
        placeholderData: (previousData) => previousData,
        select: (backendProjects) =>
            [...backendProjects]
                .sort((a, b) => {
                    const createdAtDiff =
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()

                    if (createdAtDiff !== 0) {
                        return createdAtDiff
                    }

                    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
                })
                .map(mapBackendProjectToUIProject),
    })
}
