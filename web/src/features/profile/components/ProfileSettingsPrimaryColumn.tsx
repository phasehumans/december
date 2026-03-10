import React from 'react'
import { Button } from '@/shared/components/ui/Button'
import { Switch } from '@/shared/components/ui/Switch'
import { SettingsSection } from './SettingsSection'
import { SettingsRow } from './SettingsRow'

interface ProfileSettingsPrimaryColumnProps {
    resolvedName: string
    hasProfile: boolean
    emailNotifications: boolean
    isNotificationPending: boolean
    onOpenNameModal: () => void
    onOpenPasswordModal: () => void
    onNotificationToggle: (value: boolean) => void
}

export const ProfileSettingsPrimaryColumn: React.FC<ProfileSettingsPrimaryColumnProps> = ({
    resolvedName,
    hasProfile,
    emailNotifications,
    isNotificationPending,
    onOpenNameModal,
    onOpenPasswordModal,
    onNotificationToggle,
}) => {
    return (
        <div className="space-y-8">
            <SettingsSection title="Profile">
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-neutral-400">Name</label>
                    <SettingsRow
                        label={resolvedName}
                        action={
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onOpenNameModal}
                                className="h-7 px-2.5 text-[10px]"
                                disabled={!hasProfile}
                            >
                                Change Name
                            </Button>
                        }
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-neutral-400">Password</label>
                    <SettingsRow
                        label="********"
                        action={
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onOpenPasswordModal}
                                className="h-7 px-2.5 text-[10px]"
                            >
                                Change Password
                            </Button>
                        }
                    />
                </div>
            </SettingsSection>

            <SettingsSection title="Notifications">
                <SettingsRow
                    label="Email Notifications"
                    description="Receive updates about activity"
                    action={
                        <Switch
                            checked={emailNotifications}
                            onCheckedChange={onNotificationToggle}
                            disabled={isNotificationPending}
                        />
                    }
                />
            </SettingsSection>
        </div>
    )
}
