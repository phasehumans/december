import { Plus } from 'lucide-react'
import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useConnectionsNav } from '../hooks/useConnectionsNav'
import { isConnectionsDemoActive } from '../lib/connectionsDemo'
import { CONNECTIONS_TAB_LABELS, CONNECTIONS_TABS, type ConnectionsTab } from '../types'

import { AppsTab } from './AppsTab'
import { ChoiceGroup } from './ConnectionsUi'
import { HooksTab } from './HooksTab'
import { McpsTab } from './McpsTab'
import { MemoryTab } from './MemoryTab'
import { PluginsTab } from './PluginsTab'
import { RulesTab } from './RulesTab'
import { SkillsTab } from './SkillsTab'
import { SoonTab } from './SoonTab'

import {
    MobileBackButton,
    MobileIconButton,
    MobileTopBar,
} from '@/features/navigation/components/MobileTopBar'

const isTab = (value: string | undefined): value is ConnectionsTab =>
    Boolean(value && (CONNECTIONS_TABS as readonly string[]).includes(value))

/** old urls that now live here */
const redirectFor = (pathname: string): string | null => {
    if (pathname.startsWith('/settings/repositories')) return '/connections/apps/github'
    if (
        pathname.startsWith('/settings/connections') ||
        pathname.startsWith('/settings/integrations') ||
        pathname.startsWith('/integrations') ||
        pathname.startsWith('/connectors')
    ) {
        return '/connections/apps'
    }
    return null
}

/** what the phone top bar "+" does on each tab (only tabs with an add action) */
const mobileAddTarget: Partial<Record<ConnectionsTab, 'modal' | 'page'>> = {
    plugins: 'modal',
    skills: 'page',
    mcps: 'modal',
    hooks: 'modal',
    rules: 'page',
}

export const ConnectionsPage: React.FC = () => {
    const location = useLocation()
    const { navigate, toTab, openAdd } = useConnectionsNav()
    const [isDemo] = React.useState(isConnectionsDemoActive)

    const redirect = redirectFor(location.pathname)
    const parts = location.pathname.split('/').filter(Boolean)
    const tab = parts[1]
    const itemId = parts[2] ? decodeURIComponent(parts[2]) : undefined

    if (redirect) {
        return <Navigate to={redirect} replace />
    }
    if (!isTab(tab)) {
        return <Navigate to="/connections/apps" replace />
    }

    const isSoon = tab !== 'apps' && !isDemo
    const isDetail = Boolean(itemId) && !isSoon
    const addTarget = isSoon ? undefined : mobileAddTarget[tab]

    const renderTab = () => {
        if (isSoon) return <SoonTab tab={tab} />
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
                return <MemoryTab itemId={itemId} />
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
                    title="Connections"
                    right={
                        addTarget && (
                            <MobileIconButton
                                label={`Add to ${CONNECTIONS_TAB_LABELS[tab]}`}
                                filled
                                onClick={() =>
                                    addTarget === 'page'
                                        ? navigate(`/connections/${tab}/new`)
                                        : openAdd(tab === 'plugins' ? 'repo' : '1')
                                }
                            >
                                <Plus className="w-3.5 h-3.5" strokeWidth={2.6} />
                            </MobileIconButton>
                        )
                    }
                />
            )}

            <div className="relative z-10 mx-auto max-w-[900px] px-3.5 sm:px-6 pb-8 pt-2 md:p-16 flex flex-col">
                {!isDetail && (
                    <>
                        <h1 className="hidden md:block text-[24px] font-sans font-medium tracking-[-0.025em] text-[#D6D5C9] mb-5">
                            Connections
                        </h1>
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
        </div>
    )
}
