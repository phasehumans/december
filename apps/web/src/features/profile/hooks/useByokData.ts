import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { byokAPI } from '@/features/profile/api/byok'
import { profileAPI } from '@/features/profile/api/profile'

export const byokQueryKey = ['byok'] as const

export const useByokList = (enabled = true) =>
    useQuery({
        queryKey: byokQueryKey,
        queryFn: byokAPI.list,
        enabled,
        staleTime: 60_000,
    })

export const useByokMutations = () => {
    const queryClient = useQueryClient()
    const invalidate = () => queryClient.invalidateQueries({ queryKey: byokQueryKey })

    const saveKey = useMutation({
        mutationFn: ({ provider, apiKey }: { provider: string; apiKey: string }) =>
            byokAPI.save(provider, apiKey),
        onSuccess: invalidate,
    })

    const refreshKey = useMutation({
        mutationFn: (provider: string) => byokAPI.refresh(provider),
        onSuccess: invalidate,
    })

    const removeKey = useMutation({
        mutationFn: (provider: string) => byokAPI.remove(provider),
        onSuccess: invalidate,
    })

    const updateModelSource = useMutation({
        mutationFn: (source: 'CREDITS' | 'OWN_KEY') => profileAPI.updateModelSource(source),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
    })

    return { saveKey, refreshKey, removeKey, updateModelSource }
}
