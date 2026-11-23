import React from 'react'

import { useConnectionsNav } from '../hooks/useConnectionsNav'
import { isPluginOff, useConnectionsStore } from '../hooks/useConnectionsStore'
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
    MoreMenu,
    Pill,
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

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

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
    const skills = useConnectionsStore((s) => s.skills)
    const plugins = useConnectionsStore((s) => s.plugins)
    const setSkillEnabled = useConnectionsStore((s) => s.setSkillEnabled)
    const deleteSkill = useConnectionsStore((s) => s.deleteSkill)
    const [query, setQuery] = React.useState('')
    const [deleting, setDeleting] = React.useState<string | null>(null)

    const visible = skills.filter(
        (skill) => !skill.plugin || plugins.some((p) => p.name === skill.plugin && p.installed)
    )
    const filtered = visible.filter((skill) => matchesQuery(query, skill.name, skill.description))

    return (
        <div className="flex flex-col gap-4">
            {visible.length > 0 && (
                <div className="flex items-center gap-2">
                    <SearchInput value={query} onChange={setQuery} placeholder="Search skills" />
                    <span className="hidden md:block flex-1" />
                    <PrimaryButton onClick={() => navigate('/connections/skills/new')}>
                        New skill
                    </PrimaryButton>
                </div>
            )}
            <ListBox>
                <ListHeader>
                    <span className="flex-1">Name</span>
                    <span className="w-[130px]">Source</span>
                    <span className="w-[110px]">Runs</span>
                    <span className="w-[104px]" />
                </ListHeader>
                {visible.length === 0 ? (
                    <EmptyRow
                        action={
                            <SecondaryButton onClick={() => navigate('/connections/skills/new')}>
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
                            const locked = isPluginOff(plugins, skill.plugin)
                            const isOwn = !skill.plugin
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
                                            {skill.plugin ?? 'You'} · {RUNNER_LABEL[skill.runs]}
                                        </span>
                                    </span>
                                    <span className="hidden md:block w-[130px] truncate text-[12.5px] text-[#7B7A79]">
                                        {skill.plugin ?? 'You'}
                                    </span>
                                    <span className="hidden md:block w-[110px] truncate text-[12.5px] text-[#7B7A79]">
                                        {RUNNER_LABEL[skill.runs]}
                                    </span>
                                    <span className="md:w-[104px] flex items-center justify-end gap-2">
                                        {isOwn && (
                                            <RowActions
                                                noun="skill"
                                                onEdit={() => toItem('skills', skill.name)}
                                                onDelete={() => setDeleting(skill.name)}
                                            />
                                        )}
                                        <Switch
                                            checked={skill.enabled && !locked}
                                            disabled={locked}
                                            disabledReason="Plugin is off"
                                            label={`Turn ${skill.name} on or off`}
                                            onChange={(on) => setSkillEnabled(skill.name, on)}
                                        />
                                        {isOwn && (
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
                                        )}
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
                    if (deleting) deleteSkill(deleting)
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

const SkillEditor: React.FC<{ itemId: string }> = ({ itemId }) => {
    const { toTab, toItem } = useConnectionsNav()
    const skills = useConnectionsStore((s) => s.skills)
    const plugins = useConnectionsStore((s) => s.plugins)
    const saveSkill = useConnectionsStore((s) => s.saveSkill)
    const deleteSkill = useConnectionsStore((s) => s.deleteSkill)
    const setSkillEnabled = useConnectionsStore((s) => s.setSkillEnabled)

    const isNew = itemId === 'new'
    const existing = skills.find((s) => s.name === itemId)
    const [draft, setDraft] = React.useState<ConnectionsSkill>(existing ?? emptySkill)
    const [mode, setMode] = React.useState<'write' | 'preview'>('write')
    const [touched, setTouched] = React.useState(false)
    const [isDeleting, setIsDeleting] = React.useState(false)
    const [saved, flashSaved] = useFlash()

    const readOnly = Boolean(existing?.plugin)
    const locked = isPluginOff(plugins, existing?.plugin)
    const isDirty =
        !readOnly &&
        (isNew
            ? Boolean(draft.name || draft.description || draft.body)
            : JSON.stringify(draft) !== JSON.stringify(existing))
    const { guard, modal } = useUnsavedGuard(isDirty)

    if (!isNew && !existing) {
        return (
            <div className="flex flex-col">
                <BackLink label="Skills" onClick={() => toTab('skills')} />
                <ListBox className="mt-4">
                    <EmptyRow>Skill not found</EmptyRow>
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
    const canSave = Boolean(draft.name && draft.description.trim() && !nameError && isDirty)

    const handleSave = () => {
        setTouched(true)
        if (!canSave) return
        saveSkill(draft, existing?.name)
        flashSaved()
        if (isNew || draft.name !== existing?.name) {
            toItem('skills', draft.name, { replace: true })
        }
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
                        checked={existing.enabled && !locked}
                        disabled={locked}
                        disabledReason="Plugin is off"
                        label="Turn this skill on or off"
                        onChange={(on) => setSkillEnabled(existing.name, on)}
                    />
                )}
                {existing?.plugin && <Pill>{existing.plugin}</Pill>}
                <span className="flex-1" />
                {readOnly ? (
                    <SecondaryButton onClick={() => toItem('plugins', existing?.plugin ?? '')}>
                        Open plugin
                    </SecondaryButton>
                ) : (
                    <>
                        {saved && <DoneHint>Saved</DoneHint>}
                        <GhostButton onClick={() => guard(() => toTab('skills'))}>
                            Cancel
                        </GhostButton>
                        <WhiteButton type="submit" disabled={!canSave}>
                            Save skill
                        </WhiteButton>
                        {existing && (
                            <MoreMenu
                                label="Skill options"
                                items={[
                                    {
                                        label: 'Duplicate',
                                        onClick: () => {
                                            const copy = {
                                                ...existing,
                                                name: `${existing.name}-copy`,
                                            }
                                            saveSkill(copy)
                                            setDraft(copy)
                                            toItem('skills', copy.name)
                                        },
                                    },
                                    {
                                        label: 'Delete skill',
                                        danger: true,
                                        onClick: () => setIsDeleting(true),
                                    },
                                ]}
                            />
                        )}
                    </>
                )}
            </DetailHeader>

            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="skill-name" className={fieldLabelClass}>
                            Name
                        </label>
                        <input
                            id="skill-name"
                            autoFocus={isNew}
                            readOnly={readOnly}
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
                            readOnly={readOnly}
                            value={draft.description}
                            placeholder="What the skill does"
                            onChange={(e) => update({ description: e.target.value })}
                            className={inputClass}
                        />
                        {touched && !draft.description.trim() && (
                            <FormError>Add a description</FormError>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <span className={fieldLabelClass}>Who can run it</span>
                    <ChoiceGroup
                        label="Who can run it"
                        value={draft.runs}
                        onChange={(runs) => !readOnly && update({ runs })}
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
                            readOnly={readOnly}
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
                </div>
            </div>

            {modal}
            <ConfirmModal
                isOpen={isDeleting}
                title={`Delete ${existing?.name ?? ''}?`}
                confirmLabel="Delete"
                onClose={() => setIsDeleting(false)}
                onConfirm={() => {
                    if (existing) deleteSkill(existing.name)
                    setIsDeleting(false)
                    toTab('skills')
                }}
            />
        </form>
    )
}
