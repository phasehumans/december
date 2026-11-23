import React from 'react'

import { CONNECTIONS_TAB_LABELS, type ConnectionsTab } from '../types'

import { EmptyRow, ListBox } from './ConnectionsUi'

/** what normal users see on tabs that have no backend yet */
export const SoonTab: React.FC<{ tab: ConnectionsTab }> = ({ tab }) => (
    <ListBox>
        <EmptyRow>
            {CONNECTIONS_TAB_LABELS[tab]} {tab === 'memory' ? 'is' : 'are'} coming soon
        </EmptyRow>
    </ListBox>
)
