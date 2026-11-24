import React from 'react'

import { MetaDot, RelativeTime } from './ListParts'

import { repoNameOf } from '@/features/pullrequests/lib/pullRequests'
import { Tooltip } from '@/shared/components/ui/Tooltip'

/** the grey line under a session title: repo · branch · time. the time is the last update,
 * or the created time when the list is sorted by created date */
export const ListMeta: React.FC<{ session: any; timeField?: 'updated' | 'created' }> = ({
    session,
    timeField = 'updated',
}) => {
    const showCreated = timeField === 'created' && Boolean(session.createdAt)
    const repo = repoNameOf(session)
    const shortRepo = repo ? repo.split('/').pop() : null
    return (
        <div className="flex items-center gap-1.5 min-w-0 text-[12px] text-[#7B7A79]">
            {shortRepo ? (
                <>
                    <span className="truncate shrink-[2]" title={repo ?? undefined}>
                        {shortRepo}
                    </span>
                    {session.branch && (
                        <>
                            <MetaDot />
                            <span className="truncate font-mono text-[11.5px]">
                                {session.branch}
                            </span>
                        </>
                    )}
                </>
            ) : (
                <span className="truncate">No repository</span>
            )}
            <MetaDot />
            <span className="shrink-0">
                {showCreated ? (
                    <>
                        Created <RelativeTime iso={session.createdAt} label="Created" />
                    </>
                ) : (
                    <RelativeTime iso={session.updatedAt || session.createdAt} label="Updated" />
                )}
            </span>
        </div>
    )
}

/** the first tag, then "+2" when there are more */
export const SessionTags: React.FC<{
    tags?: string[] | null
    onEdit?: (event: React.MouseEvent) => void
}> = ({ tags, onEdit }) => {
    if (!tags || tags.length === 0) return null
    const rest = tags.length - 1
    return (
        <span className="flex items-center gap-1 min-w-0">
            <Tooltip position="top" content={`Tags: ${tags.join(', ')}`}>
                <span
                    onDoubleClick={onEdit}
                    className="truncate max-w-[120px] rounded-md bg-[#202020] border border-white/5 px-2 py-0.5 text-[11px] font-medium text-[#949494] transition-colors hover:bg-[#272727] hover:text-white"
                    title={onEdit ? 'Double-click to edit tags' : undefined}
                >
                    {tags[0]}
                </span>
            </Tooltip>
            {rest > 0 && (
                <span className="text-[11px] text-[#6B6A69] tabular-nums shrink-0">+{rest}</span>
            )}
        </span>
    )
}
