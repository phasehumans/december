import React from 'react'

import { ViewMenu } from './ViewMenu'

import {
    SESSIONS_SORT_OPTIONS,
    activeViewFilters,
    shortRepoName,
    type SessionsView,
} from '@/features/sessions/lib/sessionsView'

interface SessionsViewMenuProps {
    view: SessionsView
    onChange: (next: Partial<SessionsView>) => void
    /** owner/name values for the Repository list. empty hides the row */
    repos: string[]
    /** values for the Tag list. empty hides the row */
    tags: string[]
}

/** the sort and filter button of the Sessions page */
export const SessionsViewMenu: React.FC<SessionsViewMenuProps> = ({
    view,
    onChange,
    repos,
    tags,
}) => (
    <ViewMenu
        sorts={SESSIONS_SORT_OPTIONS}
        sort={view.sort}
        onSort={(sort) => onChange({ sort })}
        activeFilters={activeViewFilters(view)}
        toggles={[
            {
                key: 'hasPr',
                label: 'Has pull request',
                checked: view.hasPr,
                onToggle: () => onChange({ hasPr: !view.hasPr }),
            },
            {
                key: 'archived',
                label: 'Archived',
                checked: view.archived,
                onToggle: () => onChange({ archived: !view.archived }),
            },
        ]}
        lists={[
            {
                key: 'repo',
                label: 'Repository',
                value: view.repo,
                options: repos.map((repo) => ({ value: repo, label: shortRepoName(repo) })),
                onPick: (repo) => onChange({ repo }),
            },
            {
                key: 'tag',
                label: 'Tag',
                value: view.tag,
                options: tags.map((tag) => ({ value: tag, label: tag })),
                onPick: (tag) => onChange({ tag }),
            },
        ]}
    />
)
