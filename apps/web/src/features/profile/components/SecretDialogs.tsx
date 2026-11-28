import {
    SECRET_NOTE_MAX,
    SECRETS_BULK_MAX,
    checkSecretName,
    checkSecretValue,
    parseEnvText,
    toSecretName,
} from '@december/shared/secrets'
import { Eye, EyeOff } from 'lucide-react'
import React, { useState } from 'react'

import { SettingsSelect } from './SettingsUi'

import type { SecretSummary } from '../api/secrets'

import {
    FormError,
    ModalActions,
    fieldLabelClass,
    inputClass,
    textareaClass,
} from '@/features/connections/components/ConnectionsUi'
import { Modal } from '@/shared/components/ui/Modal'
import { cn } from '@/shared/lib/utils'

/** the "use in" value of a secret that every repository gets */
export const ALL_REPOSITORIES = ''

export type UseInOption = { value: string; label: string }

/** a secret field: no browser autofill, no password manager, no spell check that sends text */
const privateFieldProps = {
    autoComplete: 'off',
    autoCorrect: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
    'data-1p-ignore': true,
    'data-lpignore': 'true',
} as const

const errorText = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback

/** as the user types: capital letters, and _ for a space or another character */
const formatTypedName = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9_]/g, '_')

const UseInField: React.FC<{
    value: string
    options: UseInOption[]
    onChange: (value: string) => void
}> = ({ value, options, onChange }) =>
    // with no repository to pick, every secret is for all repositories: no select
    options.length > 1 ? (
        <div className="flex flex-col gap-1.5">
            <span className={fieldLabelClass}>Use in</span>
            <SettingsSelect
                label="Use in"
                value={value}
                options={options}
                onChange={onChange}
                className="w-full"
            />
        </div>
    ) : null

export interface AddSecretInput {
    name: string
    value: string
    note: string | null
    repoFullName: string | null
}

/** the dialog that adds one secret, or saves a new value for a name that is there */
export const AddSecretModal: React.FC<{
    isOpen: boolean
    secrets: SecretSummary[]
    useInOptions: UseInOption[]
    onClose: () => void
    onSubmit: (input: AddSecretInput) => Promise<unknown>
    onPasteEnv: () => void
}> = ({ isOpen, secrets, useInOptions, onClose, onSubmit, onPasteEnv }) => {
    const [name, setName] = useState('')
    const [value, setValue] = useState('')
    const [note, setNote] = useState('')
    const [useIn, setUseIn] = useState(ALL_REPOSITORIES)
    const [showValue, setShowValue] = useState(false)
    const [isPending, setIsPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const reset = () => {
        setName('')
        setValue('')
        setNote('')
        setUseIn(ALL_REPOSITORIES)
        setShowValue(false)
        setError(null)
    }
    const close = () => {
        if (isPending) return
        reset()
        onClose()
    }

    const secretName = toSecretName(name)
    const nameProblem = name ? checkSecretName(secretName) : null
    const valueProblem = value ? checkSecretValue(value.trim()) : null
    // a name that is there already for this repository: the save gives it a new value
    const isReplace = secrets.some(
        (secret) =>
            secret.name === secretName &&
            (secret.repoFullName ?? '').toLowerCase() === useIn.toLowerCase()
    )

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        // the dialog is portaled, so stop the submit reaching a form behind it
        e.stopPropagation()
        if (isPending || !secretName || !value.trim() || nameProblem || valueProblem) return
        setIsPending(true)
        setError(null)
        try {
            await onSubmit({
                name: secretName,
                value: value.trim(),
                note: note.trim() || null,
                repoFullName: useIn || null,
            })
            reset()
            onClose()
        } catch (err) {
            setError(errorText(err, 'The secret was not saved. Try again.'))
        } finally {
            setIsPending(false)
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={close}
            title="Add secret"
            description="Use it in a session as $NAME."
            variant="premium"
            showLogo={false}
            sheetOnPhone
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="secret-name-input" className={fieldLabelClass}>
                        Name
                    </label>
                    <input
                        id="secret-name-input"
                        type="text"
                        autoFocus
                        placeholder="SERVICE_USERNAME"
                        value={name}
                        onChange={(e) => setName(formatTypedName(e.target.value))}
                        className={cn(inputClass, 'font-mono')}
                        {...privateFieldProps}
                        required
                    />
                    <FormError>{nameProblem}</FormError>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label htmlFor="secret-value-input" className={fieldLabelClass}>
                        Value
                    </label>
                    <div className="relative">
                        <input
                            id="secret-value-input"
                            type={showValue ? 'text' : 'password'}
                            placeholder="Key or token"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            className={cn(inputClass, 'font-mono pr-10')}
                            {...privateFieldProps}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowValue(!showValue)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B7A79] hover:text-[#D6D5C9] transition-colors cursor-pointer"
                            aria-label={showValue ? 'Hide secret value' : 'Show secret value'}
                        >
                            {showValue ? (
                                <EyeOff className="w-4 h-4" />
                            ) : (
                                <Eye className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                    <FormError>{valueProblem}</FormError>
                </div>

                <UseInField value={useIn} options={useInOptions} onChange={setUseIn} />

                <div className="flex flex-col gap-1.5">
                    <label htmlFor="secret-note-input" className={fieldLabelClass}>
                        Note
                    </label>
                    <input
                        id="secret-note-input"
                        type="text"
                        placeholder="Optional"
                        value={note}
                        maxLength={SECRET_NOTE_MAX}
                        onChange={(e) => setNote(e.target.value)}
                        className={inputClass}
                        autoComplete="off"
                    />
                </div>

                <FormError>{error}</FormError>

                <ModalActions
                    onCancel={close}
                    submitLabel={isReplace ? 'Replace secret' : 'Add secret'}
                    submitDisabled={
                        !secretName || !value.trim() || Boolean(nameProblem || valueProblem)
                    }
                    isPending={isPending}
                    leading={
                        <button
                            type="button"
                            onClick={() => {
                                reset()
                                onPasteEnv()
                            }}
                            className="text-[12.5px] font-medium text-[#87B2F4] hover:underline cursor-pointer"
                        >
                            Paste a .env file
                        </button>
                    }
                />
            </form>
        </Modal>
    )
}

export interface BulkAddSecretsInput {
    secrets: Array<{ name: string; value: string }>
    repoFullName: string | null
}

/** the dialog that adds the secrets of a pasted .env file */
export const BulkAddSecretsModal: React.FC<{
    isOpen: boolean
    useInOptions: UseInOption[]
    onClose: () => void
    onSubmit: (input: BulkAddSecretsInput) => Promise<unknown>
}> = ({ isOpen, useInOptions, onClose, onSubmit }) => {
    const [content, setContent] = useState('')
    const [useIn, setUseIn] = useState(ALL_REPOSITORIES)
    const [isPending, setIsPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const reset = () => {
        setContent('')
        setUseIn(ALL_REPOSITORIES)
        setError(null)
    }
    const close = () => {
        if (isPending) return
        reset()
        onClose()
    }

    const { entries, problems } = React.useMemo(() => parseEnvText(content), [content])
    const firstProblem = problems[0]
    const problemText = firstProblem
        ? `Line ${firstProblem.line}: ${firstProblem.message}`
        : entries.length > SECRETS_BULK_MAX
          ? `Add up to ${SECRETS_BULK_MAX} secrets at a time.`
          : null
    const canSubmit = entries.length > 0 && !problemText

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (isPending || !canSubmit) return
        setIsPending(true)
        setError(null)
        try {
            await onSubmit({
                secrets: entries.map((entry) => ({ name: entry.name, value: entry.value })),
                repoFullName: useIn || null,
            })
            reset()
            onClose()
        } catch (err) {
            setError(errorText(err, 'The secrets were not saved. Try again.'))
        } finally {
            setIsPending(false)
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={close}
            title="Add secrets"
            description="One NAME=value on each line."
            variant="premium"
            showLogo={false}
            sheetOnPhone
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <textarea
                        autoFocus
                        aria-label="Secrets"
                        placeholder={`SERVICE_USERNAME=admin\nSTRIPE_API_KEY=sk_test_12345\nDATABASE_URL=postgres://...`}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        rows={8}
                        className={textareaClass}
                        {...privateFieldProps}
                        required
                    />
                    {problemText ? (
                        <FormError>{problemText}</FormError>
                    ) : entries.length > 0 ? (
                        <p className="text-[12.5px] text-[#7B7A79]">
                            {entries.length === 1 ? '1 secret' : `${entries.length} secrets`}
                        </p>
                    ) : null}
                </div>

                <UseInField value={useIn} options={useInOptions} onChange={setUseIn} />

                <FormError>{error}</FormError>

                <ModalActions
                    onCancel={close}
                    submitLabel="Add secrets"
                    submitDisabled={!canSubmit}
                    isPending={isPending}
                />
            </form>
        </Modal>
    )
}

/** asks before a secret is deleted. a delete cannot be undone */
export const DeleteSecretModal: React.FC<{
    secret: SecretSummary | null
    /** the repository as the git host writes it */
    repoLabel: (repoFullName: string) => string
    onClose: () => void
    onConfirm: (secret: SecretSummary) => Promise<unknown>
}> = ({ secret, repoLabel, onClose, onConfirm }) => {
    const [isPending, setIsPending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // the dialog keeps its text while it closes
    const [shown, setShown] = useState<SecretSummary | null>(secret)
    if (secret && secret !== shown) {
        setShown(secret)
        setError(null)
    }

    const close = () => {
        if (isPending) return
        setError(null)
        onClose()
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!secret || isPending) return
        setIsPending(true)
        setError(null)
        try {
            await onConfirm(secret)
            onClose()
        } catch (err) {
            setError(errorText(err, 'The secret was not deleted. Try again.'))
        } finally {
            setIsPending(false)
        }
    }

    const where = shown?.repoFullName ? ` in ${repoLabel(shown.repoFullName)}` : ''
    return (
        <Modal
            isOpen={Boolean(secret)}
            onClose={close}
            title="Delete secret"
            description={shown ? `New sessions do not get $${shown.name}${where}.` : undefined}
            variant="premium"
            showLogo={false}
            sheetOnPhone
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <FormError>{error}</FormError>
                <ModalActions
                    onCancel={close}
                    submitLabel="Delete secret"
                    isPending={isPending}
                    danger
                />
            </form>
        </Modal>
    )
}
