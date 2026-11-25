import { useQueryClient } from '@tanstack/react-query'
import React from 'react'

import { SettingsSectionHeading } from './SettingsPageHeader'
import { sectionBoxClass } from './settingsStyles'

import { ChoiceGroup, Switch } from '@/features/connections/components/ConnectionsUi'
import { ShortcutRows } from '@/features/home/slash/shortcuts'
import { profileAPI, type Profile } from '@/features/profile/api/profile'
import { usePreferences, type Preferences, type SendKey } from '@/features/profile/lib/preferences'
import { Modal } from '@/shared/components/ui/Modal'
import { playFinishSound } from '@/shared/lib/finishSound'

const rowClass = 'flex items-center justify-between gap-3 min-h-8'
const labelClass = 'text-[14px] text-[#D6D5C9]'

const SEND_KEY_OPTIONS: { value: SendKey; label: string }[] = [
    { value: 'enter', label: 'Enter' },
    { value: 'mod-enter', label: 'Ctrl + Enter' },
]

/**
 * Preferences, a section of the Account page (N10-B): how the app behaves for this person.
 * Each change is saved in this browser and on the account (#636), so every device gets it.
 * The shortcut list is the one that /keybindings opens (N12-A).
 */
export const AccountPreferencesSection: React.FC = () => {
    const sendKey = usePreferences((s) => s.sendKey)
    const soundOnFinish = usePreferences((s) => s.soundOnFinish)
    const whileWorking = usePreferences((s) => s.messageWhileWorking)
    const setPreference = usePreferences((s) => s.setPreference)
    const queryClient = useQueryClient()
    const [shortcutsOpen, setShortcutsOpen] = React.useState(false)

    const savePreference = React.useCallback(
        <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
            setPreference(key, value)
            profileAPI
                .updatePreferences({ [key]: value })
                // the answer has every saved value, so the profile needs no new fetch
                .then(({ preferences }) =>
                    queryClient.setQueryData<Profile>(['profile'], (old) =>
                        old ? { ...old, preferences } : old
                    )
                )
                .catch((error: unknown) => {
                    // the value stays in this browser; the account keeps the old one
                    console.error('[preferences] could not save to the account', error)
                })
        },
        [setPreference, queryClient]
    )

    return (
        <div className="flex flex-col text-[#D6D5C9]">
            <SettingsSectionHeading
                title="Preferences"
                description="How December behaves for you."
            />
            <div className={sectionBoxClass}>
                <div className={rowClass}>
                    <span className={labelClass}>Send with</span>
                    <ChoiceGroup
                        label="Send with"
                        options={SEND_KEY_OPTIONS}
                        value={sendKey}
                        onChange={(value) => savePreference('sendKey', value)}
                    />
                </div>
                <div className={`${rowClass} flex-wrap`}>
                    <span className={labelClass}>New messages while December works</span>
                    <ChoiceGroup
                        label="New messages while December works"
                        options={[
                            { value: 'queue', label: 'Queue' },
                            { value: 'send', label: 'Send now' },
                        ]}
                        value={whileWorking}
                        onChange={(value) => savePreference('messageWhileWorking', value)}
                    />
                </div>
                <div className={rowClass}>
                    <span className={labelClass}>Sound when a session finishes</span>
                    <Switch
                        label="Sound when a session finishes"
                        checked={soundOnFinish}
                        onChange={(value) => {
                            savePreference('soundOnFinish', value)
                            // play it once, so the person hears what they turned on
                            if (value) playFinishSound()
                        }}
                    />
                </div>
                <div className={rowClass}>
                    <span className={labelClass}>Keyboard shortcuts</span>
                    <button
                        type="button"
                        onClick={() => setShortcutsOpen(true)}
                        className="shrink-0 px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors cursor-pointer"
                    >
                        View
                    </button>
                </div>
            </div>

            <Modal
                isOpen={shortcutsOpen}
                onClose={() => setShortcutsOpen(false)}
                title="Keyboard shortcuts"
                variant="premium"
                showLogo={false}
                sheetOnPhone
            >
                <div className="flex flex-col">
                    <ShortcutRows />
                </div>
            </Modal>
        </div>
    )
}
