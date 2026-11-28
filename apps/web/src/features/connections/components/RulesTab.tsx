import {
    RULE_MAX_BYTES,
    RULE_NAME_PATTERN,
    RULES_TOTAL_MAX_BYTES,
    utf8Bytes,
} from '@december/shared/agent-context'
import React from 'react'

import { useRules } from '../hooks/useAccountContext'
import { connectionErrorMessage } from '../hooks/useConnectionsData'
import { useConnectionsNav } from '../hooks/useConnectionsNav'
import { useUnsavedGuard } from '../hooks/useUnsavedGuard'
import { CONNECTIONS_BASE_PATH } from '../lib/paths'

import {
    BackLink,
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

import type { ApiRule } from '../api/rules'

import { cn } from '@/shared/lib/utils'

const NEW_RULE_PATH = `${CONNECTIONS_BASE_PATH}/rules/new`

const formatKib = (bytes: number) => `${(bytes / 1024).toFixed(1)} KiB`

export const RulesTab: React.FC<{ itemId?: string }> = ({ itemId }) => {
    if (itemId) return <RuleEditor itemId={itemId} />
    return <RulesList />
}

const RulesList: React.FC = () => {
    const { navigate, toItem } = useConnectionsNav()
    const { rules, isLoading, loadFailed, retry, setRuleEnabled, deleteRule } = useRules()
    const [query, setQuery] = React.useState('')
    const [deleting, setDeleting] = React.useState<string | null>(null)
    const [actionError, setActionError] = React.useState<string | null>(null)

    /** runs a change from a row. a change the server refuses shows above the list */
    const run = (change: Promise<unknown>, fallback: string) => {
        setActionError(null)
        change.catch((error) => setActionError(connectionErrorMessage(error, fallback)))
    }

    const filtered = rules.filter((rule) => matchesQuery(query, rule.name, rule.body))
    const totalBytes = rules.reduce((sum, rule) => sum + utf8Bytes(rule.body), 0)

    return (
        <div className="flex flex-col gap-4">
            {rules.length > 0 && (
                <div className="flex items-center gap-2">
                    <SearchInput value={query} onChange={setQuery} placeholder="Search rules" />
                    <span className="hidden md:block flex-1" />
                    <PrimaryButton onClick={() => navigate(NEW_RULE_PATH)}>New rule</PrimaryButton>
                </div>
            )}
            <FormError>{actionError}</FormError>
            <ListBox>
                <ListHeader>
                    <span className="flex-1">Name</span>
                    <span className="w-[80px]">Size</span>
                    <span className="w-[136px] text-right whitespace-nowrap">
                        {rules.length > 0 &&
                            `${formatKib(totalBytes)} / ${RULES_TOTAL_MAX_BYTES / 1024} KiB`}
                    </span>
                </ListHeader>
                {isLoading ? (
                    <ListSkeleton />
                ) : loadFailed ? (
                    <EmptyRow
                        action={
                            <SecondaryButton onClick={() => retry()}>Try again</SecondaryButton>
                        }
                    >
                        Could not load rules
                    </EmptyRow>
                ) : rules.length === 0 ? (
                    <EmptyRow
                        action={
                            <SecondaryButton onClick={() => navigate(NEW_RULE_PATH)}>
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
                        {filtered.map((rule) => (
                            <ListRow key={rule.name} onClick={() => toItem('rules', rule.name)}>
                                <span className="flex-1 min-w-0 flex flex-col">
                                    <span
                                        className={cn(
                                            'font-mono truncate',
                                            rule.enabled ? 'text-[#D6D5C9]' : 'text-[#7B7A79]'
                                        )}
                                    >
                                        {rule.name}
                                    </span>
                                    <span className="md:hidden text-[12px] text-[#7B7A79] truncate">
                                        {formatKib(utf8Bytes(rule.body))}
                                    </span>
                                </span>
                                <span className="hidden md:block w-[80px] text-[12.5px] text-[#7B7A79]">
                                    {formatKib(utf8Bytes(rule.body))}
                                </span>
                                <span className="md:w-[136px] flex items-center justify-end gap-2">
                                    <RowActions
                                        noun="rule"
                                        onEdit={() => toItem('rules', rule.name)}
                                        onDelete={() => setDeleting(rule.name)}
                                    />
                                    <Switch
                                        checked={rule.enabled}
                                        label={`Turn ${rule.name} on or off`}
                                        onChange={(on) =>
                                            run(
                                                setRuleEnabled(rule.name, on),
                                                'Could not update the rule'
                                            )
                                        }
                                    />
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
                                </span>
                            </ListRow>
                        ))}
                    </ListRows>
                )}
            </ListBox>
            <ConfirmModal
                isOpen={deleting !== null}
                title={`Delete ${deleting ?? ''}?`}
                body="Sessions stop following this rule."
                confirmLabel="Delete"
                onClose={() => setDeleting(null)}
                onConfirm={() => {
                    if (deleting) run(deleteRule(deleting), 'Could not delete the rule')
                    setDeleting(null)
                }}
            />
        </div>
    )
}

type RuleDraft = { name: string; body: string }

const RuleEditor: React.FC<{ itemId: string }> = ({ itemId }) => {
    const { toTab } = useConnectionsNav()
    const data = useRules()

    // the form starts from the saved rule, so it waits for the list
    if (data.isLoading) {
        return (
            <div className="flex flex-col">
                <BackLink label="Rules" onClick={() => toTab('rules')} />
                <ListBox className="mt-4">
                    <ListSkeleton />
                </ListBox>
            </div>
        )
    }
    return <RuleForm itemId={itemId} data={data} />
}

const RuleForm: React.FC<{ itemId: string; data: ReturnType<typeof useRules> }> = ({
    itemId,
    data,
}) => {
    const { toTab, toItem } = useConnectionsNav()
    const { rules, loadFailed, saveRule, deleteRule, setRuleEnabled } = data

    const isNew = itemId === 'new'
    const existing: ApiRule | undefined = rules.find((rule) => rule.name === itemId)
    const [draft, setDraft] = React.useState<RuleDraft>({
        name: existing?.name ?? '',
        body: existing?.body ?? '',
    })
    const [touched, setTouched] = React.useState(false)
    const [isDeleting, setIsDeleting] = React.useState(false)
    const [isSaving, setIsSaving] = React.useState(false)
    const [actionError, setActionError] = React.useState<string | null>(null)
    const [saved, flashSaved] = useFlash()

    const isDirty = isNew
        ? Boolean(draft.name || draft.body)
        : Boolean(existing && (draft.name !== existing.name || draft.body !== existing.body))
    const { guard, modal } = useUnsavedGuard(isDirty && !isSaving)

    if (!isNew && !existing) {
        return (
            <div className="flex flex-col">
                <BackLink label="Rules" onClick={() => toTab('rules')} />
                <ListBox className="mt-4">
                    <EmptyRow>{loadFailed ? 'Could not load rules' : 'Rule not found'}</EmptyRow>
                </ListBox>
            </div>
        )
    }

    const size = utf8Bytes(draft.body)
    const isOverLimit = size > RULE_MAX_BYTES
    const nameTaken = rules.some((rule) => rule.name === draft.name && rule.name !== existing?.name)
    const nameError = !draft.name
        ? touched
            ? 'Add a name'
            : null
        : !RULE_NAME_PATTERN.test(draft.name)
          ? 'Use lowercase letters, numbers and dashes'
          : nameTaken
            ? 'You already have a rule with this name'
            : null
    const bodyError =
        touched && !draft.body.trim()
            ? 'Write the rule'
            : isOverLimit
              ? `A rule is at most ${RULE_MAX_BYTES / 1024} KiB`
              : null
    const canSave = Boolean(
        draft.name && draft.body.trim() && !nameError && !isOverLimit && isDirty && !isSaving
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
            const result = await saveRule(
                // the switch owns `enabled`, so a save keeps the saved value
                { name: draft.name, body: draft.body, enabled: existing?.enabled ?? true },
                existing?.name
            )
            setDraft({ name: result.name, body: result.body })
            flashSaved()
            if (isNew || result.name !== existing?.name) {
                toItem('rules', result.name, { replace: true })
            }
        }, 'Could not save the rule')
        setIsSaving(false)
    }

    return (
        <form
            className="flex flex-col"
            onSubmit={(e) => {
                e.preventDefault()
                void handleSave()
            }}
            onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                    e.preventDefault()
                    void handleSave()
                }
            }}
        >
            <BackLink label="Rules" onClick={() => guard(() => toTab('rules'))} />
            <DetailHeader title={isNew ? 'New rule' : existing?.name} mono={!isNew}>
                {existing && (
                    <Switch
                        checked={existing.enabled}
                        label="Turn this rule on or off"
                        onChange={(on) =>
                            run(
                                () => setRuleEnabled(existing.name, on),
                                'Could not update the rule'
                            )
                        }
                    />
                )}
                <span className="flex-1" />
                {saved && <DoneHint>Saved</DoneHint>}
                <span className="hidden md:block">
                    <GhostButton onClick={() => guard(() => toTab('rules'))}>Cancel</GhostButton>
                </span>
                <WhiteButton type="submit" disabled={!canSave}>
                    {isSaving ? 'Saving' : 'Save rule'}
                </WhiteButton>
                {existing && (
                    <MoreMenu
                        label="Rule options"
                        items={[
                            {
                                label: 'Delete rule',
                                danger: true,
                                onClick: () => setIsDeleting(true),
                            },
                        ]}
                    />
                )}
            </DetailHeader>

            <div className="flex flex-col gap-4">
                <FormError>{actionError}</FormError>
                <div className="flex flex-col gap-1.5 md:max-w-[50%]">
                    <label htmlFor="rule-name" className={fieldLabelClass}>
                        Name
                    </label>
                    <input
                        id="rule-name"
                        autoFocus={isNew}
                        value={draft.name}
                        maxLength={64}
                        placeholder="e.g. code-style"
                        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value.trim() }))}
                        className={cn(inputClass, 'font-mono')}
                    />
                    <FormError>{nameError}</FormError>
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
                            {formatKib(size)} / {RULE_MAX_BYTES / 1024} KiB
                        </span>
                    </div>
                    <textarea
                        id="rule-body"
                        value={draft.body}
                        rows={14}
                        placeholder="- Use arrow functions in services."
                        onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                        className={textareaClass}
                    />
                    <FormError>{bodyError}</FormError>
                </div>
            </div>

            {modal}
            <ConfirmModal
                isOpen={isDeleting}
                title={`Delete ${existing?.name ?? ''}?`}
                body="Sessions stop following this rule."
                confirmLabel="Delete"
                onClose={() => setIsDeleting(false)}
                onConfirm={() => {
                    setIsDeleting(false)
                    if (!existing) return
                    void run(async () => {
                        await deleteRule(existing.name)
                        toTab('rules')
                    }, 'Could not delete the rule')
                }}
            />
        </form>
    )
}
