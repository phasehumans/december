import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { ByokCredential, ByokList } from '@/features/profile/api/byok'

import { byokAPI } from '@/features/profile/api/byok'

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

    // the answer of a save or a check goes into the list at once (the prompt box reads the same
    // list), then the list loads again from the server
    const putCredential = (credential: ByokCredential) => {
        queryClient.setQueryData<ByokList>(byokQueryKey, (list) => {
            if (!list) return list
            const others = list.credentials.filter((c) => c.provider !== credential.provider)
            const isNew = others.length === list.credentials.length
            return {
                ...list,
                credentials: isNew
                    ? [...list.credentials, credential]
                    : list.credentials.map((c) =>
                          c.provider === credential.provider ? credential : c
                      ),
            }
        })
        return queryClient.invalidateQueries({ queryKey: byokQueryKey })
    }

    const dropCredential = (provider: string) => {
        queryClient.setQueryData<ByokList>(byokQueryKey, (list) =>
            list
                ? { ...list, credentials: list.credentials.filter((c) => c.provider !== provider) }
                : list
        )
        return queryClient.invalidateQueries({ queryKey: byokQueryKey })
    }

    const saveKey = useMutation({
        mutationFn: ({ provider, apiKey }: { provider: string; apiKey: string }) =>
            byokAPI.save(provider, apiKey),
        onSuccess: ({ credential }) => putCredential(credential),
    })

    const refreshKey = useMutation({
        mutationFn: (provider: string) => byokAPI.refresh(provider),
        onSuccess: ({ credential }) => putCredential(credential),
        // a 404 means the key is gone already: the list loads again either way
        onError: () => queryClient.invalidateQueries({ queryKey: byokQueryKey }),
    })

    const removeKey = useMutation({
        mutationFn: (provider: string) => byokAPI.remove(provider),
        onSuccess: (_data, provider) => dropCredential(provider),
        onError: () => queryClient.invalidateQueries({ queryKey: byokQueryKey }),
    })

    return { saveKey, refreshKey, removeKey }
}
