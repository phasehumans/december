import React from 'react'
import { Download, Github, Globe } from 'lucide-react'
import { Button } from '@/shared/components/ui/Button'
import type { BackendProjectVersionSummary } from '@/features/projects/api/project'

interface OutputHeaderActionsProps {
    projectName?: string | null
    versions?: BackendProjectVersionSummary[]
    activeVersionId?: string | null
    isVersionLoading?: boolean
    onSelectVersion?: (versionId: string) => void
    onDownload?: () => void
}

export const OutputHeaderActions: React.FC<OutputHeaderActionsProps> = ({
    projectName,
    versions = [],
    activeVersionId,
    isVersionLoading = false,
    onSelectVersion,
    onDownload,
}) => {
    const activeVersion = versions.find((version) => version.id === activeVersionId) ?? versions[0]
    const isDownloadDisabled = !activeVersionId || isVersionLoading

    return (
        <div className="flex items-center gap-3">
            <div className="hidden lg:flex flex-col items-end leading-none mr-1">
                <span className="max-w-[180px] truncate text-[11px] font-medium uppercase tracking-[0.2em] text-[#6F6E6D]">
                    {projectName ?? 'Project'}
                </span>
                <span className="text-xs text-[#A1A09F]">
                    {activeVersion
                        ? `${activeVersion.label} � ${activeVersion.fileCount} files`
                        : 'No version'}
                </span>
            </div>

            <select
                value={activeVersionId ?? ''}
                onChange={(event) => onSelectVersion?.(event.target.value)}
                disabled={versions.length === 0 || isVersionLoading}
                className="hidden md:flex h-9 min-w-[132px] rounded-xl border border-white/10 bg-[#151515] px-3 text-sm text-[#E8E8E6] outline-none disabled:opacity-50"
            >
                {versions.length === 0 ? (
                    <option value="">No versions</option>
                ) : (
                    versions.map((version) => (
                        <option key={version.id} value={version.id}>
                            {version.label}
                        </option>
                    ))
                )}
            </select>

            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    title="Download Code"
                    className="text-[#91908F] hover:text-white hidden md:flex"
                    onClick={onDownload}
                    disabled={isDownloadDisabled}
                >
                    <Download size={16} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    title="Sync to GitHub"
                    className="text-[#91908F] hover:text-white hidden md:flex"
                >
                    <Github size={16} />
                </Button>

                <Button
                    variant="primary"
                    size="sm"
                    className="ml-1 shadow-lg shadow-white/5 bg-white hover:bg-neutral-200 text-black border-none rounded-xl font-semibold hidden md:flex"
                >
                    <Globe size={14} className="mr-2" />
                    Publish
                </Button>
            </div>
        </div>
    )
}
