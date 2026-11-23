import { ChevronRight } from 'lucide-react'
import React from 'react'

import { AccountPreferencesSection } from './AccountPreferencesSection'
import { AccountPreviewSections } from './AccountPreviewSections'
import { SettingsPageHeader, SettingsSectionHeading } from './SettingsPageHeader'
import { PAGE_SUBTITLES, sectionBoxClass } from './settingsStyles'
import { usePreviewOn } from './SettingsUi'

import type { Profile } from '../types'

import { Switch } from '@/features/connections/components/ConnectionsUi'
import { useIsPhone } from '@/shared/lib/useIsPhone'
import { cn } from '@/shared/lib/utils'

interface ProfileSettingsContentProps {
    profile?: Profile
    resolvedName: string
    productUpdates: boolean
    securityAlerts: boolean
    onOpenNameModal: () => void
    onNotificationToggle: (
        field: 'notifyProjectActivity' | 'notifyProductUpdates' | 'notifySecurityAlerts',
        value: boolean
    ) => void
    onSignOut: () => void
    onOpenSignOutAllSessionsModal: () => void
    onOpenDeleteAccountModal: () => void
}

const outlineButtonClass =
    'shrink-0 px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors cursor-pointer'
const phoneRowClass =
    'flex items-center justify-between gap-3 min-h-11 py-1.5 -mx-1 px-1 rounded-lg text-left text-[14px] text-[#D6D5C9]'
// phone rows are 44px tall, so the box needs less padding than on desktop
const phoneBoxClass = 'flex flex-col bg-[#1F1F1F] border border-[#2A2A2A] rounded-xl px-4 py-1'
const phoneButtonRowClass = `${phoneRowClass} w-full active:bg-[#1F1F1F] transition-colors outline-none cursor-pointer`

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
        productUpdates,
        securityAlerts,
        onOpenNameModal,
        onNotificationToggle,
        onSignOut,
        onOpenSignOutAllSessionsModal,
        onOpenDeleteAccountModal,
    } = props
    // with the preview on, notifications have their own page and devices replace sign in
    const isPreview = usePreviewOn()
    const name = profile?.name || resolvedName || 'Account'
    const chevron = <ChevronRight className="w-4 h-4 text-[#7B7A79] shrink-0" strokeWidth={1.75} />

    return (
        <div className="flex flex-col gap-5 w-full text-[#D6D5C9]">
            <div className="flex flex-col">
                <SettingsPageHeader title="Account" subtitle={PAGE_SUBTITLES.account} />
                <ProfileSection name={name} email={profile?.email} onEdit={onOpenNameModal} />
            </div>

            <AccountPreferencesSection />

            {isPreview ? (
                <AccountPreviewSections
                    onSignOut={onSignOut}
                    onOpenSignOutAllSessionsModal={onOpenSignOutAllSessionsModal}
                    onOpenDeleteAccountModal={onOpenDeleteAccountModal}
                />
            ) : (
                <>
                    <div className="flex flex-col">
                        <SettingsSectionHeading
                            title="Notifications"
                            description="Emails December sends you."
                        />
                        <div className={phoneBoxClass}>
                            <div className={phoneRowClass}>
                                <span>Product updates</span>
                                <Switch
                                    label="Product updates"
                                    checked={productUpdates}
                                    onChange={(value) =>
                                        onNotificationToggle('notifyProductUpdates', value)
                                    }
                                />
                            </div>
                            <div className={phoneRowClass}>
                                <span>Security alerts</span>
                                <Switch
                                    label="Security alerts"
                                    checked={securityAlerts}
                                    onChange={(value) =>
                                        onNotificationToggle('notifySecurityAlerts', value)
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <SettingsSectionHeading
                            title="Sign in"
                            description="Sign out here or on every device."
                        />
                        <div className={phoneBoxClass}>
                            <button
                                type="button"
                                onClick={onSignOut}
                                className={phoneButtonRowClass}
                            >
                                Sign out
                            </button>
                            <button
                                type="button"
                                onClick={onOpenSignOutAllSessionsModal}
                                className={phoneButtonRowClass}
                            >
                                Sign out everywhere
                                {chevron}
                            </button>
                            <button
                                type="button"
                                onClick={onOpenDeleteAccountModal}
                                className={`${phoneButtonRowClass} text-[#E57373]`}
                            >
                                Delete account
                                {chevron}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

export const ProfileSettingsContent: React.FC<ProfileSettingsContentProps> = (props) => {
    const {
        profile,
        resolvedName,
        productUpdates,
        securityAlerts,
        onOpenNameModal,
        onNotificationToggle,
        onSignOut,
        onOpenSignOutAllSessionsModal,
        onOpenDeleteAccountModal,
    } = props

    // one layout at a time, so the page never holds two copies of every row
    const isPhone = useIsPhone()
    const isPreview = usePreviewOn()
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

            {isPreview ? (
                <div className="flex flex-col gap-5">
                    <AccountPreviewSections
                        onSignOut={onSignOut}
                        onOpenSignOutAllSessionsModal={onOpenSignOutAllSessionsModal}
                        onOpenDeleteAccountModal={onOpenDeleteAccountModal}
                    />
                </div>
            ) : (
                <>
                    {/* notifications */}
                    <div className="flex flex-col mb-5">
                        <SettingsSectionHeading
                            title="Notifications"
                            description="Emails December sends you."
                        />
                        <div className={sectionBoxClass}>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[14px] text-[#D6D5C9]">Product updates</span>
                                <Switch
                                    label="Product updates"
                                    checked={productUpdates}
                                    onChange={(value) =>
                                        onNotificationToggle('notifyProductUpdates', value)
                                    }
                                />
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[14px] text-[#D6D5C9]">Security alerts</span>
                                <Switch
                                    label="Security alerts"
                                    checked={securityAlerts}
                                    onChange={(value) =>
                                        onNotificationToggle('notifySecurityAlerts', value)
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    {/* sign in: each button says its action, the label says what it acts on */}
                    <div className="flex flex-col mb-0">
                        <SettingsSectionHeading
                            title="Sign in"
                            description="Sign out here or on every device."
                        />
                        <div className={sectionBoxClass}>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[14px] text-[#D6D5C9]">This browser</span>
                                <button
                                    type="button"
                                    onClick={onSignOut}
                                    className={outlineButtonClass}
                                >
                                    Sign out
                                </button>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[14px] text-[#D6D5C9]">All devices</span>
                                <button
                                    type="button"
                                    onClick={onOpenSignOutAllSessionsModal}
                                    className={outlineButtonClass}
                                >
                                    Sign out everywhere
                                </button>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[14px] text-[#D6D5C9]">Delete account</span>
                                <button
                                    type="button"
                                    onClick={onOpenDeleteAccountModal}
                                    className={outlineButtonClass}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
