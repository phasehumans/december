import React from 'react'

import { connectionErrorMessage, useSkills } from '../hooks/useConnectionsData'
import { useConnectionsNav } from '../hooks/useConnectionsNav'
import { useUnsavedGuard } from '../hooks/useUnsavedGuard'

import {
    BackLink,
    ChoiceGroup,
    ConfirmModal,
    DetailHeader,
    DoneHint,
    EmptyRow,
    FormError,
    GhostButton,
    ListBox,
    ListHeader,
    ListRow,
    ListRows,
    ListSkeleton,
    MoreMenu,
    PrimaryButton,
    RowActions,
    SearchInput,
    SecondaryButton,
    Switch,
    WhiteButton,
    fieldLabelClass,
    inputClass,
    matchesQuery,
    textareaClass,
    useFlash,
} from './ConnectionsUi'

import type { ConnectionsSkill, SkillRunner } from '../types'

import { cn } from '@/shared/lib/utils'

// the same rules as the server
const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
const DESCRIPTION_MAX = 300
const BODY_MAX = 20_000

const RUNNER_LABEL: Record<SkillRunner, string> = {
    agent: 'You and agent',
    user: 'Only you',
}

export const SkillsTab: React.FC<{ itemId?: string }> = ({ itemId }) => {
    if (itemId) return <SkillEditor itemId={itemId} />
    return <SkillsList />
}

const SkillsList: React.FC = () => {
    const { navigate, toItem } = useConnectionsNav()
    const { skills, isLoading, loadFailed, retry, setSkillEnabled, deleteSkill } = useSkills()
    const [query, setQuery] = React.useState('')
    const [deleting, setDeleting] = React.useState<string | null>(null)
    const [actionError, setActionError] = React.useState<string | null>(null)

    /** runs a change from a row. a change the server refuses shows above the list */
    const run = (change: Promise<unknown>, fallback: string) => {
        setActionError(null)
        change.catch((error) => setActionError(connectionErrorMessage(error, fallback)))
    }

    const visible = skills
    const filtered = visible.filter((skill) => matchesQuery(query, skill.name, skill.description))

    return (
        <div className="flex flex-col gap-4">
            {visible.length > 0 && (
                <div className="flex items-center gap-2">
                    <SearchInput value={query} onChange={setQuery} placeholder="Search skills" />
                    <span className="hidden md:block flex-1" />
                    <PrimaryButton onClick={() => navigate('/settings/connections/skills/new')}>
                        New skill
                    </PrimaryButton>
                </div>
            )}
            <FormError>{actionError}</FormError>
            <ListBox>
                <ListHeader>
                    <span className="flex-1">Name</span>
                    <span className="w-[130px]">Source</span>
                    <span className="w-[110px]">Runs</span>
                    <span className="w-[104px]" />
                </ListHeader>
                {isLoading ? (
                    <ListSkeleton />
                ) : loadFailed ? (
                    <EmptyRow
                        action={
                            <SecondaryButton onClick={() => retry()}>Try again</SecondaryButton>
                        }
                    >
                        Could not load skills
                    </EmptyRow>
                ) : visible.length === 0 ? (
                    <EmptyRow
                        action={
                            <SecondaryButton
                                onClick={() => navigate('/settings/connections/skills/new')}
                            >
                                New skill
                            </SecondaryButton>
                        }
                    >
                        No skills yet
                    </EmptyRow>
                ) : filtered.length === 0 ? (
                    <EmptyRow>No results for "{query.trim()}"</EmptyRow>
                ) : (
                    <ListRows>
                        {filtered.map((skill) => {
                            return (
                                <ListRow
                                    key={skill.name}
                                    onClick={() => toItem('skills', skill.name)}
                                >
                                    <span className="flex-1 min-w-0 flex flex-col">
                                        <span className="font-mono text-[#D6D5C9] truncate">
                                            {skill.name}
                                        </span>
                                        <span className="md:hidden text-[12px] text-[#7B7A79] truncate">
                                            You · {RUNNER_LABEL[skill.runs]}
                                        </span>
                                    </span>
                                    <span className="hidden md:block w-[130px] truncate text-[12.5px] text-[#7B7A79]">
                                        You
                                    </span>
                                    <span className="hidden md:block w-[110px] truncate text-[12.5px] text-[#7B7A79]">
                                        {RUNNER_LABEL[skill.runs]}
                                    </span>
                                    <span className="md:w-[104px] flex items-center justify-end gap-2">
                                        <RowActions
                                            noun="skill"
                                            onEdit={() => toItem('skills', skill.name)}
                                            onDelete={() => setDeleting(skill.name)}
                                        />
                                        <Switch
                                            checked={skill.enabled}
                                            label={`Turn ${skill.name} on or off`}
                                            onChange={(on) =>
                                                run(
                                                    setSkillEnabled(skill.name, on),
                                                    'Could not update the skill'
                                                )
                                            }
                                        />
                                        <MoreMenu
                                            mobileOnly
                                            label={`${skill.name} options`}
                                            items={[
                                                {
                                                    label: 'Delete skill',
                                                    danger: true,
                                                    onClick: () => setDeleting(skill.name),
                                                },
                                            ]}
                                        />
                                    </span>
                                </ListRow>
                            )
                        })}
                    </ListRows>
                )}
            </ListBox>
            <ConfirmModal
                isOpen={deleting !== null}
                title={`Delete ${deleting ?? ''}?`}
                confirmLabel="Delete"
                onClose={() => setDeleting(null)}
                onConfirm={() => {
                    if (deleting) run(deleteSkill(deleting), 'Could not delete the skill')
                    setDeleting(null)
                }}
            />
        </div>
    )
}

const emptySkill: ConnectionsSkill = {
    name: '',
    description: '',
    runs: 'agent',
    body: '',
    enabled: true,
}

/** true when the editor has a change to save. the switch saves `enabled` by itself */
const hasEdits = (draft: ConnectionsSkill, saved: ConnectionsSkill) =>
    draft.name !== saved.name ||
    draft.description !== saved.description ||
    draft.runs !== saved.runs ||
    draft.body !== saved.body

/** a name for a copy that no other skill has */
const copyName = (name: string, taken: string[]) => {
    let candidate = `${name}-copy`
    for (let n = 2; taken.includes(candidate); n++) candidate = `${name}-copy-${n}`
    return candidate
}

const SkillEditor: React.FC<{ itemId: string }> = ({ itemId }) => {
    const { toTab } = useConnectionsNav()
    const data = useSkills()

    // the form starts from the saved skill, so it waits for the list
    if (data.isLoading) {
        return (
            <div className="flex flex-col">
                <BackLink label="Skills" onClick={() => toTab('skills')} />
                <ListBox className="mt-4">
                    <ListSkeleton />
                </ListBox>
            </div>
        )
    }
    return <SkillForm itemId={itemId} data={data} />
}

const SkillForm: React.FC<{ itemId: string; data: ReturnType<typeof useSkills> }> = ({
    itemId,
    data,
}) => {
    const { toTab, toItem } = useConnectionsNav()
    const { skills, loadFailed, saveSkill, deleteSkill, setSkillEnabled } = data

    const isNew = itemId === 'new'
    const existing = skills.find((s) => s.name === itemId)
    const [draft, setDraft] = React.useState<ConnectionsSkill>(existing ?? emptySkill)
    const [mode, setMode] = React.useState<'write' | 'preview'>('write')
    const [touched, setTouched] = React.useState(false)
    const [isDeleting, setIsDeleting] = React.useState(false)
    const [isSaving, setIsSaving] = React.useState(false)
    const [actionError, setActionError] = React.useState<string | null>(null)
    const [saved, flashSaved] = useFlash()

    const isDirty = isNew
        ? Boolean(draft.name || draft.description || draft.body)
        : Boolean(existing && hasEdits(draft, existing))
    const { guard, modal } = useUnsavedGuard(isDirty)

    if (!isNew && !existing) {
        return (
            <div className="flex flex-col">
                <BackLink label="Skills" onClick={() => toTab('skills')} />
                <ListBox className="mt-4">
                    <EmptyRow>{loadFailed ? 'Could not load skills' : 'Skill not found'}</EmptyRow>
                </ListBox>
            </div>
        )
    }

    const nameTaken = skills.some((s) => s.name === draft.name && s.name !== existing?.name)
    const nameError = !draft.name
        ? null
        : !NAME_PATTERN.test(draft.name)
          ? 'Use lowercase letters, numbers and hyphens'
          : nameTaken
            ? 'You already have a skill with this name'
            : null
    const tooLong = draft.description.length > DESCRIPTION_MAX || draft.body.length > BODY_MAX
    const canSave = Boolean(
        draft.name &&
        draft.description.trim() &&
        draft.body.trim() &&
        !nameError &&
        !tooLong &&
        isDirty &&
        !isSaving
    )

    /** runs a change. a change the server refuses shows in the form */
    const run = async (change: () => Promise<void>, fallback: string) => {
        setActionError(null)
        try {
            await change()
        } catch (error) {
            setActionError(connectionErrorMessage(error, fallback))
        }
    }

    const handleSave = async () => {
        setTouched(true)
        if (!canSave) return
        setIsSaving(true)
        await run(async () => {
            // the switch owns `enabled`, so a save keeps the saved value
            const result = await saveSkill(
                { ...draft, enabled: existing?.enabled ?? draft.enabled },
                existing?.name
            )
            setDraft(result)
            flashSaved()
            if (isNew || result.name !== existing?.name) {
                toItem('skills', result.name, { replace: true })
            }
        }, 'Could not save the skill')
        setIsSaving(false)
    }

    const update = (patch: Partial<ConnectionsSkill>) => setDraft((d) => ({ ...d, ...patch }))

    return (
        <form
            className="flex flex-col"
            onSubmit={(e) => {
                e.preventDefault()
                handleSave()
            }}
            onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                    e.preventDefault()
                    handleSave()
                }
            }}
        >
            <BackLink label="Skills" onClick={() => guard(() => toTab('skills'))} />
            <DetailHeader title={isNew ? 'New skill' : existing?.name} mono={!isNew}>
                {existing && (
                    <Switch
                        checked={existing.enabled}
                        label="Turn this skill on or off"
                        onChange={(on) =>
                            run(
                                () => setSkillEnabled(existing.name, on),
                                'Could not update the skill'
                            )
                        }
                    />
                )}
                <span className="flex-1" />
                {saved && <DoneHint>Saved</DoneHint>}
                <GhostButton onClick={() => guard(() => toTab('skills'))}>Cancel</GhostButton>
                <WhiteButton type="submit" disabled={!canSave}>
                    Save skill
                </WhiteButton>
                {existing && (
                    <MoreMenu
                        label="Skill options"
                        items={[
                            {
                                label: 'Duplicate',
                                onClick: () =>
                                    run(async () => {
                                        const copy = await saveSkill({
                                            ...existing,
                                            name: copyName(
                                                existing.name,
                                                skills.map((s) => s.name)
                                            ),
                                        })
                                        setDraft(copy)
                                        toItem('skills', copy.name)
                                    }, 'Could not copy the skill'),
                            },
                            {
                                label: 'Delete skill',
                                danger: true,
                                onClick: () => setIsDeleting(true),
                            },
                        ]}
                    />
                )}
            </DetailHeader>

            <div className="flex flex-col gap-4">
                <FormError>{actionError}</FormError>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="skill-name" className={fieldLabelClass}>
                            Name
                        </label>
                        <input
                            id="skill-name"
                            autoFocus={isNew}
                            value={draft.name}
                            placeholder="e.g. write-tests"
                            onChange={(e) => update({ name: e.target.value })}
                            className={cn(inputClass, 'font-mono')}
                        />
                        {(touched || draft.name) && <FormError>{nameError}</FormError>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="skill-description" className={fieldLabelClass}>
                            Description
                        </label>
                        <input
                            id="skill-description"
                            value={draft.description}
                            placeholder="What the skill does"
                            onChange={(e) => update({ description: e.target.value })}
                            className={inputClass}
                        />
                        {touched && !draft.description.trim() && (
                            <FormError>Add a description</FormError>
                        )}
                        {draft.description.length > DESCRIPTION_MAX && (
                            <FormError>{`At most ${DESCRIPTION_MAX} characters`}</FormError>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <span className={fieldLabelClass}>Who can run it</span>
                    <ChoiceGroup
                        label="Who can run it"
                        value={draft.runs}
                        onChange={(runs) => update({ runs })}
                        options={[
                            { value: 'agent', label: 'You and the agent' },
                            { value: 'user', label: 'Only you' },
                        ]}
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                        <label htmlFor="skill-body" className={fieldLabelClass}>
                            Instructions
                        </label>
                        <ChoiceGroup
                            label="Editor mode"
                            value={mode}
                            onChange={setMode}
                            options={[
                                { value: 'write', label: 'Write' },
                                { value: 'preview', label: 'Preview' },
                            ]}
                        />
                    </div>
                    {mode === 'write' ? (
                        <textarea
                            id="skill-body"
                            value={draft.body}
                            rows={14}
                            placeholder={'# Steps\n1. ...'}
                            onChange={(e) => update({ body: e.target.value })}
                            className={textareaClass}
                        />
                    ) : (
                        <div className="min-h-[200px] rounded-lg border border-[#2B2A27] bg-white/[0.03] px-3.5 py-2.5 text-[13px] text-[#D6D5C9] whitespace-pre-wrap leading-relaxed">
                            {draft.body || <span className="text-[#4A4948]">Nothing to show</span>}
                        </div>
                    )}
                    {touched && !draft.body.trim() && <FormError>Write the steps</FormError>}
                    {draft.body.length > BODY_MAX && (
                        <FormError>{`At most ${BODY_MAX.toLocaleString('en-US')} characters`}</FormError>
                    )}
                </div>
            </div>

            {modal}
            <ConfirmModal
                isOpen={isDeleting}
                title={`Delete ${existing?.name ?? ''}?`}
                confirmLabel="Delete"
                onClose={() => setIsDeleting(false)}
                onConfirm={() => {
                    setIsDeleting(false)
                    if (!existing) return
                    run(async () => {
                        await deleteSkill(existing.name)
                        toTab('skills')
                    }, 'Could not delete the skill')
                }}
            />
        </form>
    )
}
