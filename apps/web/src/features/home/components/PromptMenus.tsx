import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight } from 'lucide-react'
import React from 'react'

import type { GithubRepo } from '@/features/profile/api/profile'
import type { BackendSession } from '@/features/sessions/api/session'

import { useConnectionsStore } from '@/features/connections/hooks/useConnectionsStore'
import { isPromptConfigChanged, usePromptConfig } from '@/features/home/promptConfig'
import { profileAPI } from '@/features/profile/api/profile'
import { secretsAPI } from '@/features/profile/api/secrets'
import { useGithubConnection } from '@/features/profile/hooks/useGithubConnection'
import { sessionAPI } from '@/features/sessions/api/session'
import { formatRelativeTime } from '@/shared/lib/relativeTime'
import { cn } from '@/shared/lib/utils'

// rows shown inside the prompt box menus: the lists beside the + menu and the
// configuration menu. the same rows go in the desktop menu and in the phone bottom sheet.

const rowClass =
    'flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl text-[12.5px] font-medium text-[#EDEDEF] min-w-0'
const pickRowClass =
    'flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl text-left text-[12.5px] font-medium text-[#EDEDEF] hover:bg-[#252525] transition-colors outline-none w-full min-w-0 cursor-pointer'
const quietRowClass =
    'flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl text-left text-[12.5px] font-medium text-[#8F8E8D] hover:text-[#D6D5D4] hover:bg-[#252525] transition-colors outline-none w-full cursor-pointer'
const emptyClass = 'px-3 py-2 text-center text-[12.5px] text-[#8F8E8D]'
const hintClass = 'shrink-0 text-[12px] font-normal text-[#8F8E8D]'

// lists longer than this get a search box
const SEARCH_FROM = 7
const LIST_LIMIT = 10

/** the "Soon" tag, the same as on Super Crew in the sidebar */
export const SoonTag: React.FC = () => (
    <span className="text-[10px] font-medium text-[#919191] border border-[#383735] rounded-full px-1.5 leading-4 shrink-0">
        Soon
    </span>
)

/** the small switch from the sidebar "Archived" filter */
export const MiniSwitch: React.FC<{
    checked: boolean
    onChange: (checked: boolean) => void
    label: string
}> = ({ checked, onChange, label }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={(event) => {
            event.stopPropagation()
            onChange(!checked)
        }}
        className={cn(
            'w-7 h-[14px] rounded-full flex items-center px-[2px] transition-colors shrink-0 outline-none cursor-pointer',
            checked ? 'bg-[#87B2F4]' : 'bg-[#333333]'
        )}
    >
        <span
            className={cn(
                'w-[10px] h-[10px] rounded-full bg-white transition-transform',
                checked ? 'translate-x-[14px]' : 'translate-x-0'
            )}
        />
    </button>
)

export const ListSearch: React.FC<{
    value: string
    onChange: (value: string) => void
    label: string
}> = ({ value, onChange, label }) => (
    <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        aria-label={label}
        className="mx-1 mt-1 mb-1 px-2.5 py-1.5 rounded-lg bg-[#141414] border border-[#2A2928] text-[12px] text-[#EDEDEF] placeholder:text-[#6F6E6D] outline-none focus:border-[#3A3938]"
    />
)

const CONFIG_LABELS = ['Plan first', 'Open pull request']

/**
 * Configuration for one session: Plan first and Open pull request.
 * The server does not read these yet, so outside demo mode the rows show "Soon".
 */
export const PromptConfigRows: React.FC<{ demo: boolean; mode: 'agent' | 'chat' }> = ({
    demo,
    mode,
}) => {
    const values = usePromptConfig((s) => s.values)
    const setValue = usePromptConfig((s) => s.setValue)
    const saveAsDefault = usePromptConfig((s) => s.saveAsDefault)
    const resetValues = usePromptConfig((s) => s.resetValues)
    const isChanged = usePromptConfig(isPromptConfigChanged)
    const [isSaved, setIsSaved] = React.useState(false)
    const savedTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    React.useEffect(
        () => () => {
            if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
        },
        []
    )

    // "Saved" shows in place of the label for two seconds. no toast
    const flashSaved = () => {
        setIsSaved(true)
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
        savedTimerRef.current = setTimeout(() => setIsSaved(false), 2000)
    }

    if (!demo) {
        return (
            <>
                {CONFIG_LABELS.map((label) => (
                    <div key={label} className={rowClass} aria-disabled="true">
                        <span className="opacity-50">{label}</span>
                        <SoonTag />
                    </div>
                ))}
            </>
        )
    }

    return (
        <>
            <div className={rowClass}>
                <span>Plan first</span>
                <MiniSwitch
                    label="Plan first"
                    checked={values.planFirst}
                    onChange={(checked) => setValue('planFirst', checked)}
                />
            </div>
            {mode === 'chat' ? (
                // a running session cannot change this: it is fixed when the session starts
                <div className={rowClass} aria-disabled="true">
                    <span className="opacity-50">Open pull request</span>
                    <span className={cn(hintClass, 'opacity-70')}>Set at start</span>
                </div>
            ) : (
                <div className={rowClass}>
                    <span>Open pull request</span>
                    <MiniSwitch
                        label="Open pull request"
                        checked={values.openPullRequest}
                        onChange={(checked) => setValue('openPullRequest', checked)}
                    />
                </div>
            )}

            {mode !== 'chat' && (
                <>
                    <div className="h-px bg-[#2B2A29] mx-1 my-1" />
                    <button
                        type="button"
                        onClick={() => {
                            saveAsDefault()
                            flashSaved()
                        }}
                        className={quietRowClass}
                    >
                        {isSaved ? 'Saved' : 'Set as default'}
                    </button>
                    {isChanged && (
                        <button type="button" onClick={resetValues} className={quietRowClass}>
                            Reset
                        </button>
                    )}
                </>
            )}
        </>
    )
}

/** your repositories. a pick attaches the repo to the prompt */
export const RepoSideList: React.FC<{ onPick: (repo: GithubRepo) => void }> = ({ onPick }) => {
    const github = useGithubConnection(true)
    const [query, setQuery] = React.useState('')
    const { data: repos = [], isLoading } = useQuery({
        queryKey: ['github-repos'],
        queryFn: profileAPI.getGithubRepos,
        enabled: github.isConnected,
    })

    if (!github.isReady || isLoading) return <div className={emptyClass}>Loading...</div>
    if (!github.isConnected) {
        return (
            <div className="px-3 py-2 text-[12.5px] text-[#8F8E8D] leading-relaxed">
                <a
                    href={github.connectUrl}
                    className="text-[#87B2F4] hover:text-[#A4C8FF] hover:underline underline-offset-2 transition-colors font-medium"
                >
                    Connect GitHub
                </a>{' '}
                to see repos.
            </div>
        )
    }

    const needle = query.trim().toLowerCase()
    const owner = (repo: GithubRepo) => repo.owner?.login ?? repo.fullName?.split('/')[0] ?? ''
    const shown = repos
        .filter(
            (repo) =>
                !needle ||
                repo.name.toLowerCase().includes(needle) ||
                owner(repo).toLowerCase().includes(needle)
        )
        .slice(0, LIST_LIMIT)

    return (
        <>
            {repos.length >= SEARCH_FROM && (
                <ListSearch value={query} onChange={setQuery} label="Search repositories" />
            )}
            {shown.length === 0 ? (
                <div className={emptyClass}>No repos found.</div>
            ) : (
                shown.map((repo) => (
                    <button
                        key={repo.id}
                        type="button"
                        onClick={() => onPick(repo)}
                        className={pickRowClass}
                    >
                        <span className="truncate">{repo.name}</span>
                        <span className={cn(hintClass, 'truncate max-w-[45%]')}>{owner(repo)}</span>
                    </button>
                ))
            )}
        </>
    )
}

/** your sessions. a pick mentions the session in the prompt */
export const SessionSideList: React.FC<{ onPick: (session: BackendSession) => void }> = ({
    onPick,
}) => {
    const [query, setQuery] = React.useState('')
    const { data, isLoading } = useQuery({
        queryKey: ['sessions', 'mention'],
        queryFn: () => sessionAPI.getSessions({ limit: 30 }),
    })

    if (isLoading) return <div className={emptyClass}>Loading...</div>

    const sessions = data?.sessions || []
    const needle = query.trim().toLowerCase()
    const shown = sessions
        .filter(
            (session) =>
                !needle || (session.title || 'Untitled Session').toLowerCase().includes(needle)
        )
        .slice(0, LIST_LIMIT)

    return (
        <>
            {sessions.length >= SEARCH_FROM && (
                <ListSearch value={query} onChange={setQuery} label="Search sessions" />
            )}
            {shown.length === 0 ? (
                <div className={emptyClass}>No sessions found.</div>
            ) : (
                shown.map((session) => (
                    <button
                        key={session.id}
                        type="button"
                        onClick={() => onPick(session)}
                        className={pickRowClass}
                    >
                        <span className="truncate">{session.title || 'Untitled Session'}</span>
                        <span className={hintClass}>{formatRelativeTime(session.updatedAt)}</span>
                    </button>
                ))
            )}
        </>
    )
}

/** your stored secrets. a pick mentions the secret in the prompt */
export const SecretSideList: React.FC<{ onPick: (secret: { name: string }) => void }> = ({
    onPick,
}) => {
    const { data, isLoading } = useQuery({
        queryKey: ['secrets', 'mention'],
        queryFn: secretsAPI.getSecrets,
    })

    if (isLoading) return <div className={emptyClass}>Loading...</div>
    const secrets = data?.secrets || []
    if (secrets.length === 0) return <div className={emptyClass}>No secrets found.</div>

    return (
        <>
            {secrets.slice(0, LIST_LIMIT).map((secret) => (
                <button
                    key={secret.id}
                    type="button"
                    onClick={() => onPick(secret)}
                    className={pickRowClass}
                >
                    <span className="truncate">{secret.name}</span>
                </button>
            ))}
        </>
    )
}

/** skills that are turned on. a pick adds the skill to the prompt as a chip */
export const SkillSideList: React.FC<{
    onPick: (name: string) => void
    onManage: () => void
}> = ({ onPick, onManage }) => {
    const skills = useConnectionsStore((s) => s.skills).filter((skill) => skill.enabled)

    if (skills.length === 0) {
        return (
            <>
                <div className={emptyClass}>No skills yet.</div>
                <button type="button" onClick={onManage} className={quietRowClass}>
                    <span>Add a skill</span>
                    <ArrowUpRight className="w-[13px] h-[13px] shrink-0" />
                </button>
            </>
        )
    }

    return (
        <>
            {skills.map((skill) => (
                <button
                    key={skill.name}
                    type="button"
                    onClick={() => onPick(skill.name)}
                    className={pickRowClass}
                >
                    <span className="truncate">{skill.name}</span>
                </button>
            ))}
        </>
    )
}

/** installed plugins, each with a switch that turns it off for this session only */
export const PluginSessionList: React.FC<{ onBrowse: () => void }> = ({ onBrowse }) => {
    const plugins = useConnectionsStore((s) => s.plugins).filter(
        (plugin) => plugin.installed && plugin.enabled
    )
    const pluginsOff = usePromptConfig((s) => s.pluginsOff)
    const setPluginOff = usePromptConfig((s) => s.setPluginOff)

    if (plugins.length === 0) {
        return (
            <>
                <div className={emptyClass}>No plugins installed.</div>
                <button type="button" onClick={onBrowse} className={quietRowClass}>
                    <span>Browse plugins</span>
                    <ArrowUpRight className="w-[13px] h-[13px] shrink-0" />
                </button>
            </>
        )
    }

    return (
        <>
            {plugins.map((plugin) => (
                <div key={plugin.name} className={rowClass}>
                    <span className="truncate">{plugin.name}</span>
                    <MiniSwitch
                        label={`Use ${plugin.name} in this session`}
                        checked={!pluginsOff.includes(plugin.name)}
                        onChange={(checked) => setPluginOff(plugin.name, !checked)}
                    />
                </div>
            ))}
        </>
    )
}

/** MCP servers, each with a switch that turns it off for this session only */
export const McpSessionList: React.FC<{ onManage: () => void }> = ({ onManage }) => {
    const mcps = useConnectionsStore((s) => s.mcps).filter((mcp) => mcp.enabled)
    const mcpsOff = usePromptConfig((s) => s.mcpsOff)
    const setMcpOff = usePromptConfig((s) => s.setMcpOff)

    if (mcps.length === 0) {
        return (
            <>
                <div className={emptyClass}>No MCP servers.</div>
                <button type="button" onClick={onManage} className={quietRowClass}>
                    <span>Add MCP server</span>
                    <ArrowUpRight className="w-[13px] h-[13px] shrink-0" />
                </button>
            </>
        )
    }

    return (
        <>
            {mcps.map((mcp) => (
                <div key={mcp.name} className={rowClass}>
                    <span className="flex flex-col min-w-0">
                        <span className="truncate">{mcp.name}</span>
                        {mcp.status === 'error' && mcp.lastError && (
                            <span className="text-[11.5px] font-normal text-[#8F8E8D] truncate">
                                {mcp.lastError}
                            </span>
                        )}
                    </span>
                    {mcp.status === 'needs-signin' ? (
                        <button
                            type="button"
                            onClick={onManage}
                            className="text-[12px] font-medium text-[#87B2F4] hover:text-[#A4C8FF] transition-colors outline-none cursor-pointer shrink-0"
                        >
                            Sign in
                        </button>
                    ) : (
                        <MiniSwitch
                            label={`Use ${mcp.name} in this session`}
                            checked={!mcpsOff.includes(mcp.name)}
                            onChange={(checked) => setMcpOff(mcp.name, !checked)}
                        />
                    )}
                </div>
            ))}
        </>
    )
}
