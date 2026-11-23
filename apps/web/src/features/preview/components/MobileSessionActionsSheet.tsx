import { Archive, ArchiveRestore, ExternalLink, Pencil, Tag } from 'lucide-react'
import React from 'react'

import { BottomSheet, SheetHeader, SheetRow } from '@/shared/components/ui/BottomSheet'
import { Icons } from '@/shared/components/ui/Icons'

type Level = 'root' | 'rename' | 'tags'

interface MobileSessionActionsSheetProps {
    isOpen: boolean
    onClose: () => void
    title: string
    tag: string | null
    /** null when the session has no pull request: hides the chip and the row */
    prLabel: string | null
    onOpenPullRequest: () => void
    onRename: (title: string) => void
    onSaveTags: (tags: string[]) => void
    isSavingTags: boolean
    onDownload?: () => void
    isArchived: boolean
    onToggleArchive: () => void
}

const inputClass =
    'w-full bg-[#161616] border border-[#3A3A3A] rounded-[9px] px-3 py-2.5 text-[14px] text-[#EDEDED] outline-none focus:border-[#4A4A4A] placeholder:text-[#5A5A5A]'
const saveClass =
    'w-full h-10 rounded-[10px] bg-[#E8E8E8] active:bg-white text-[#141414] text-[14px] font-medium cursor-pointer outline-none disabled:opacity-60 disabled:cursor-default'

const PrIcon: React.FC = () => (
    <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        className="w-[17px] h-[17px] shrink-0"
    >
        <circle cx="5" cy="4" r="1.5" />
        <circle cx="5" cy="12" r="1.5" />
        <circle cx="11" cy="6" r="1.5" />
        <path
            d="M5 5.5v5M11 7.5v1.5a3 3 0 0 1-3 3H6.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
)

// session ⋯ sheet on phones: tag and PR # on top, then rename, tags, pull request,
// download and archive. rename and tags open as a second level inside the sheet.
export const MobileSessionActionsSheet: React.FC<MobileSessionActionsSheetProps> = ({
    isOpen,
    onClose,
    title,
    tag,
    prLabel,
    onOpenPullRequest,
    onRename,
    onSaveTags,
    isSavingTags,
    onDownload,
    isArchived,
    onToggleArchive,
}) => {
    const [level, setLevel] = React.useState<Level>('root')
    const [confirmArchive, setConfirmArchive] = React.useState(false)
    const [titleInput, setTitleInput] = React.useState('')
    const [tagInput, setTagInput] = React.useState('')

    // every open starts fresh at the root
    React.useEffect(() => {
        if (!isOpen) {
            setLevel('root')
            setConfirmArchive(false)
        }
    }, [isOpen])

    const handleBack = React.useCallback(() => {
        if (level === 'root') return false
        setLevel('root')
        return true
    }, [level])

    const openRename = () => {
        setTitleInput(title)
        setLevel('rename')
    }

    const openTags = () => {
        setTagInput(tag ?? '')
        setLevel('tags')
    }

    const saveRename = (e: React.FormEvent) => {
        e.preventDefault()
        onRename(titleInput)
        onClose()
    }

    const saveTags = (e: React.FormEvent) => {
        e.preventDefault()
        if (isSavingTags) return
        const trimmed = tagInput.trim()
        onSaveTags(trimmed ? [trimmed] : [])
        onClose()
    }

    const handleArchive = () => {
        if (!confirmArchive) {
            setConfirmArchive(true)
            return
        }
        onToggleArchive()
        onClose()
    }

    let header: React.ReactNode
    let body: React.ReactNode
    if (level === 'rename') {
        header = <SheetHeader title="Rename" onBack={() => setLevel('root')} />
        body = (
            <form onSubmit={saveRename} className="flex flex-col gap-2.5 px-1 pb-1">
                <input
                    type="text"
                    autoFocus
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className={inputClass}
                    aria-label="Session name"
                />
                <button type="submit" className={saveClass} disabled={!titleInput.trim()}>
                    Save
                </button>
            </form>
        )
    } else if (level === 'tags') {
        header = <SheetHeader title="Edit tags" onBack={() => setLevel('root')} />
        body = (
            <form onSubmit={saveTags} className="flex flex-col gap-2.5 px-1 pb-1">
                <div className="relative flex items-center">
                    <input
                        type="text"
                        autoFocus
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value.slice(0, 30))}
                        className={`${inputClass} pr-10`}
                        placeholder="Tag"
                        aria-label="Tag"
                        disabled={isSavingTags}
                    />
                    {tagInput.trim() && (
                        <button
                            type="button"
                            onClick={() => setTagInput('')}
                            aria-label="Clear tag"
                            className="absolute right-2 w-7 h-7 flex items-center justify-center rounded-md text-[#7B7A79] cursor-pointer outline-none"
                        >
                            <Icons.X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                <button type="submit" className={saveClass} disabled={isSavingTags}>
                    Save
                </button>
            </form>
        )
    } else {
        header = (
            <div className="flex flex-col gap-2 px-3.5 pb-2.5">
                <span className="text-[14px] font-semibold text-[#EDEDED] truncate">{title}</span>
                <div className="flex items-center justify-between gap-2">
                    {tag ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono text-[#949494] border border-[#2A2928] truncate">
                            {tag}
                        </span>
                    ) : (
                        <span />
                    )}
                    {prLabel && (
                        <button
                            type="button"
                            onClick={onOpenPullRequest}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1C1A22] border border-[#2E2838] text-[11px] font-mono font-medium text-[#C084FC] cursor-pointer outline-none shrink-0"
                        >
                            <svg
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.3"
                                className="w-3 h-3 shrink-0"
                            >
                                <circle cx="5" cy="4" r="1.5" />
                                <circle cx="5" cy="12" r="1.5" />
                                <circle cx="11" cy="6" r="1.5" />
                                <path
                                    d="M5 5.5v5M11 7.5v1.5a3 3 0 0 1-3 3H6.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                            {prLabel}
                        </button>
                    )}
                </div>
            </div>
        )
        body = (
            <div className="flex flex-col gap-0.5 pb-1">
                <SheetRow
                    icon={<Pencil className="w-[17px] h-[17px]" />}
                    label="Rename"
                    onClick={openRename}
                />
                <SheetRow
                    icon={<Tag className="w-[17px] h-[17px]" />}
                    label="Edit tags"
                    onClick={openTags}
                />
                {prLabel && (
                    <SheetRow
                        icon={<PrIcon />}
                        label="Open pull request"
                        trailing={<ExternalLink className="w-3.5 h-3.5 text-[#7B7A79]" />}
                        onClick={() => {
                            onOpenPullRequest()
                            onClose()
                        }}
                    />
                )}
                {onDownload && (
                    <SheetRow
                        icon={<Icons.Download className="w-[17px] h-[17px]" />}
                        label="Download ZIP"
                        onClick={() => {
                            onDownload()
                            onClose()
                        }}
                    />
                )}
                <SheetRow
                    icon={
                        isArchived ? (
                            <ArchiveRestore className="w-[17px] h-[17px]" />
                        ) : (
                            <Archive className="w-[17px] h-[17px]" />
                        )
                    }
                    label={
                        confirmArchive
                            ? `Tap again to ${isArchived ? 'unarchive' : 'archive'}`
                            : isArchived
                              ? 'Unarchive'
                              : 'Archive'
                    }
                    confirm={confirmArchive}
                    onClick={handleArchive}
                />
            </div>
        )
    }

    return (
        <BottomSheet
            isOpen={isOpen}
            onClose={onClose}
            onBack={handleBack}
            header={header}
            ariaLabel="Session actions"
        >
            {body}
        </BottomSheet>
    )
}
