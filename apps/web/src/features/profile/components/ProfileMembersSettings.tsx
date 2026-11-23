import React from 'react'

import { PAGE_SUBTITLES } from './settingsStyles'
import {
    SettingsPage,
    SettingsRow,
    SettingsSection,
    SettingsSelect,
    SettingsSoon,
    blueButtonClass,
    outlineButtonClass,
    usePreviewOn,
    usePreviewValue,
} from './SettingsUi'

import {
    FormError,
    ListBox,
    ListRows,
    ModalActions,
    SoonPill,
    fieldLabelClass,
    inputClass,
} from '@/features/connections/components/ConnectionsUi'
import { Modal } from '@/shared/components/ui/Modal'

type Role = 'Owner' | 'Admin' | 'Member'

interface MemberRow {
    id: string
    name: string
    email: string
    note: string
    role: Role
}

const ROLES = ['Admin', 'Member'] as const

// sample rows for the ui-only page. the real list comes with team accounts (issue 640)
const sampleMembers = (ownerName: string, ownerEmail: string): MemberRow[] => [
    { id: 'm1', name: ownerName, email: ownerEmail, note: 'You', role: 'Owner' },
    {
        id: 'm2',
        name: 'Arjun Mehta',
        email: 'arjun@example.com',
        note: 'Joined Nov 18',
        role: 'Admin',
    },
    { id: 'm3', name: '', email: 'meera@example.com', note: 'Invited', role: 'Member' },
]

/**
 * Members (N19): the people of a team and their roles. Ui only: an account is one person
 * until team accounts exist (issue 640).
 */
export const ProfileMembersSettings: React.FC<{ ownerName: string; ownerEmail: string }> = ({
    ownerName,
    ownerEmail,
}) => {
    const isPreview = usePreviewOn()
    const [members, setMembers] = usePreviewValue<MemberRow[] | null>('members.list', null)
    const rows = members ?? sampleMembers(ownerName || 'You', ownerEmail)

    const [query, setQuery] = React.useState('')
    const [inviteOpen, setInviteOpen] = React.useState(false)
    const [email, setEmail] = React.useState('')
    const [role, setRole] = React.useState<(typeof ROLES)[number]>('Member')
    const [formError, setFormError] = React.useState<string | null>(null)

    if (!isPreview) {
        return (
            <SettingsSoon
                title="Members"
                subtitle={PAGE_SUBTITLES.members}
                text="Team accounts are coming soon"
            />
        )
    }

    const q = query.trim().toLowerCase()
    const visible = q
        ? rows.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
        : rows

    const invite = (event: React.FormEvent) => {
        event.preventDefault()
        // the modal is portaled, so stop the submit reaching a form behind it
        event.stopPropagation()
        const address = email.trim().toLowerCase()
        if (!/^\S+@\S+\.\S+$/.test(address)) {
            setFormError('Enter an email address.')
            return
        }
        if (rows.some((m) => m.email === address)) {
            setFormError('This person is in the team already.')
            return
        }
        setMembers([
            ...rows,
            { id: `m${Date.now()}`, name: '', email: address, note: 'Invited', role },
        ])
        setInviteOpen(false)
    }

    return (
        <SettingsPage title="Members" subtitle={PAGE_SUBTITLES.members}>
            <SettingsSection bare>
                <div className="flex items-center justify-between gap-3">
                    <input
                        type="text"
                        aria-label="Search members"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search members"
                        className="flex-1 min-w-0 max-w-[280px] px-3 py-1.5 bg-[#202020] border border-[#282828] rounded-lg text-[13px] text-[#D6D5C9] placeholder-[#7B7A79] focus:outline-none"
                    />
                    <button
                        type="button"
                        onClick={() => {
                            setEmail('')
                            setRole('Member')
                            setFormError(null)
                            setInviteOpen(true)
                        }}
                        className={blueButtonClass}
                    >
                        Invite
                    </button>
                </div>
                <ListBox>
                    {visible.length === 0 ? (
                        <div className="px-4 py-6 text-[13px] text-[#7B7A79]">No members match</div>
                    ) : (
                        <ListRows>
                            {visible.map((member) => (
                                <div
                                    key={member.id}
                                    className="flex items-center gap-3 px-3.5 md:px-4 py-3 text-[13px]"
                                >
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-[#D6D5C9] font-medium truncate">
                                            {member.name || member.email}
                                        </span>
                                        <span className="text-[12px] text-[#7B7A79] truncate">
                                            {member.name
                                                ? `${member.email} · ${member.note}`
                                                : member.note}
                                        </span>
                                    </div>
                                    {member.role === 'Owner' ? (
                                        <span className="text-[13px] text-[#7B7A79]">Owner</span>
                                    ) : (
                                        <>
                                            <SettingsSelect
                                                label={`Role of ${member.name || member.email}`}
                                                value={member.role}
                                                options={ROLES}
                                                onChange={(next) =>
                                                    setMembers(
                                                        rows.map((m) =>
                                                            m.id === member.id
                                                                ? { ...m, role: next }
                                                                : m
                                                        )
                                                    )
                                                }
                                                className="w-[110px]"
                                            />
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setMembers(
                                                        rows.filter((m) => m.id !== member.id)
                                                    )
                                                }
                                                aria-label={`Remove ${member.name || member.email}`}
                                                className={outlineButtonClass}
                                            >
                                                Remove
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))}
                        </ListRows>
                    )}
                </ListBox>
            </SettingsSection>

            <SettingsSection title="Security" description="Sign-in rules and a record of changes.">
                <SettingsRow label="Single sign-on">
                    <SoonPill />
                </SettingsRow>
                <SettingsRow label="Audit log">
                    <SoonPill />
                </SettingsRow>
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
                <form onSubmit={invite} className="flex flex-col gap-4">
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
                            options={ROLES}
                            onChange={setRole}
                            className="w-full"
                        />
                    </div>
                    <FormError>{formError}</FormError>
                    <ModalActions
                        onCancel={() => setInviteOpen(false)}
                        submitLabel="Send invite"
                        submitDisabled={!email.trim()}
                    />
                </form>
            </Modal>
        </SettingsPage>
    )
}
