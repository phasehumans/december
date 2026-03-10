import React from 'react'
import type { SettingsSectionProps } from '@/features/profile/types'

export const SettingsSection: React.FC<SettingsSectionProps> = ({ title, children }) => {
    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h2 className="text-lg font-medium text-textMain">{title}</h2>
            </div>
            <div className="space-y-4">{children}</div>
        </section>
    )
}
