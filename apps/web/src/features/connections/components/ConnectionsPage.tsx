import { Plus } from 'lucide-react'
import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useConnectionsNav } from '../hooks/useConnectionsNav'
import { CONNECTIONS_BASE_PATH } from '../lib/paths'
import { CONNECTIONS_TAB_LABELS, CONNECTIONS_TABS, type ConnectionsTab } from '../types'

import { AppsTab } from './AppsTab'
import { ChoiceGroup, SecondaryButton } from './ConnectionsUi'
import { HooksTab } from './HooksTab'
import { ImportSetupModal } from './ImportSetupModal'
import { McpsTab } from './McpsTab'
import { MemoryTab } from './MemoryTab'
import { PluginsTab } from './PluginsTab'
import { RulesTab } from './RulesTab'
import { SkillsTab } from './SkillsTab'

import { useAppStore } from '@/app/store'
import {
    MobileBackButton,
    MobileIconButton,
    MobileTopBar,
} from '@/features/navigation/components/MobileTopBar'
import {
    PAGE_SUBTITLES,
    pageSubtitleClass,
    pageTitleClass,
} from '@/features/profile/components/settingsStyles'

const isTab = (value: string | undefined): value is ConnectionsTab =>
    Boolean(value && (CONNECTIONS_TABS as readonly string[]).includes(value))

/** old urls of this page. each one moves to its place under settings */
const redirectFor = (pathname: string, search: string): string | null => {
    if (
        pathname.startsWith('/settings/integrations') ||
        pathname.startsWith('/integrations') ||
        pathname.startsWith('/connectors')
    ) {
        return `${CONNECTIONS_BASE_PATH}/apps`
    }
    // the page was at /connections for a short time
    if (pathname === '/connections' || pathname.startsWith('/connections/')) {
        return `${CONNECTIONS_BASE_PATH}${pathname.slice('/connections'.length)}${search}`
    }
    return null
}

/** tabs with no page per item: an item link opens the tab */
const NO_DETAIL_TABS: ConnectionsTab[] = ['hooks', 'memory']

/** what the phone top bar "+" does on each tab (only tabs with an add action) */
const mobileAddTarget: Partial<Record<ConnectionsTab, 'modal' | 'page'>> = {
    plugins: 'modal',
    skills: 'page',
    mcps: 'modal',
    hooks: 'modal',
    rules: 'page',
    memory: 'modal',
}

export const ConnectionsPage: React.FC = () => {
    const location = useLocation()
    const { navigate, toTab, openAdd } = useConnectionsNav()
    const openMobileSheet = useAppStore((s) => s.openMobileSheet)
    const [isImportOpen, setIsImportOpen] = React.useState(false)

    const redirect = redirectFor(location.pathname, location.search)
    const parts = location.pathname.slice(CONNECTIONS_BASE_PATH.length).split('/').filter(Boolean)
    const tab = parts[0]
    const itemId = parts[1] ? decodeURIComponent(parts[1]) : undefined

    if (redirect) {
        return <Navigate to={redirect} replace />
    }
    if (!isTab(tab)) {
        return <Navigate to={`${CONNECTIONS_BASE_PATH}/apps`} replace />
    }
    if (itemId && NO_DETAIL_TABS.includes(tab)) {
        return <Navigate to={`${CONNECTIONS_BASE_PATH}/${tab}`} replace />
    }

    const isDetail = Boolean(itemId)
    const addTarget = mobileAddTarget[tab]

    const renderTab = () => {
        switch (tab) {
            case 'apps':
                return <AppsTab itemId={itemId} />
            case 'plugins':
                return <PluginsTab itemId={itemId} />
            case 'skills':
                return <SkillsTab itemId={itemId} />
            case 'mcps':
                return <McpsTab itemId={itemId} />
            case 'hooks':
                return <HooksTab />
            case 'rules':
                return <RulesTab itemId={itemId} />
            case 'memory':
                return <MemoryTab />
            default:
                return null
        }
    }

    return (
        <div className="relative h-full w-full flex-1 overflow-y-auto bg-background font-sans no-scrollbar">
            {isDetail ? (
                <MobileTopBar
                    left={
                        <MobileBackButton
                            label={CONNECTIONS_TAB_LABELS[tab]}
                            onClick={() => toTab(tab)}
                        />
                    }
                />
            ) : (
                <MobileTopBar
                    left={
                        <MobileBackButton
                            label="Back"
                            onClick={() => openMobileSheet('settings')}
                        />
                    }
                    right={
                        addTarget && (
                            <MobileIconButton
                                label={`Add to ${CONNECTIONS_TAB_LABELS[tab]}`}
                                filled
                                onClick={() =>
                                    addTarget === 'page'
                                        ? navigate(`${CONNECTIONS_BASE_PATH}/${tab}/new`)
                                        : openAdd(tab === 'plugins' ? 'repo' : '1')
                                }
                            >
                                <Plus className="w-3.5 h-3.5" strokeWidth={2.6} />
                            </MobileIconButton>
                        )
                    }
                />
            )}

            <div className="relative z-10 mx-auto max-w-[900px] px-4 sm:px-6 pb-8 pt-4 md:p-16 flex flex-col">
                {!isDetail && (
                    <>
                        <div className="flex items-start justify-between gap-3 mb-5 md:mb-6">
                            <div className="flex flex-col min-w-0">
                                <h1 className={pageTitleClass}>Connections</h1>
                                <p className={pageSubtitleClass}>{PAGE_SUBTITLES.connections}</p>
                            </div>
                            {/* reads a repository for skills and mcp servers (N24, #637) */}
                            <SecondaryButton onClick={() => setIsImportOpen(true)}>
                                Import setup
                            </SecondaryButton>
                        </div>
                        <div className="mb-4 -mx-3.5 px-3.5 md:mx-0 md:px-0 overflow-x-auto no-scrollbar [scrollbar-width:none]">
                            <ChoiceGroup
                                label="Connections sections"
                                options={CONNECTIONS_TABS.map((value) => ({
                                    value,
                                    label: CONNECTIONS_TAB_LABELS[value],
                                }))}
                                value={tab}
                                onChange={toTab}
                            />
                        </div>
                    </>
                )}
                {renderTab()}
            </div>
            <ImportSetupModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
        </div>
    )
}
