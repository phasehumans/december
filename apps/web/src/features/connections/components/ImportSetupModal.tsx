import React from 'react'

import {
    connectionErrorMessage,
    useImportPreview,
    useImportSetup,
} from '../hooks/useConnectionsData'

import { FormError, ModalActions, Pill, SectionTitle, fieldLabelClass } from './ConnectionsUi'

import type {
    ImportPreview,
    ImportPreviewMcp,
    ImportPreviewRule,
    ImportPreviewSkill,
    ImportRepo,
    ImportResult,
} from '../api/connections'

import { RepoSideList } from '@/features/home/components/PromptMenus'
import { quietLinkClass } from '@/features/profile/components/settingsStyles'
import { Modal } from '@/shared/components/ui/Modal'
import { cn } from '@/shared/lib/utils'

type ModalProps = { isOpen: boolean; onClose: () => void }

const TITLE = 'Import setup'
const DESCRIPTION = 'Bring in the skills, MCP servers and rules a repository has.'

/** one skill or mcp server of the repository, with its tick */
const FoundRow: React.FC<{
    label: string
    name: string
    detail?: string
    /** why the row cannot be imported, or what to do after the import */
    note?: string
    exists: boolean
    importable: boolean
    checked: boolean
    onChange: (checked: boolean) => void
}> = ({ label, name, detail, note, exists, importable, checked, onChange }) => (
    <label
        className={cn(
            'flex items-start gap-2.5 text-[13px] select-none',
            importable ? 'cursor-pointer' : 'opacity-50'
        )}
    >
        <input
            type="checkbox"
            aria-label={label}
            checked={checked}
            disabled={!importable}
            onChange={(event) => onChange(event.target.checked)}
            className="mt-0.5 w-4 h-4 shrink-0 accent-[#87B2F4] cursor-pointer disabled:cursor-default"
        />
        <span className="flex flex-col min-w-0 flex-1">
            <span className="flex items-center gap-2 min-w-0">
                <span className="truncate text-[#D6D5C9]">{name}</span>
                {exists && <Pill>Saved</Pill>}
            </span>
            {detail && <span className="truncate text-[12.5px] text-[#7B7A79]">{detail}</span>}
            {note && <span className="text-[12.5px] text-[#7B7A79]">{note}</span>}
        </span>
    </label>
)

const FoundSection: React.FC<{ title: string; children: React.ReactNode }> = ({
    title,
    children,
}) => (
    <div className="flex flex-col gap-2">
        <SectionTitle>{title}</SectionTitle>
        {children}
    </div>
)

/** new names start ticked. a saved name is replaced only when the user ticks it */
const tickedAtStart = (rows: (ImportPreviewSkill | ImportPreviewMcp)[]) =>
    new Set(rows.filter((row) => row.importable && !row.exists).map((row) => row.name))

/** rule files start unticked: a rule applies to every session, not only to this repository */
const NO_RULES = new Set<string>()

const FoundLists: React.FC<{
    preview: ImportPreview
    onCancel: () => void
    onDone: () => void
}> = ({ preview, onCancel, onDone }) => {
    const importSetup = useImportSetup()
    const [skills, setSkills] = React.useState(() => tickedAtStart(preview.skills))
    const [mcps, setMcps] = React.useState(() => tickedAtStart(preview.mcps))
    const [rules, setRules] = React.useState(NO_RULES)
    const [skipped, setSkipped] = React.useState<ImportResult['skipped']>([])
    const [error, setError] = React.useState('')

    const toggle =
        (set: React.Dispatch<React.SetStateAction<Set<string>>>, name: string) =>
        (checked: boolean) =>
            set((current) => {
                const next = new Set(current)
                if (checked) next.add(name)
                else next.delete(name)
                return next
            })

    const tickedSkills = preview.skills.filter((row) => skills.has(row.name))
    const tickedMcps = preview.mcps.filter((row) => mcps.has(row.name))
    const tickedRules = preview.rules.filter((row) => rules.has(row.path))
    const tickedCount = tickedSkills.length + tickedMcps.length + tickedRules.length
    const isEmpty =
        preview.skills.length === 0 && preview.mcps.length === 0 && preview.rules.length === 0

    const submit = async () => {
        setError('')
        setSkipped([])
        try {
            const result = await importSetup.mutateAsync({
                repoFullName: preview.repoFullName,
                provider: preview.provider,
                skills: tickedSkills.map((row) => row.name),
                mcps: tickedMcps.map((row) => row.name),
                rules: tickedRules.map((row) => row.path),
                overwrite: [...tickedSkills, ...tickedMcps, ...tickedRules].some(
                    (row) => row.exists
                ),
            })
            if (result.skipped.length === 0) {
                onDone()
                return
            }
            // what was imported is done: only the skipped rows stay ticked
            const without = (names: string[]) => (current: Set<string>) =>
                new Set([...current].filter((name) => !names.includes(name)))
            setSkills(without(result.imported.skills))
            setMcps(without(result.imported.mcps))
            const importedRules = tickedRules
                .filter((row: ImportPreviewRule) => result.imported.rules.includes(row.name))
                .map((row) => row.path)
            setRules(without(importedRules))
            setSkipped(result.skipped)
        } catch (failure) {
            setError(connectionErrorMessage(failure, 'Could not import the setup.'))
        }
    }

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault()
                // the modal is portaled, so stop the submit reaching a form behind it
                event.stopPropagation()
                void submit()
            }}
            className="flex flex-col gap-4"
        >
            <div className="flex flex-col gap-4 max-h-[46vh] overflow-y-auto no-scrollbar">
                {isEmpty && <p className="text-[13px] text-[#7B7A79]">Nothing to import here.</p>}
                {preview.skills.length > 0 && (
                    <FoundSection title="Skills">
                        {preview.skills.map((row) => (
                            <FoundRow
                                key={row.name}
                                label={`Import skill ${row.name}`}
                                name={row.name}
                                detail={row.description}
                                note={row.reason}
                                exists={row.exists}
                                importable={row.importable}
                                checked={skills.has(row.name)}
                                onChange={toggle(setSkills, row.name)}
                            />
                        ))}
                        {preview.truncated && (
                            <p className="text-[12.5px] text-[#7B7A79]">
                                Only the first 50 skills are listed.
                            </p>
                        )}
                    </FoundSection>
                )}
                {preview.mcps.length > 0 && (
                    <FoundSection title="MCPs">
                        {preview.mcps.map((row) => (
                            <FoundRow
                                key={row.name}
                                label={`Import MCP ${row.name}`}
                                name={row.name}
                                detail={row.url ?? undefined}
                                note={row.reason ?? row.note}
                                exists={row.exists}
                                importable={row.importable}
                                checked={mcps.has(row.name)}
                                onChange={toggle(setMcps, row.name)}
                            />
                        ))}
                    </FoundSection>
                )}
                {preview.rules.length > 0 && (
                    <FoundSection title="Rules">
                        {preview.rules.map((row) => (
                            <FoundRow
                                key={row.path}
                                label={`Import rule ${row.path}`}
                                name={row.path}
                                detail={`Saved as ${row.name}`}
                                note={row.reason}
                                exists={row.exists}
                                importable={row.importable}
                                checked={rules.has(row.path)}
                                onChange={toggle(setRules, row.path)}
                            />
                        ))}
                    </FoundSection>
                )}
            </div>
            {skipped.length > 0 && (
                <div className="flex flex-col gap-1">
                    {skipped.map((row) => (
                        <FormError key={`${row.kind}:${row.name}`}>
                            {`${row.name}: ${row.reason}`}
                        </FormError>
                    ))}
                </div>
            )}
            <FormError>{error}</FormError>
            <ModalActions
                onCancel={onCancel}
                submitLabel="Import"
                submitDisabled={tickedCount === 0}
                isPending={importSetup.isPending}
            />
        </form>
    )
}

/**
 * Import setup (N24, #637 section 6): pick a repository, see the skills, MCP servers and
 * rules files it has, and import the ticked ones. The server reads the repository: the
 * dialog only sends names.
 */
export const ImportSetupModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
    const [repo, setRepo] = React.useState<ImportRepo | null>(null)
    const preview = useImportPreview(isOpen ? repo : null)

    const close = () => {
        setRepo(null)
        onClose()
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={close}
            title={TITLE}
            description={DESCRIPTION}
            variant="premium"
            maxWidth="max-w-[420px]"
            showLogo={false}
            sheetOnPhone
        >
            <div role="group" aria-label={TITLE} className="flex flex-col gap-4">
                {repo === null ? (
                    <div className="flex flex-col gap-1.5">
                        <span className={fieldLabelClass}>Repository</span>
                        <div className="flex flex-col max-h-[46vh] overflow-y-auto no-scrollbar -mx-2">
                            <RepoSideList
                                onPick={(picked) =>
                                    setRepo({
                                        repoFullName: picked.fullName,
                                        provider: picked.provider ?? 'GITHUB',
                                    })
                                }
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between gap-3 text-[13px]">
                            <span className="truncate text-[#D6D5C9]">{repo.repoFullName}</span>
                            <button
                                type="button"
                                onClick={() => setRepo(null)}
                                className={quietLinkClass}
                            >
                                Change
                            </button>
                        </div>
                        {preview.isPending && (
                            <p className="text-[13px] text-[#7B7A79]">Reading the repository...</p>
                        )}
                        {preview.isError && (
                            <FormError>
                                {connectionErrorMessage(
                                    preview.error,
                                    'Could not read the repository.'
                                )}
                            </FormError>
                        )}
                        {preview.data && (
                            <FoundLists preview={preview.data} onCancel={close} onDone={close} />
                        )}
                    </>
                )}
            </div>
        </Modal>
    )
}
