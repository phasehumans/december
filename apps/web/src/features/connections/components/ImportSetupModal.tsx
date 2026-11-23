import React from 'react'

import { ModalActions, fieldLabelClass } from './ConnectionsUi'

import { SettingsSelect } from '@/features/profile/components/SettingsUi'
import { Modal } from '@/shared/components/ui/Modal'

// sample values for the ui-only dialog. reading a repository is server work (issue 637)
const REPOSITORIES = ['acme/web', 'acme/api'] as const
const FOUND: Record<string, [string, string][]> = {
    'acme/web': [
        ['Skills', '6 found'],
        ['MCPs', '3 found'],
        ['Rules', 'AGENTS.md'],
    ],
    'acme/api': [
        ['Skills', '2 found'],
        ['MCPs', 'None'],
        ['Rules', 'CLAUDE.md'],
    ],
}

/**
 * Import setup (N24): read a repository for the skills, MCP servers and rules that other
 * agents keep there, and add them to Connections. Ui only: nothing is read or imported.
 */
export const ImportSetupModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
    isOpen,
    onClose,
}) => {
    const [repo, setRepo] = React.useState<string>(REPOSITORIES[0])

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Import setup"
            description="Bring in the skills, MCP servers and rules a repository has."
            variant="premium"
            showLogo={false}
            sheetOnPhone
        >
            <form
                onSubmit={(event) => {
                    event.preventDefault()
                    // the modal is portaled, so stop the submit reaching a form behind it
                    event.stopPropagation()
                    onClose()
                }}
                className="flex flex-col gap-4"
            >
                <div className="flex flex-col gap-1.5">
                    <span className={fieldLabelClass}>Repository</span>
                    <SettingsSelect
                        label="Repository"
                        value={repo}
                        options={REPOSITORIES}
                        onChange={setRepo}
                        className="w-full"
                    />
                </div>
                <div className="flex flex-col gap-2 text-[13px]">
                    {(FOUND[repo] ?? []).map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between gap-3">
                            <span className="text-[#D6D5C9]">{label}</span>
                            <span className="text-[#7B7A79]">{value}</span>
                        </div>
                    ))}
                </div>
                <ModalActions onCancel={onClose} submitLabel="Import" />
            </form>
        </Modal>
    )
}
