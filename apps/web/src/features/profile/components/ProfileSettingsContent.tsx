import React from 'react'

import { AccountNotificationsSection } from './AccountNotificationsSection'
import { AccountPreferencesSection } from './AccountPreferencesSection'
import { AccountSections } from './AccountSections'
import { SettingsPageHeader, SettingsSectionHeading } from './SettingsPageHeader'
import { PAGE_SUBTITLES, sectionBoxClass } from './settingsStyles'

import type { Profile } from '../types'
import type { UpdateNotificationInput } from '@/features/profile/api/profile'

import { useIsPhone } from '@/shared/lib/useIsPhone'
import { cn } from '@/shared/lib/utils'

interface ProfileSettingsContentProps {
    profile?: Profile
    resolvedName: string
    onOpenNameModal: () => void
    onNotificationChange: (settings: UpdateNotificationInput) => void
    onSignOut: () => void
    onOpenSignOutAllSessionsModal: () => void
    onOpenDeleteAccountModal: () => void
}

const outlineButtonClass =
    'shrink-0 px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors cursor-pointer'

/** the letter avatar, the same one as the name row in the phone menu sheet (N21-A) */
const LetterAvatar: React.FC<{ name: string; className?: string }> = ({ name, className }) => (
    <span
        aria-hidden="true"
        className={cn(
            'rounded-full bg-[#2F3B4F] text-[#CFE0FF] font-semibold flex items-center justify-center shrink-0 select-none',
            className
        )}
    >
        {name.trim().charAt(0).toUpperCase() || 'A'}
    </span>
)

/** who is signed in: the letter avatar, the name and email, and Edit. on desktop and phones */
const ProfileSection: React.FC<{
    name: string
    email?: string | null
    onEdit: () => void
}> = ({ name, email, onEdit }) => (
    <div className="flex flex-col">
        <SettingsSectionHeading title="Profile" description="Your name and email." />
        <div className={cn(sectionBoxClass, 'flex-row items-center gap-3')}>
            <LetterAvatar name={name} className="w-9 h-9 text-[14px]" />
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-[14px] font-medium text-[#EDEDED] truncate">{name}</span>
                <span className="text-[13px] text-[#7B7A79] truncate">
                    {email || 'No email set'}
                </span>
            </div>
            <button
                type="button"
                onClick={onEdit}
                aria-label="Edit name"
                className={outlineButtonClass}
            >
                Edit
            </button>
        </div>
    </div>
)

/**
 * Account on phones (P1-A): who you are first, then rows.
 * Sign out stays here: it is the only sign out on phones.
 */
const PhoneAccountSettings: React.FC<ProfileSettingsContentProps> = (props) => {
    const {
        profile,
        resolvedName,
        onOpenNameModal,
        onNotificationChange,
        onSignOut,
        onOpenSignOutAllSessionsModal,
        onOpenDeleteAccountModal,
    } = props
    const name = profile?.name || resolvedName || 'Account'

    return (
        <div className="flex flex-col gap-5 w-full text-[#D6D5C9]">
            <div className="flex flex-col">
                <SettingsPageHeader title="Account" subtitle={PAGE_SUBTITLES.account} />
                <ProfileSection name={name} email={profile?.email} onEdit={onOpenNameModal} />
            </div>

            <AccountPreferencesSection />

            <AccountNotificationsSection onNotificationChange={onNotificationChange} />

            <AccountSections
                onSignOut={onSignOut}
                onOpenSignOutAllSessionsModal={onOpenSignOutAllSessionsModal}
                onOpenDeleteAccountModal={onOpenDeleteAccountModal}
            />
        </div>
    )
}

export const ProfileSettingsContent: React.FC<ProfileSettingsContentProps> = (props) => {
    const {
        profile,
        resolvedName,
        onOpenNameModal,
        onNotificationChange,
        onSignOut,
        onOpenSignOutAllSessionsModal,
        onOpenDeleteAccountModal,
    } = props

    // one layout at a time, so the page never holds two copies of every row
    const isPhone = useIsPhone()
    if (isPhone) return <PhoneAccountSettings {...props} />

    const name = profile?.name || resolvedName || 'Account'

    return (
        <div className="flex flex-col w-full max-w-[772px] text-[#D6D5C9]">
            {/* account: who is signed in */}
            <SettingsPageHeader title="Account" subtitle={PAGE_SUBTITLES.account} />
            <div className="mb-5">
                <ProfileSection name={name} email={profile?.email} onEdit={onOpenNameModal} />
            </div>

            <div className="mb-5">
                <AccountPreferencesSection />
            </div>

            <div className="mb-5">
                <AccountNotificationsSection onNotificationChange={onNotificationChange} />
            </div>

            <div className="flex flex-col gap-5">
                <AccountSections
                    onSignOut={onSignOut}
                    onOpenSignOutAllSessionsModal={onOpenSignOutAllSessionsModal}
                    onOpenDeleteAccountModal={onOpenDeleteAccountModal}
                />
            </div>
        </div>
    )
}
