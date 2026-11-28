import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { billingAPI } from '../api/billing'

import type { CreditsHistoryParams, TransactionsParams } from '../api/billing'

export const billingQueryKeys = {
    overview: ['billing-overview'] as const,
    freeCredits: ['free-credit-request'] as const,
    limits: ['billing-limits'] as const,
    referral: ['billing-referral'] as const,
    history: (params: CreditsHistoryParams = {}) => ['credits-history', params] as const,
    // every page of the payments list starts with this key, so one invalidate reaches them all
    transactions: ['billing-transactions'] as const,
}

export const useBillingOverview = (enabled: boolean = true) => {
    return useQuery({
        queryKey: billingQueryKeys.overview,
        queryFn: billingAPI.getOverview,
        staleTime: 10 * 1000, // 10 seconds stale time
        enabled,
    })
}

export const useCreditsHistory = (params: CreditsHistoryParams = {}) => {
    return useQuery({
        queryKey: billingQueryKeys.history(params),
        queryFn: () => billingAPI.getCreditsHistory(params),
        staleTime: 30 * 1000, // 30 seconds stale time
        // the page before stays on screen while the next page or range loads
        placeholderData: keepPreviousData,
    })
}

/** one page of the payments list on Billing */
export const useBillingTransactions = (params: TransactionsParams) => {
    return useQuery({
        queryKey: [...billingQueryKeys.transactions, params] as const,
        queryFn: () => billingAPI.listTransactions(params),
        staleTime: 30 * 1000,
        placeholderData: keepPreviousData,
    })
}

export const useFreeCreditRequest = () => {
    return useQuery({
        queryKey: billingQueryKeys.freeCredits,
        queryFn: () => billingAPI.getFreeCreditRequest(),
        staleTime: 60 * 1000,
    })
}

export const useRequestFreeCredits = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: billingAPI.requestFreeCredits,
        onSuccess: (request) => {
            queryClient.setQueryData(billingQueryKeys.freeCredits, request)
        },
    })
}
