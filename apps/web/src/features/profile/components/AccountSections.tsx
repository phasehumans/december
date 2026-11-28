import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React from 'react'

import { ProfileDeleteAccountModal } from './ProfileDeleteAccountModal'
import { SettingsRow, SettingsSection, outlineButtonClass } from './SettingsUi'

import { profileAPI } from '@/features/profile/api/profile'
import { sessionAPI } from '@/features/sessions/api/session'
import { formatRelativeTime } from '@/shared/lib/relativeTime'

const sessionsQueryKey = ['auth', 'sessions'] as const

const errorMessage = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback

interface AccountSectionsProps {
    onSignOut: () => void
    onOpenSignOutAllSessionsModal: () => void
    onOpenDeleteAccountModal: () => void
}

/**
 * The lower part of the Account page: devices (N6) and data (N9), on the server (#636).
 */
export const AccountSections: React.FC<AccountSectionsProps> = ({
    onSignOut,
    onOpenSignOutAllSessionsModal,
    onOpenDeleteAccountModal,
}) => {
    const queryClient = useQueryClient()

    const { data: sessions } = useQuery({
        queryKey: sessionsQueryKey,
        queryFn: profileAPI.listSignedInSessions,
    })
    const revoke = useMutation({
        mutationFn: profileAPI.revokeSignedInSession,
        onSettled: () => queryClient.invalidateQueries({ queryKey: sessionsQueryKey }),
    })
    // the device whose sign out failed shows the error under its name
    const failedRevokeId = revoke.isError ? revoke.variables : undefined

    const [confirmDeleteSessions, setConfirmDeleteSessions] = React.useState(false)
    const deleteSessions = useMutation({
        mutationFn: sessionAPI.deleteAllSessions,
        onSuccess: () => {
            setConfirmDeleteSessions(false)
            // the recent list, counts and pull requests all change
            void queryClient.invalidateQueries()
        },
    })

    return (
        <>
            <SettingsSection title="Devices" description="Where your account is signed in.">
                {(sessions ?? []).map((session) => (
                    <SettingsRow
                        key={session.id}
                        label={session.label}
                        hint={
                            session.id === failedRevokeId
                                ? errorMessage(revoke.error, 'Could not sign out this device')
                                : session.isCurrent
                                  ? 'This device'
                                  : `Active ${formatRelativeTime(session.lastActiveAt)}`
                        }
                    >
                        <button
                            type="button"
                            disabled={!session.isCurrent && revoke.isPending}
                            // this device signs out the normal way, so the app clears its state
                            onClick={() =>
                                session.isCurrent ? onSignOut() : revoke.mutate(session.id)
                            }
                            aria-label={`Sign out ${session.label}`}
                            className={`${outlineButtonClass} disabled:opacity-50 disabled:cursor-default`}
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

            <SettingsSection title="Data" description="Delete what December keeps.">
                <SettingsRow
                    label="Delete all sessions"
                    hint={
                        deleteSessions.isSuccess
                            ? `${deleteSessions.data.deleted} deleted`
                            : undefined
                    }
                >
                    <button
                        type="button"
                        onClick={() => {
                            deleteSessions.reset()
                            setConfirmDeleteSessions(true)
                        }}
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

            <ProfileDeleteAccountModal
                isOpen={confirmDeleteSessions}
                isPending={deleteSessions.isPending}
                title="Delete all sessions"
                description={
                    deleteSessions.error
                        ? errorMessage(deleteSessions.error, 'Could not delete the sessions')
                        : 'Every session and its sandbox is deleted. You cannot undo this.'
                }
                submitLabel="Delete all sessions"
                onConfirm={() => deleteSessions.mutate()}
                onClose={() => setConfirmDeleteSessions(false)}
            />
        </>
    )
}
