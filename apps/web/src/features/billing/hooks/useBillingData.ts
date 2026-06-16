import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { billingAPI } from '../api/billing'

export const billingQueryKeys = {
    overview: ['billing-overview'] as const,
    plans: ['billing-plans'] as const,
    history: (limit?: number, offset?: number, periodStart?: string, periodEnd?: string) =>
        ['credits-history', { limit, offset, periodStart, periodEnd }] as const,
}

export const useBillingOverview = () => {
    return useQuery({
        queryKey: billingQueryKeys.overview,
        queryFn: billingAPI.getOverview,
        staleTime: 10 * 1000, // 10 seconds stale time
    })
}

export const useBillingPlans = () => {
    return useQuery({
        queryKey: billingQueryKeys.plans,
        queryFn: billingAPI.getPlans,
        staleTime: 5 * 60 * 1000, // 5 minutes stale time
    })
}

export const useCreditsHistory = (
    params: { limit?: number; offset?: number; periodStart?: string; periodEnd?: string } = {}
) => {
    return useQuery({
        queryKey: billingQueryKeys.history(
            params.limit,
            params.offset,
            params.periodStart,
            params.periodEnd
        ),
        queryFn: () => billingAPI.getCreditsHistory(params),
        staleTime: 30 * 1000, // 30 seconds stale time
    })
}

export const useCreateSubscription = () => {
    return useMutation({
        mutationFn: billingAPI.createSubscription,
    })
}

export const useVerifySubscription = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: billingAPI.verifySubscription,
        onSuccess: () => {
            // Invalidate billing overview and profile to trigger updates across the app
            queryClient.invalidateQueries({ queryKey: billingQueryKeys.overview })
            queryClient.invalidateQueries({ queryKey: ['profile'] })
        },
    })
}

export const useCancelSubscription = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: billingAPI.cancelSubscription,
        onSuccess: () => {
            // Invalidate billing overview and profile
            queryClient.invalidateQueries({ queryKey: billingQueryKeys.overview })
            queryClient.invalidateQueries({ queryKey: ['profile'] })
        },
    })
}

export const useCreatePortalSession = () => {
    return useMutation({
        mutationFn: billingAPI.createPortalSession,
    })
}
