import { useQuery, useQueryClient } from '@tanstack/react-query'
import React from 'react'

import {
    PAGE_SUBTITLES,
    listEmptyClass,
    listRowClass,
    listRowNoteClass,
    listRowTitleClass,
} from './settingsStyles'
import {
    SettingsPage,
    SettingsRow,
    SettingsSection,
    SettingsSelect,
    blueButtonClass,
    outlineButtonClass,
} from './SettingsUi'

import {
    ConfirmModal,
    FormError,
    ListBox,
    ListRows,
    ModalActions,
    SearchInput,
    SoonPill,
    fieldLabelClass,
    formatShortDate,
    inputClass,
    matchesQuery,
} from '@/features/connections/components/ConnectionsUi'
import {
    teamAPI,
    type AuditEvent,
    TEAM_QUERY_KEY,
    type InviteRole,
    type JoinedTeam,
    type TeamMember,
    type TeamRole,
} from '@/features/profile/api/team'
import { Modal } from '@/shared/components/ui/Modal'
import { apiErrorMessage } from '@/shared/lib/apiErrorMessage'

const AUDIT_QUERY_KEY = ['team', 'audit'] as const

const ROLE_OPTIONS: { value: InviteRole; label: string }[] = [
    { value: 'ADMIN', label: 'Admin' },
    { value: 'MEMBER', label: 'Member' },
]

const ROLE_NAMES: Record<string, string> = { OWNER: 'Owner', ADMIN: 'Admin', MEMBER: 'Member' }
const roleName = (role: string) => ROLE_NAMES[role] ?? role

const AUDIT_LABELS: Record<string, string> = {
    'member.invited': 'Invited',
    'member.invite_revoked': 'Invite revoked',
    'member.joined': 'Joined',
    'member.role_changed': 'Role changed',
    'member.removed': 'Removed',
    'member.left': 'Left',
    'auth.sign_in': 'Signed in',
    'secret.created': 'Secret saved',
    'secret.deleted': 'Secret deleted',
    'key.created': 'API key saved',
    'key.deleted': 'API key deleted',
    'billing.top_up': 'Credits added',
}

/** who or what the action was done to, and the role or the role change */
const auditDetail = (event: AuditEvent) => {
    const meta = event.metadata ?? {}
    const change =
        typeof meta.from === 'string' && typeof meta.to === 'string'
            ? `${roleName(meta.from)} to ${roleName(meta.to)}`
            : typeof meta.role === 'string'
              ? roleName(meta.role)
              : ''
    return [event.target, change].filter(Boolean).join(' · ')
}

const formatDateTime = (iso: string) => {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    })
}

const AuditLogModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const [page, setPage] = React.useState(1)
    const { data, isLoading, isError } = useQuery({
        queryKey: [...AUDIT_QUERY_KEY, page],
        queryFn: () => teamAPI.getAudit(page),
        enabled: isOpen,
    })
    const events = data?.events ?? []
    const totalPages = data?.pagination.totalPages ?? 1

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Audit log"
            maxWidth="max-w-[640px]"
            variant="premium"
            showLogo={false}
            sheetOnPhone
        >
            <div className="flex flex-col gap-3">
                <ListBox className="max-h-[52vh] overflow-y-auto">
                    {isLoading ? (
                        <div className={listEmptyClass}>Loading</div>
                    ) : isError ? (
                        <div className={listEmptyClass}>The audit log did not load</div>
                    ) : events.length === 0 ? (
                        <div className={listEmptyClass}>Nothing here yet</div>
                    ) : (
                        <ListRows>
                            {events.map((event) => (
                                <div key={event.id} className={listRowClass}>
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className={listRowTitleClass}>
                                            {AUDIT_LABELS[event.action] ?? event.action}
                                        </span>
                                        <span className={listRowNoteClass}>
                                            {auditDetail(event)}
                                        </span>
                                    </div>
                                    <span className="text-[12px] text-[#7B7A79] text-right shrink-0 max-w-[50%] truncate">
                                        {`${event.actor?.name || event.actor?.email || 'Deleted account'} · ${formatDateTime(event.createdAt)}`}
                                    </span>
                                </div>
                            ))}
                        </ListRows>
                    )}
                </ListBox>
                <div className="flex items-center justify-between gap-2.5 flex-wrap">
                    <a href={teamAPI.auditExportUrl()} className={outlineButtonClass}>
                        Export CSV
                    </a>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => p - 1)}
                                className={`${outlineButtonClass} disabled:opacity-40 disabled:cursor-default`}
                            >
                                Newer
                            </button>
                            <button
                                type="button"
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => p + 1)}
                                className={`${outlineButtonClass} disabled:opacity-40 disabled:cursor-default`}
                            >
                                Older
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    )
}

/**
 * Members (N19, issue 640): the people of the user's own team, their roles and the open
 * invites. Members share nothing yet: sessions, secrets, keys and credits stay with each
 * person. Single sign-on is not built.
 */
export const ProfileMembersSettings: React.FC<{ ownerName: string; ownerEmail: string }> = ({
    ownerEmail,
}) => {
    const queryClient = useQueryClient()
    const {
        data: team,
        isLoading,
        isError,
    } = useQuery({ queryKey: TEAM_QUERY_KEY, queryFn: teamAPI.getTeam })

    const [query, setQuery] = React.useState('')
    const [inviteOpen, setInviteOpen] = React.useState(false)
    const [email, setEmail] = React.useState('')
    const [role, setRole] = React.useState<InviteRole>('MEMBER')
    const [formError, setFormError] = React.useState<string | null>(null)
    const [isInviting, setIsInviting] = React.useState(false)
    const [pageError, setPageError] = React.useState<string | null>(null)
    const [removing, setRemoving] = React.useState<TeamMember | null>(null)
    const [leaving, setLeaving] = React.useState<JoinedTeam | null>(null)
    const [auditOpen, setAuditOpen] = React.useState(false)

    const members = team?.members ?? []
    const invites = team?.invites ?? []
    const memberOf = team?.memberOf ?? []
    const myRole: TeamRole = team?.role ?? 'MEMBER'
    const canManage = myRole === 'OWNER' || myRole === 'ADMIN'
    const isOwner = myRole === 'OWNER'
    // the page shows the user's own team, so the user is its owner. the email is the first
    // check, for the day the page can show another team
    const me =
        members.find((m) => m.email.toLowerCase() === ownerEmail.toLowerCase()) ??
        (isOwner ? members.find((m) => m.role === 'OWNER') : undefined)

    const visibleMembers = members.filter((m) => matchesQuery(query, m.name, m.email))
    const visibleInvites = invites.filter((i) => matchesQuery(query, i.email))

    /** runs one change, then reads the team again. a failure shows under the list */
    const change = async (action: () => Promise<unknown>, fallback: string) => {
        setPageError(null)
        try {
            await action()
        } catch (error) {
            setPageError(apiErrorMessage(error, fallback))
        }
        await queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY })
    }

    const invite = async (event: React.FormEvent) => {
        event.preventDefault()
        // the modal is portaled, so stop the submit reaching a form behind it
        event.stopPropagation()
        const address = email.trim().toLowerCase()
        if (!/^\S+@\S+\.\S+$/.test(address)) {
            setFormError('Enter an email address.')
            return
        }
        setIsInviting(true)
        try {
            await teamAPI.invite({ email: address, role })
            setInviteOpen(false)
            await queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY })
        } catch (error) {
            setFormError(apiErrorMessage(error, 'The invite was not sent. Try again.'))
        } finally {
            setIsInviting(false)
        }
    }

    const memberNote = (member: TeamMember) =>
        member.userId === me?.userId ? 'You' : `Joined ${formatShortDate(member.joinedAt)}`

    return (
        <SettingsPage title="Members" subtitle={PAGE_SUBTITLES.members}>
            <SettingsSection bare>
                <div className="flex items-center justify-between gap-3">
                    <SearchInput value={query} onChange={setQuery} placeholder="Search members" />
                    {canManage && (
                        <button
                            type="button"
                            onClick={() => {
                                setEmail('')
                                setRole('MEMBER')
                                setFormError(null)
                                setInviteOpen(true)
                            }}
                            className={blueButtonClass}
                        >
                            Invite
                        </button>
                    )}
                </div>
                <ListBox>
                    {isLoading ? (
                        <div className={listEmptyClass}>Loading</div>
                    ) : isError || !team ? (
                        <div className={listEmptyClass}>The team did not load</div>
                    ) : visibleMembers.length + visibleInvites.length === 0 ? (
                        <div className={listEmptyClass}>No members match</div>
                    ) : (
                        <ListRows>
                            {visibleMembers.map((member) => {
                                const label = member.name || member.email
                                return (
                                    <div key={member.userId} className={listRowClass}>
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <span className={listRowTitleClass}>{label}</span>
                                            <span className={listRowNoteClass}>
                                                {member.name
                                                    ? `${member.email} · ${memberNote(member)}`
                                                    : memberNote(member)}
                                            </span>
                                        </div>
                                        {member.role === 'OWNER' || !isOwner ? (
                                            <span className="text-[13px] text-[#7B7A79]">
                                                {roleName(member.role)}
                                            </span>
                                        ) : (
                                            <SettingsSelect
                                                label={`Role of ${label}`}
                                                value={member.role as InviteRole}
                                                options={ROLE_OPTIONS}
                                                onChange={(next) =>
                                                    void change(
                                                        () =>
                                                            teamAPI.changeRole(member.userId, next),
                                                        'The role did not change. Try again.'
                                                    )
                                                }
                                                className="w-[110px]"
                                            />
                                        )}
                                        {member.role !== 'OWNER' &&
                                            member.userId !== me?.userId &&
                                            (isOwner ||
                                                (canManage && member.role === 'MEMBER')) && (
                                                <button
                                                    type="button"
                                                    onClick={() => setRemoving(member)}
                                                    aria-label={`Remove ${label}`}
                                                    className={outlineButtonClass}
                                                >
                                                    Remove
                                                </button>
                                            )}
                                    </div>
                                )
                            })}
                            {visibleInvites.map((item) => (
                                <div key={item.id} className={listRowClass}>
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className={listRowTitleClass}>{item.email}</span>
                                        <span className={listRowNoteClass}>
                                            {`Invited · ${roleName(item.role)}`}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void change(
                                                () => teamAPI.revokeInvite(item.id),
                                                'The invite was not revoked. Try again.'
                                            )
                                        }
                                        aria-label={`Revoke the invite of ${item.email}`}
                                        className={outlineButtonClass}
                                    >
                                        Revoke
                                    </button>
                                </div>
                            ))}
                        </ListRows>
                    )}
                </ListBox>
                <FormError>{pageError}</FormError>
            </SettingsSection>

            {memberOf.length > 0 && (
                <SettingsSection
                    title="Teams you are in"
                    description="Teams of other people that you joined."
                    bare
                >
                    <ListBox>
                        <ListRows>
                            {memberOf.map((joined) => (
                                <div key={joined.teamId} className={listRowClass}>
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className={listRowTitleClass}>{joined.name}</span>
                                        <span className={listRowNoteClass}>
                                            {`Owner ${joined.ownerName} · ${roleName(joined.role)}`}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setLeaving(joined)}
                                        aria-label={`Leave ${joined.name}`}
                                        className={outlineButtonClass}
                                    >
                                        Leave
                                    </button>
                                </div>
                            ))}
                        </ListRows>
                    </ListBox>
                </SettingsSection>
            )}

            <SettingsSection title="Security" description="Sign-in rules and a record of changes.">
                <SettingsRow label="Single sign-on">
                    {/* no sample control here, so there is nothing for a Demo pill to mark */}
                    <SoonPill />
                </SettingsRow>
                {canManage && (
                    <SettingsRow label="Audit log">
                        <button
                            type="button"
                            onClick={() => setAuditOpen(true)}
                            aria-label="View the audit log"
                            className={outlineButtonClass}
                        >
                            View
                        </button>
                    </SettingsRow>
                )}
            </SettingsSection>

            <Modal
                isOpen={inviteOpen}
                onClose={() => setInviteOpen(false)}
                title="Invite a member"
                description="They get an email with a link to join."
                variant="premium"
                showLogo={false}
                sheetOnPhone
            >
                <form onSubmit={(e) => void invite(e)} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="member-email-input" className={fieldLabelClass}>
                            Email
                        </label>
                        <input
                            id="member-email-input"
                            type="email"
                            autoFocus
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value)
                                setFormError(null)
                            }}
                            placeholder="name@company.com"
                            className={inputClass}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className={fieldLabelClass}>Role</span>
                        <SettingsSelect
                            label="Role"
                            value={role}
                            // only the owner sets who is an admin
                            options={isOwner ? ROLE_OPTIONS : ROLE_OPTIONS.slice(1)}
                            onChange={setRole}
                            className="w-full"
                        />
                    </div>
                    <FormError>{formError}</FormError>
                    <ModalActions
                        onCancel={() => setInviteOpen(false)}
                        submitLabel="Send invite"
                        submitDisabled={!email.trim()}
                        isPending={isInviting}
                    />
                </form>
            </Modal>

            <ConfirmModal
                isOpen={removing !== null}
                title={`Remove ${removing?.name || removing?.email || ''}?`}
                confirmLabel="Remove"
                onClose={() => setRemoving(null)}
                onConfirm={() => {
                    const member = removing
                    setRemoving(null)
                    if (!member) return
                    void change(
                        () => teamAPI.removeMember(member.userId),
                        'The member was not removed. Try again.'
                    )
                }}
            />

            <ConfirmModal
                isOpen={leaving !== null}
                title={`Leave ${leaving?.name ?? ''}?`}
                confirmLabel="Leave"
                onClose={() => setLeaving(null)}
                onConfirm={() => {
                    const joined = leaving
                    setLeaving(null)
                    if (!joined || !me) return
                    void change(
                        () => teamAPI.removeMember(me.userId, joined.teamId),
                        'You did not leave the team. Try again.'
                    )
                }}
            />

            <AuditLogModal isOpen={auditOpen} onClose={() => setAuditOpen(false)} />
        </SettingsPage>
    )
}
