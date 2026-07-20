import { useState } from 'react'

export function useSettings() {
    const [settingsNonWorkspace, setSettingsNonWorkspace] = useState(false)
    const [settingsNotifications, setSettingsNotifications] = useState(false)
    const [settingsShowTasks, setSettingsShowTasks] = useState(true)
    const [settingsShowTips, setSettingsShowTips] = useState(true)
    const [settingsToolPermission, setSettingsToolPermission] = useState<
        'always-proceed' | 'always-ask'
    >('always-proceed')
    const [settingsAutoUpdate, setSettingsAutoUpdate] = useState(true)
    const [settingsSelectedIndex, setSettingsSelectedIndex] = useState(0)
    const [settingsDefaultModel, setSettingsDefaultModel] = useState('')
    const [settingsMaxTokens, setSettingsMaxTokens] = useState('')

    return {
        settingsNonWorkspace,
        setSettingsNonWorkspace,
        settingsNotifications,
        setSettingsNotifications,
        settingsShowTasks,
        setSettingsShowTasks,
        settingsShowTips,
        setSettingsShowTips,
        settingsToolPermission,
        setSettingsToolPermission,
        settingsAutoUpdate,
        setSettingsAutoUpdate,
        settingsSelectedIndex,
        setSettingsSelectedIndex,
        settingsDefaultModel,
        setSettingsDefaultModel,
        settingsMaxTokens,
        setSettingsMaxTokens,
    }
}
