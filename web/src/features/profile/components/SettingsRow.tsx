import React from 'react'

import type { SettingsRowProps } from '@/features/profile/types'

import { cn } from '@/shared/lib/utils'

export const SettingsRow: React.FC<SettingsRowProps> = ({
    label,
    description,
    action,
    className,
}) => {
    return (
        <div
            className={cn(
                'flex items-center justify-between p-3 rounded-xl bg-surface/30 border border-white/5',
                className
            )}
        >
            <div>
                <div className="text-textMain text-sm font-medium mb-0.5">{label}</div>
                {description && <div className="text-[11px] text-neutral-500">{description}</div>}
            </div>
            <div>{action}</div>
        </div>
    )
}
