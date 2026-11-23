import React from 'react'

import { useConnectionsNav } from '../hooks/useConnectionsNav'
import { isPluginOff, useConnectionsStore } from '../hooks/useConnectionsStore'
import { useUnsavedGuard } from '../hooks/useUnsavedGuard'
import { RULE_SIZE_LIMIT, type ConnectionsRule, type RuleTrigger } from '../types'

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

import { cn } from '@/shared/lib/utils'

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

const TRIGGER_LABEL: Record<RuleTrigger, string> = { always: 'Always', manual: 'Manual' }

const byteSize = (text: string) => new TextEncoder().encode(text).length
const formatKib = (bytes: number) => `${(bytes / 1024).toFixed(1)} KiB`

export const RulesTab: React.FC<{ itemId?: string }> = ({ itemId }) => {
    if (itemId) return <RuleEditor itemId={itemId} />
    return <RulesList />
}

const RulesList: React.FC = () => {
    const { navigate, toItem } = useConnectionsNav()
    const rules = useConnectionsStore((s) => s.rules)
    const plugins = useConnectionsStore((s) => s.plugins)
    const setRuleEnabled = useConnectionsStore((s) => s.setRuleEnabled)
    const deleteRule = useConnectionsStore((s) => s.deleteRule)
    const [query, setQuery] = React.useState('')
    const [deleting, setDeleting] = React.useState<string | null>(null)

    const visible = rules.filter(
        (rule) => !rule.plugin || plugins.some((p) => p.name === rule.plugin && p.installed)
    )
    const filtered = visible.filter((rule) => matchesQuery(query, rule.name))

    return (
        <div className="flex flex-col gap-4">
            {visible.length > 0 && (
                <div className="flex items-center gap-2">
                    <SearchInput value={query} onChange={setQuery} placeholder="Search rules" />
                    <span className="hidden md:block flex-1" />
                    <PrimaryButton onClick={() => navigate('/connections/rules/new')}>
                        New rule
                    </PrimaryButton>
                </div>
            )}
            <ListBox>
                <ListHeader>
                    <span className="flex-1">Name</span>
                    <span className="w-[130px]">Source</span>
                    <span className="w-[80px]">When</span>
                    <span className="w-[70px]">Size</span>
                    <span className="w-[104px]" />
                </ListHeader>
                {visible.length === 0 ? (
                    <EmptyRow
                        action={
                            <SecondaryButton onClick={() => navigate('/connections/rules/new')}>
                                New rule
                            </SecondaryButton>
                        }
                    >
                        No rules yet
                    </EmptyRow>
                ) : filtered.length === 0 ? (
                    <EmptyRow>No results for "{query.trim()}"</EmptyRow>
                ) : (
                    <ListRows>
                        {filtered.map((rule) => {
                            const locked = isPluginOff(plugins, rule.plugin)
                            const isOwn = !rule.plugin
                            return (
                                <ListRow key={rule.name} onClick={() => toItem('rules', rule.name)}>
                                    <span className="flex-1 min-w-0 flex flex-col">
                                        <span className="font-mono text-[#D6D5C9] truncate">
                                            {rule.name}
                                        </span>
                                        <span className="md:hidden text-[12px] text-[#7B7A79] truncate">
                                            {rule.plugin ?? 'You'} · {TRIGGER_LABEL[rule.when]}
                                        </span>
                                    </span>
                                    <span className="hidden md:block w-[130px] truncate text-[12.5px] text-[#7B7A79]">
                                        {rule.plugin ?? 'You'}
                                    </span>
                                    <span className="hidden md:block w-[80px] text-[12.5px] text-[#7B7A79]">
                                        {TRIGGER_LABEL[rule.when]}
                                    </span>
                                    <span className="hidden md:block w-[70px] text-[12.5px] text-[#7B7A79]">
                                        {formatKib(byteSize(rule.body))}
                                    </span>
                                    <span className="md:w-[104px] flex items-center justify-end gap-2">
                                        {isOwn && (
                                            <RowActions
                                                noun="rule"
                                                onEdit={() => toItem('rules', rule.name)}
                                                onDelete={() => setDeleting(rule.name)}
                                            />
                                        )}
                                        <Switch
                                            checked={rule.enabled && !locked}
                                            disabled={locked}
                                            disabledReason="Plugin is off"
                                            label={`Turn ${rule.name} on or off`}
                                            onChange={(on) => setRuleEnabled(rule.name, on)}
                                        />
                                        {isOwn && (
                                            <MoreMenu
                                                mobileOnly
                                                label={`${rule.name} options`}
                                                items={[
                                                    {
                                                        label: 'Delete rule',
                                                        danger: true,
                                                        onClick: () => setDeleting(rule.name),
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
                    if (deleting) deleteRule(deleting)
                    setDeleting(null)
                }}
            />
        </div>
    )
}

const emptyRule: ConnectionsRule = { name: '', when: 'always', body: '', enabled: true }

const RuleEditor: React.FC<{ itemId: string }> = ({ itemId }) => {
    const { toTab, toItem } = useConnectionsNav()
    const rules = useConnectionsStore((s) => s.rules)
    const plugins = useConnectionsStore((s) => s.plugins)
    const saveRule = useConnectionsStore((s) => s.saveRule)
    const deleteRule = useConnectionsStore((s) => s.deleteRule)
    const setRuleEnabled = useConnectionsStore((s) => s.setRuleEnabled)

    const isNew = itemId === 'new'
    const existing = rules.find((r) => r.name === itemId)
    const [draft, setDraft] = React.useState<ConnectionsRule>(existing ?? emptyRule)
    const [touched, setTouched] = React.useState(false)
    const [isDeleting, setIsDeleting] = React.useState(false)
    const [saved, flashSaved] = useFlash()

    const readOnly = Boolean(existing?.plugin)
    const locked = isPluginOff(plugins, existing?.plugin)
    const isDirty =
        !readOnly &&
        (isNew
            ? Boolean(draft.name || draft.body)
            : JSON.stringify(draft) !== JSON.stringify(existing))
    const { guard, modal } = useUnsavedGuard(isDirty)

    if (!isNew && !existing) {
        return (
            <div className="flex flex-col">
                <BackLink label="Rules" onClick={() => toTab('rules')} />
                <ListBox className="mt-4">
                    <EmptyRow>Rule not found</EmptyRow>
                </ListBox>
            </div>
        )
    }

    const size = byteSize(draft.body)
    const isOverLimit = size > RULE_SIZE_LIMIT
    const nameTaken = rules.some((r) => r.name === draft.name && r.name !== existing?.name)
    const nameError = !draft.name
        ? null
        : !NAME_PATTERN.test(draft.name)
          ? 'Use lowercase letters, numbers and hyphens'
          : nameTaken
            ? 'You already have a rule with this name'
            : null
    const canSave = Boolean(draft.name && draft.body.trim() && !nameError && isDirty)

    const handleSave = () => {
        setTouched(true)
        if (!canSave) return
        saveRule(draft, existing?.name)
        flashSaved()
        if (isNew || draft.name !== existing?.name) {
            toItem('rules', draft.name, { replace: true })
        }
    }

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
            <BackLink label="Rules" onClick={() => guard(() => toTab('rules'))} />
            <DetailHeader title={isNew ? 'New rule' : existing?.name} mono={!isNew}>
                {existing && (
                    <Switch
                        checked={existing.enabled && !locked}
                        disabled={locked}
                        disabledReason="Plugin is off"
                        label="Turn this rule on or off"
                        onChange={(on) => setRuleEnabled(existing.name, on)}
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
                        <GhostButton onClick={() => guard(() => toTab('rules'))}>
                            Cancel
                        </GhostButton>
                        <WhiteButton type="submit" disabled={!canSave}>
                            Save rule
                        </WhiteButton>
                        {existing && (
                            <MoreMenu
                                label="Rule options"
                                items={[
                                    {
                                        label: 'Duplicate',
                                        onClick: () => {
                                            const copy = {
                                                ...existing,
                                                name: `${existing.name}-copy`,
                                            }
                                            saveRule(copy)
                                            setDraft(copy)
                                            toItem('rules', copy.name)
                                        },
                                    },
                                    {
                                        label: 'Delete rule',
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
                        <label htmlFor="rule-name" className={fieldLabelClass}>
                            Name
                        </label>
                        <input
                            id="rule-name"
                            autoFocus={isNew}
                            readOnly={readOnly}
                            value={draft.name}
                            placeholder="e.g. code-style"
                            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                            className={cn(inputClass, 'font-mono')}
                        />
                        {(touched || draft.name) && <FormError>{nameError}</FormError>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className={fieldLabelClass}>When</span>
                        <ChoiceGroup
                            label="When the rule is used"
                            value={draft.when}
                            onChange={(when) => !readOnly && setDraft((d) => ({ ...d, when }))}
                            options={[
                                { value: 'always', label: 'Always' },
                                { value: 'manual', label: 'Manual' },
                            ]}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                        <label htmlFor="rule-body" className={fieldLabelClass}>
                            Rule
                        </label>
                        <span
                            className={cn(
                                'text-[12px] font-medium',
                                isOverLimit ? 'text-red-500' : 'text-[#7B7A79]'
                            )}
                        >
                            {formatKib(size)} / 16 KiB
                        </span>
                    </div>
                    <textarea
                        id="rule-body"
                        readOnly={readOnly}
                        value={draft.body}
                        rows={14}
                        placeholder="- Use arrow functions in services."
                        onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                        className={textareaClass}
                    />
                    {isOverLimit && <FormError>Only the first 16 KiB is used.</FormError>}
                    {touched && !draft.body.trim() && <FormError>Write the rule</FormError>}
                </div>
            </div>

            {modal}
            <ConfirmModal
                isOpen={isDeleting}
                title={`Delete ${existing?.name ?? ''}?`}
                confirmLabel="Delete"
                onClose={() => setIsDeleting(false)}
                onConfirm={() => {
                    if (existing) deleteRule(existing.name)
                    setIsDeleting(false)
                    toTab('rules')
                }}
            />
        </form>
    )
}
