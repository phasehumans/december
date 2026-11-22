import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Profile } from '@/features/profile/api/profile'

import { onboardingAPI, type OnboardingState } from '@/features/onboarding/api/onboarding'

export const onboardingQueryKey = ['onboarding'] as const

export const useOnboardingState = (enabled = true) =>
    useQuery({
        queryKey: onboardingQueryKey,
        queryFn: onboardingAPI.get,
        enabled,
        staleTime: 15_000,
    })

export const useOnboardingMutations = () => {
    const queryClient = useQueryClient()
    const store = (state: OnboardingState) => queryClient.setQueryData(onboardingQueryKey, state)

    const updateOnboarding = useMutation({
        mutationFn: onboardingAPI.update,
        onSuccess: store,
    })

    const completeOnboarding = useMutation({
        mutationFn: onboardingAPI.complete,
        onSuccess: (state) => {
            store(state)
            // the app gate reads the profile, so mark it done right away
            queryClient.setQueryData<Profile>(['profile'], (current) =>
                current ? { ...current, onboardingCompletedAt: state.completedAt } : current
            )
            void queryClient.invalidateQueries({ queryKey: ['profile'] })
        },
    })

    return { updateOnboarding, completeOnboarding }
}
