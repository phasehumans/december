import { useQuery } from '@tanstack/react-query'
import React from 'react'

import { sessionFilesAPI } from '@/features/preview/api/sessionFiles'
import { Skeleton } from '@/shared/components/ui/Skeleton'

// longer files show their first lines only, so a large file cannot freeze the tab
const MAX_LINES = 5000

interface FileWorkspaceProps {
    sessionId?: string
    path: string
}

/** the file tab: one file of the session workspace, read only (the /open command) */
export const FileWorkspace: React.FC<FileWorkspaceProps> = ({ sessionId, path }) => {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['session-file', sessionId, path],
        queryFn: () => sessionFilesAPI.getSessionFile(sessionId as string, path),
        enabled: Boolean(sessionId && path),
    })

    const lines = React.useMemo(() => (data?.content ? data.content.split('\n') : []), [data])
    const shown = lines.length > MAX_LINES ? lines.slice(0, MAX_LINES) : lines

    return (
        <div data-testid="file-workspace" className="flex-1 min-h-0 flex flex-col bg-[#141414]">
            <div className="h-9 shrink-0 flex items-center px-4 border-b border-[#242323]">
                <span className="truncate font-mono text-[12px] text-[#8F8E8D]" title={path}>
                    {path}
                </span>
            </div>

            {isLoading ? (
                <div className="p-4 flex flex-col gap-2.5" aria-busy="true">
                    {[52, 38, 64, 30, 46].map((width) => (
                        <Skeleton
                            key={width}
                            className="h-2.5 bg-white/[0.05] rounded"
                            style={{ width: `${width}%` }}
                        />
                    ))}
                </div>
            ) : isError ? (
                <div className="p-4 text-[12.5px] text-[#8F8E8D]">Could not load the file.</div>
            ) : lines.length === 0 ? (
                <div className="p-4 text-[12.5px] text-[#8F8E8D]">Empty or not found.</div>
            ) : (
                <div className="flex-1 min-h-0 overflow-auto">
                    <div className="flex min-w-max py-2 font-mono text-[12.5px] leading-[1.65]">
                        <pre
                            aria-hidden="true"
                            className="sticky left-0 shrink-0 select-none bg-[#141414] pl-3 pr-3 text-right text-[12px] text-[#6B7280]"
                        >
                            {shown.map((_, index) => index + 1).join('\n')}
                        </pre>
                        <pre className="pr-6 text-[#D6D5D4] select-text">{shown.join('\n')}</pre>
                    </div>
                    {lines.length > MAX_LINES && (
                        <div className="px-4 pb-3 text-[12px] text-[#8F8E8D]">
                            First {MAX_LINES} of {lines.length} lines.
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
