import { useQuery } from '@tanstack/react-query'
import React from 'react'

import { segmentClass, segmentGroupClass } from './settingsStyles'

import { profileAPI } from '@/features/profile/api/profile'
import { useByokList, useByokMutations } from '@/features/profile/hooks/useByokData'
import { cn } from '@/shared/lib/utils'

const SOURCES = [
    ['CREDITS', 'December credits'],
    ['OWN_KEY', 'Your keys'],
] as const

/**
 * The source a new prompt starts with: December credits or the user's own keys.
 * A real setting, saved to the account. The API keys page shows it, and so does Defaults.
 */
export const ModelSourceControl: React.FC = () => {
    const { data } = useByokList(true)
    const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: profileAPI.getProfile })
    const { updateModelSource } = useByokMutations()

    const hasKeys = (data?.credentials ?? []).length > 0
    const defaultSource = profile?.defaultModelSource ?? 'CREDITS'

    return (
        <div className={segmentGroupClass} role="radiogroup" aria-label="Default model source">
            {SOURCES.map(([value, label]) => (
                <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={defaultSource === value}
                    disabled={updateModelSource.isPending || (value === 'OWN_KEY' && !hasKeys)}
                    onClick={() => updateModelSource.mutate(value)}
                    className={cn(
                        segmentClass(defaultSource === value),
                        'disabled:opacity-40 disabled:cursor-default'
                    )}
                >
                    {label}
                </button>
            ))}
        </div>
    )
}
