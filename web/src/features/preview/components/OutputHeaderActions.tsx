import React from 'react'
import { Download, Globe, Share2, Settings } from 'lucide-react'

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
    activeVersionId,
    isVersionLoading = false,
    onDownload,
}) => {
    const isDownloadDisabled = !activeVersionId || isVersionLoading

    return (
        <div className="flex items-center gap-3">
            <div className="hidden lg:flex flex-col items-end leading-none mr-1">
                {/* <span className="max-w-[220px] truncate text-[11px] font-medium uppercase tracking-[0.2em] text-[#6F6E6D]">
                    {projectName ?? 'Project'}
                </span> */}
            </div>

            <div className="flex items-center gap-0.5">
                <Button
                    variant="ghost"
                    size="icon"
                    title="Settings"
                    className="text-[#91908F] hover:text-white hidden md:flex h-8 w-8"
                >
                    <Settings size={16} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    title="Share"
                    className="text-[#91908F] hover:text-white hidden md:flex h-8 w-8"
                >
                    <Share2 size={16} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    title="Download Code"
                    className="text-[#91908F] hover:text-white hidden md:flex h-8 w-8"
                    onClick={onDownload}
                    disabled={isDownloadDisabled}
                >
                    <Download size={16} />
                </Button>

                <Button className="ml-2 bg-[#171615] text-[#D6D5D4] border border-[#363534] rounded-xl font-medium hidden md:flex px-4 py-1.5 h-auto transition-colors">
                    Publish
                </Button>
            </div>
        </div>
    )
}
