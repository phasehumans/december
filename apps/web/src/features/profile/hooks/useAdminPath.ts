import { useQuery } from '@tanstack/react-query'

import { profileAPI } from '../api/profile'

/** The admin panel's path, only for the admin (the server leaves it out for everyone else). */
export const useAdminPath = (enabled = true): string | undefined => {
    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
        enabled,
    })
    return profile?.isAdmin ? profile.adminPath : undefined
}
