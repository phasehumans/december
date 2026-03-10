import React from 'react'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { SettingsSection } from './SettingsSection'

export const ProfileSettingsSkeleton: React.FC = () => {
    return (
        <div className="grid min-h-[430px] grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
            <div className="space-y-8">
                <SettingsSection title="Profile">
                    <div className="space-y-4">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </SettingsSection>

                <SettingsSection title="Notifications">
                    <Skeleton className="h-12 w-full" />
                </SettingsSection>
            </div>

            <div className="space-y-8">
                <SettingsSection title="Integrations">
                    <Skeleton className="h-20 w-full" />
                </SettingsSection>

                <SettingsSection title="Billing & Usage">
                    <Skeleton className="h-16 w-full" />
                </SettingsSection>

                <Skeleton className="h-10 w-28" />
            </div>
        </div>
    )
}
