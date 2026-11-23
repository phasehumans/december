import React from 'react'

import { SettingsRow, SettingsSection, outlineButtonClass, usePreviewValue } from './SettingsUi'

import { ConfirmModal, Switch } from '@/features/connections/components/ConnectionsUi'

interface DeviceRow {
    id: string
    label: string
    note: string
}

// sample rows for the ui-only list. the real list comes with the devices api (issue 636)
const SAMPLE_DEVICES: DeviceRow[] = [
    { id: 'd2', label: 'Safari on iPhone', note: 'Active 2 days ago' },
    { id: 'd3', label: 'December CLI on Linux', note: 'Active 5 hours ago' },
]

/** the browser and system of this device, for example "Chrome on Windows" */
const describeThisBrowser = (): string => {
    if (typeof navigator === 'undefined') return 'This browser'
    const ua = navigator.userAgent
    const browser = /Edg\//.test(ua)
        ? 'Edge'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Chrome\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'Browser'
    const system = /iPhone|iPad/.test(ua)
        ? 'iPhone'
        : /Android/.test(ua)
          ? 'Android'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Mac OS X/.test(ua)
              ? 'macOS'
              : /Linux/.test(ua)
                ? 'Linux'
                : ''
    return system ? `${browser} on ${system}` : browser
}

interface AccountPreviewSectionsProps {
    onSignOut: () => void
    onOpenSignOutAllSessionsModal: () => void
    onOpenDeleteAccountModal: () => void
}

/**
 * Account with the preview on: devices (N6), data (N9) and support access (N16).
 * Sign out, sign out everywhere and delete account are the real actions. The device list,
 * export, delete all sessions and support access are ui only (issue 636).
 */
export const AccountPreviewSections: React.FC<AccountPreviewSectionsProps> = ({
    onSignOut,
    onOpenSignOutAllSessionsModal,
    onOpenDeleteAccountModal,
}) => {
    const [devices, setDevices] = usePreviewValue('account.devices', SAMPLE_DEVICES)
    const [exportRequested, setExportRequested] = usePreviewValue('account.export', false)
    const [supportAccess, setSupportAccess] = usePreviewValue('account.support', false)
    const [confirmDeleteSessions, setConfirmDeleteSessions] = React.useState(false)

    return (
        <>
            <SettingsSection title="Devices" description="Where your account is signed in.">
                <SettingsRow label={describeThisBrowser()} hint="This device">
                    <button type="button" onClick={onSignOut} className={outlineButtonClass}>
                        Sign out
                    </button>
                </SettingsRow>
                {devices.map((device) => (
                    <SettingsRow key={device.id} label={device.label} hint={device.note}>
                        <button
                            type="button"
                            onClick={() => setDevices(devices.filter((d) => d.id !== device.id))}
                            aria-label={`Sign out ${device.label}`}
                            className={outlineButtonClass}
                        >
                            Sign out
                        </button>
                    </SettingsRow>
                ))}
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={onOpenSignOutAllSessionsModal}
                        className={outlineButtonClass}
                    >
                        Sign out everywhere
                    </button>
                </div>
            </SettingsSection>

            <SettingsSection title="Data" description="Export or delete what December keeps.">
                <SettingsRow label="Export my data">
                    <button
                        type="button"
                        disabled={exportRequested}
                        onClick={() => setExportRequested(true)}
                        className={`${outlineButtonClass} disabled:opacity-50 disabled:cursor-default`}
                    >
                        {exportRequested ? 'Requested' : 'Export'}
                    </button>
                </SettingsRow>
                <SettingsRow label="Delete all sessions">
                    <button
                        type="button"
                        onClick={() => setConfirmDeleteSessions(true)}
                        className={outlineButtonClass}
                    >
                        Delete
                    </button>
                </SettingsRow>
                <SettingsRow label="Delete account">
                    <button
                        type="button"
                        onClick={onOpenDeleteAccountModal}
                        aria-label="Delete account"
                        className={outlineButtonClass}
                    >
                        Delete
                    </button>
                </SettingsRow>
            </SettingsSection>

            <SettingsSection title="Support" description="Let the December team look at a problem.">
                <SettingsRow
                    label="Let December support open my sessions"
                    hint="Turns off after 7 days"
                >
                    <Switch
                        label="Let December support open my sessions"
                        checked={supportAccess}
                        onChange={setSupportAccess}
                    />
                </SettingsRow>
            </SettingsSection>

            {/* ui only: nothing is deleted until the server part exists */}
            <ConfirmModal
                isOpen={confirmDeleteSessions}
                title="Delete all sessions"
                body="Every session and its sandbox is deleted. You cannot undo this."
                confirmLabel="Delete all sessions"
                onConfirm={() => setConfirmDeleteSessions(false)}
                onClose={() => setConfirmDeleteSessions(false)}
            />
        </>
    )
}
