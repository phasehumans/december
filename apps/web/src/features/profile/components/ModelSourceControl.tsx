import { useQuery } from '@tanstack/react-query'
import React from 'react'

import { profileAPI } from '@/features/profile/api/profile'
import { useByokList, useByokMutations } from '@/features/profile/hooks/useByokData'
import { cn } from '@/shared/lib/utils'

const SOURCES = [
    ['CREDITS', 'December credits'],
    ['OWN_KEY', 'Your keys'],
] as const

/**
 * The source a new prompt starts with: December credits or the user's own keys.
 * A real setting, saved to the account. The Your keys page shows it, and so does Defaults.
 */
export const ModelSourceControl: React.FC = () => {
    const { data } = useByokList(true)
    const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: profileAPI.getProfile })
    const { updateModelSource } = useByokMutations()

    const hasKeys = (data?.credentials ?? []).length > 0
    const defaultSource = profile?.defaultModelSource ?? 'CREDITS'

    return (
        <div
            className="flex items-center gap-1 bg-[#191919] p-0.5 rounded-lg border border-[#242323]"
            role="radiogroup"
            aria-label="Default model source"
        >
            {SOURCES.map(([value, label]) => (
                <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={defaultSource === value}
                    disabled={updateModelSource.isPending || (value === 'OWN_KEY' && !hasKeys)}
                    onClick={() => updateModelSource.mutate(value)}
                    className={cn(
                        'px-3 py-1.5 rounded-md text-[12px] font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-default',
                        defaultSource === value
                            ? 'bg-[#2B2A29] text-[#D6D5C9] shadow-sm'
                            : 'text-[#7B7A79] hover:text-[#D6D5C9]'
                    )}
                >
                    {label}
                </button>
            ))}
        </div>
    )
}
