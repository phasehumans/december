import React from 'react'

import { SettingsSectionHeading } from './SettingsPageHeader'
import { sectionBoxClass } from './settingsStyles'
import { usePreviewOn, usePreviewValue } from './SettingsUi'

import { ChoiceGroup, Switch } from '@/features/connections/components/ConnectionsUi'
import { ShortcutRows } from '@/features/home/slash/shortcuts'
import { usePreferences, type SendKey } from '@/features/profile/lib/preferences'
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
 * The values stay in this browser. The shortcut list is the one that /keybindings opens
 * (N12-A).
 */
export const AccountPreferencesSection: React.FC = () => {
    const sendKey = usePreferences((s) => s.sendKey)
    const soundOnFinish = usePreferences((s) => s.soundOnFinish)
    const setPreference = usePreferences((s) => s.setPreference)
    const [shortcutsOpen, setShortcutsOpen] = React.useState(false)
    // ui only: the prompt box cannot take a message during a run yet (issue 637)
    const isPreview = usePreviewOn()
    const [whileWorking, setWhileWorking] = usePreviewValue<'queue' | 'send'>(
        'preferences.whileWorking',
        'queue'
    )

    return (
        <div className="flex flex-col text-[#D6D5C9]">
            <SettingsSectionHeading
                title="Preferences"
                description="How December behaves in this browser."
            />
            <div className={sectionBoxClass}>
                <div className={rowClass}>
                    <span className={labelClass}>Send with</span>
                    <ChoiceGroup
                        label="Send with"
                        options={SEND_KEY_OPTIONS}
                        value={sendKey}
                        onChange={(value) => setPreference('sendKey', value)}
                    />
                </div>
                {isPreview && (
                    <div className={`${rowClass} flex-wrap`}>
                        <span className={labelClass}>New messages while December works</span>
                        <ChoiceGroup
                            label="New messages while December works"
                            options={[
                                { value: 'queue', label: 'Queue' },
                                { value: 'send', label: 'Send now' },
                            ]}
                            value={whileWorking}
                            onChange={setWhileWorking}
                        />
                    </div>
                )}
                <div className={rowClass}>
                    <span className={labelClass}>Sound when a session finishes</span>
                    <Switch
                        label="Sound when a session finishes"
                        checked={soundOnFinish}
                        onChange={(value) => {
                            setPreference('soundOnFinish', value)
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
