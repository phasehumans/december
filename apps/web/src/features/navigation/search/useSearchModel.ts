import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { scoreItem } from './fuzzy'
import {
    CLI_INSTALL_COMMAND,
    GROUP_LIMIT,
    SETTINGS_PAGES,
    compactTime,
    docsPages,
    sessionRepoLabel,
    type SearchGroup,
    type SearchItem,
    type SearchRow,
    type SearchSection,
} from './searchItems'

import type { BackendSession, BackendSessionDetail } from '@/features/sessions/api/session'

import { useAppStore } from '@/app/store'
import { requestHomePrefill } from '@/features/home/prefill'
import { profileAPI } from '@/features/profile/api/profile'
import { sessionAPI } from '@/features/sessions/api/session'
import { useSessions } from '@/features/sessions/hooks/useSessions'
import { getWebUrl } from '@/shared/config/env'

interface SearchModelOptions {
    isOpen: boolean
    query: string
    isAuthenticated?: boolean
    isMobile: boolean
    onNewThread?: () => void
    onOpenSession?: (sessionId: string) => void
    /** desktop only; leave out to hide the sidebar action */
    onToggleSidebar?: () => void
    isSidebarCollapsed?: boolean
}

const SESSION_SEARCH_DEBOUNCE_MS = 150
/** AI filters wait for a pause in typing, and only run for descriptions */
const AI_SEARCH_DEBOUNCE_MS = 500
const AI_SEARCH_MIN_WORDS = 2
const RECENT_SESSION_COUNT = 5

const useDebounced = (value: string, delay: number) => {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(timer)
    }, [value, delay])
    return debounced
}

const itemRow = (item: SearchItem, indexes: number[] = []): SearchRow => ({
    kind: 'item',
    item,
    indexes,
})

export const useSearchModel = (options: SearchModelOptions) => {
    const {
        isOpen,
        query,
        isAuthenticated,
        isMobile,
        onNewThread,
        onOpenSession,
        onToggleSidebar,
        isSidebarCollapsed,
    } = options
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const activeSessionId = useAppStore((s) => s.activeProjectId)

    const trimmed = query.trim()
    const isCommandMode = trimmed.startsWith('>')
    const searchText = isCommandMode ? trimmed.slice(1).trim() : trimmed
    const debouncedSearch = useDebounced(
        isCommandMode ? '' : searchText,
        SESSION_SEARCH_DEBOUNCE_MS
    )

    const { data: recentData } = useSessions(undefined, { enabled: Boolean(isAuthenticated) })
    const { data: searchData, isFetching: isTitleSearchFetching } = useQuery({
        queryKey: ['sessions', 'search-modal', debouncedSearch],
        queryFn: () =>
            sessionAPI.getSessions({
                type: 'WEB',
                search: debouncedSearch,
                searchIn: 'title',
                isArchived: false,
                limit: GROUP_LIMIT.Sessions,
            }),
        enabled: Boolean(isOpen && isAuthenticated && debouncedSearch),
        staleTime: 30_000,
    })
    const { data: repos = [] } = useQuery({
        queryKey: ['github-repos'],
        queryFn: profileAPI.getGithubRepos,
        enabled: Boolean(isOpen && isAuthenticated),
        staleTime: 5 * 60_000,
        retry: false,
    })

    const startNewSession = useMemo(
        () => () => {
            if (onNewThread) onNewThread()
            else navigate('/')
        },
        [onNewThread, navigate]
    )

    const sessionItem = useMemo(
        () =>
            (session: BackendSession): SearchItem => ({
                id: `session-${session.id}`,
                group: 'Sessions',
                label: session.title || session.projectName || 'Untitled session',
                repo: isMobile ? null : sessionRepoLabel(session),
                time: compactTime(session.updatedAt),
                href: `${window.location.origin}/sessions/${session.id}`,
                run: () => onOpenSession?.(session.id),
            }),
        [isMobile, onOpenSession]
    )

    const recentSessions = useMemo(
        () => (recentData?.sessions ?? []).filter((s) => !s.isArchived && s.type !== 'SEARCH'),
        [recentData?.sessions]
    )

    const actions = useMemo<SearchItem[]>(() => {
        const list: SearchItem[] = [
            {
                id: 'action-new-session',
                group: 'Actions',
                label: 'New session',
                keywords: ['home', 'start', 'create', 'chat', 'prompt'],
                run: startNewSession,
            },
        ]
        if (isAuthenticated && activeSessionId) {
            const detailOrSession = queryClient.getQueryData<BackendSession | BackendSessionDetail>(
                ['session', activeSessionId]
            )
            const detailSession = !detailOrSession
                ? undefined
                : 'project' in detailOrSession
                  ? detailOrSession.project
                  : detailOrSession
            const cached =
                recentData?.sessions?.find((s) => s.id === activeSessionId) ?? detailSession
            const isArchived = Boolean(cached?.isArchived)
            list.push({
                id: 'action-archive',
                group: 'Actions',
                label: isArchived ? 'Unarchive this session' : 'Archive this session',
                keywords: ['archive', 'hide', 'session'],
                run: () => {
                    const request = isArchived
                        ? sessionAPI.unarchiveSession(activeSessionId)
                        : sessionAPI.archiveSession(activeSessionId)
                    request
                        .catch((err) => console.error('Failed to toggle archive:', err))
                        .finally(() => {
                            queryClient.invalidateQueries({ queryKey: ['sessions'] })
                            queryClient.invalidateQueries({
                                queryKey: ['session', activeSessionId],
                            })
                        })
                },
            })
        }
        if (onToggleSidebar) {
            list.push({
                id: 'action-sidebar',
                group: 'Actions',
                label: isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar',
                keywords: ['sidebar', 'toggle', 'hide', 'show'],
                run: onToggleSidebar,
            })
        }
        list.push({
            id: 'action-copy-cli',
            group: 'Actions',
            label: 'Copy CLI install command',
            keywords: ['cli', 'npm', 'install', 'terminal'],
            flashLabel: 'Copied',
            run: () => {
                navigator.clipboard?.writeText(CLI_INSTALL_COMMAND).catch((err) => {
                    console.error('Failed to copy the CLI install command:', err)
                })
            },
        })
        return list
    }, [
        startNewSession,
        isAuthenticated,
        activeSessionId,
        recentData?.sessions,
        queryClient,
        onToggleSidebar,
        isSidebarCollapsed,
    ])

    const navigation = useMemo<SearchItem[]>(() => {
        const docsHref = `${getWebUrl()}/docs`
        const list: SearchItem[] = []
        if (isAuthenticated) {
            list.push({
                id: 'nav-sessions',
                group: 'Navigation',
                label: 'Sessions',
                keywords: ['all sessions', 'history', 'projects', 'threads', 'chats'],
                href: `${window.location.origin}/sessions`,
                run: () => navigate('/sessions'),
            })
            list.push({
                id: 'nav-pull-requests',
                group: 'Navigation',
                label: 'Pull requests',
                keywords: ['prs', 'pr', 'github', 'review', 'merge'],
                href: `${window.location.origin}/pull-requests`,
                run: () => navigate('/pull-requests'),
            })
        }
        list.push({
            id: 'nav-docs',
            group: 'Navigation',
            label: 'Documentation',
            keywords: ['docs', 'help', 'guide', 'manual', 'reference'],
            href: docsHref,
            external: true,
            run: () => window.open(docsHref, '_blank', 'noopener,noreferrer'),
        })
        return list
    }, [isAuthenticated, navigate])

    const settings = useMemo<SearchItem[]>(
        () =>
            isAuthenticated
                ? SETTINGS_PAGES.map((page) => ({
                      id: `settings-${page.id}`,
                      group: 'Settings' as const,
                      label: page.label,
                      keywords: page.keywords,
                      href: `${window.location.origin}${page.path}`,
                      run: () => navigate(page.path),
                  }))
                : [],
        [isAuthenticated, navigate]
    )

    const docs = useMemo<SearchItem[]>(
        () =>
            docsPages(getWebUrl()).map((page) => ({
                ...page,
                group: 'Docs' as const,
                external: true,
                run: () => window.open(page.href, '_blank', 'noopener,noreferrer'),
            })),
        []
    )

    const repoItems = useMemo<SearchItem[]>(
        () =>
            isAuthenticated
                ? repos.map((repo) => ({
                      id: `repo-${repo.id}`,
                      group: 'Repositories' as const,
                      label: repo.name,
                      keywords: [repo.fullName.toLowerCase(), repo.owner.login.toLowerCase()],
                      run: () => {
                          startNewSession()
                          requestHomePrefill({ repo })
                      },
                  }))
                : [],
        [isAuthenticated, repos, startNewSession]
    )

    const plainSections = useMemo<SearchSection[]>(() => {
        if (!trimmed) {
            const result: SearchSection[] = []
            if (isAuthenticated && recentSessions.length > 0) {
                result.push({
                    key: 'recent',
                    title: 'Recent sessions',
                    rows: recentSessions
                        .slice(0, RECENT_SESSION_COUNT)
                        .map((s) => itemRow(sessionItem(s))),
                })
            }
            result.push(
                { key: 'actions', title: 'Actions', rows: actions.map((a) => itemRow(a)) },
                {
                    key: 'navigation',
                    title: 'Navigation',
                    rows: navigation.map((n) => itemRow(n)),
                }
            )
            if (settings.length > 0) {
                result.push({
                    key: 'settings',
                    title: 'Settings',
                    rows: settings.map((s) => itemRow(s)),
                })
            }
            if (!isAuthenticated) {
                result.push({
                    key: 'docs',
                    title: 'Docs',
                    rows: docs.slice(0, 5).map((d) => itemRow(d)),
                })
            }
            return result
        }

        if (isCommandMode && !searchText) {
            return [
                {
                    key: 'actions',
                    title: 'Actions',
                    rows: actions.map((a) => itemRow(a)),
                },
                {
                    key: 'navigation',
                    title: 'Navigation',
                    rows: navigation.map((n) => itemRow(n)),
                },
                ...(settings.length
                    ? [
                          {
                              key: 'settings',
                              title: 'Settings',
                              rows: settings.map((s) => itemRow(s)),
                          },
                      ]
                    : []),
            ]
        }

        // sessions: server title matches plus fuzzy matches over the cached recent list
        const sessionPool = new Map<string, BackendSession>()
        if (!isCommandMode && isAuthenticated) {
            for (const s of searchData?.sessions ?? []) {
                if (!s.isArchived && s.type !== 'SEARCH') sessionPool.set(s.id, s)
            }
            for (const s of recentSessions) sessionPool.set(s.id, s)
        }
        const pool: SearchItem[] = isCommandMode
            ? [...actions, ...navigation, ...settings]
            : [
                  ...[...sessionPool.values()].map(sessionItem),
                  ...actions,
                  ...navigation,
                  ...repoItems,
                  ...settings,
                  ...docs,
              ]

        const groups = new Map<SearchGroup, { row: SearchRow; score: number }[]>()
        for (const item of pool) {
            const match = scoreItem(searchText, item.label, item.keywords)
            if (!match) continue
            const list = groups.get(item.group) ?? []
            list.push({ row: itemRow(item, match.indexes), score: match.score })
            groups.set(item.group, list)
        }

        const result: SearchSection[] = [...groups.entries()]
            .map(([group, list]) => {
                const sorted = list.sort((a, b) => b.score - a.score).slice(0, GROUP_LIMIT[group])
                return { group, rows: sorted.map((e) => e.row), best: sorted[0].score }
            })
            // the group with the strongest match comes first
            .sort((a, b) => b.best - a.best)
            .map(({ group, rows }) => ({ key: group, title: group, rows }))

        if (!isCommandMode) {
            result.push({
                key: 'ask',
                title: null,
                isAsk: true,
                rows: [{ kind: 'ask', prompt: trimmed }],
            })
        }
        return result
    }, [
        trimmed,
        isCommandMode,
        searchText,
        isAuthenticated,
        recentSessions,
        searchData?.sessions,
        sessionItem,
        actions,
        navigation,
        settings,
        docs,
        repoItems,
    ])

    // AI filters: only when plain matching found no session for a description of 2+ words,
    // after the title search settles and typing pauses. Charged per call on the server.
    const aiText = useDebounced(isCommandMode ? '' : searchText, AI_SEARCH_DEBOUNCE_MS)
    const wordCount = searchText.split(/\s+/).filter(Boolean).length
    const plainHasSessions = plainSections.some((section) => section.key === 'Sessions')
    const isTitleSearchSettled = debouncedSearch === searchText && !isTitleSearchFetching
    const isAiEnabled = Boolean(
        isOpen &&
        isAuthenticated &&
        !isCommandMode &&
        wordCount >= AI_SEARCH_MIN_WORDS &&
        !plainHasSessions &&
        isTitleSearchSettled &&
        aiText === searchText
    )
    const { data: aiData, isFetching: isAiFetching } = useQuery({
        queryKey: ['sessions', 'smart-search', aiText.toLowerCase()],
        queryFn: ({ signal }) => sessionAPI.smartSearchSessions(aiText, signal),
        enabled: isAiEnabled,
        staleTime: 10 * 60_000,
        retry: false,
    })

    const sections = useMemo<SearchSection[]>(() => {
        // nothing found or not applied: the list stays as it was
        if (!isAiEnabled || !aiData?.applied || aiData.sessions.length === 0) return plainSections
        return [
            {
                key: 'ai-sessions',
                title: 'Sessions',
                rows: aiData.sessions.map((session) => itemRow(sessionItem(session))),
            },
            ...plainSections,
        ]
    }, [isAiEnabled, aiData, plainSections, sessionItem])

    const askDecember = useMemo(
        () => (prompt: string) => {
            startNewSession()
            if (isAuthenticated) {
                requestHomePrefill({ prompt })
            }
        },
        [startNewSession, isAuthenticated]
    )

    return { sections, askDecember, isAiSearching: isAiEnabled && isAiFetching }
}
