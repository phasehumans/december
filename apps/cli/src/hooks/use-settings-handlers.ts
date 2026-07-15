import { loadConfig, saveConfig } from '../config'
import { useCliStore } from '../store'

export function useSettingsHandlers() {
    const {
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
        setAuthMode,
        setSettingsDefaultModel,
        setSettingsMaxTokens,
        settingsThinkingLevel,
        setSettingsThinkingLevel,
        settingsSteeringMode,
        setSettingsSteeringMode,
        settingsFollowUpMode,
        setSettingsFollowUpMode,
        addToast,
    } = useCliStore()

    const handleSettingsMainSelect = async (item: any) => {
        const config = await loadConfig()
        let updated = false

        switch (item.value) {
            case 'nonWorkspaceAccess':
                config.nonWorkspaceAccess = !settingsNonWorkspace
                setSettingsNonWorkspace(!settingsNonWorkspace)
                updated = true
                break
            case 'notifications':
                config.notifications = !settingsNotifications
                setSettingsNotifications(!settingsNotifications)
                updated = true
                break
            case 'showActiveTasks':
                config.showActiveTasks = !settingsShowTasks
                setSettingsShowTasks(!settingsShowTasks)
                updated = true
                break
            case 'showTips':
                config.showTips = !settingsShowTips
                setSettingsShowTips(!settingsShowTips)
                updated = true
                break
            case 'toolPermission':
                config.toolPermission =
                    settingsToolPermission === 'always-proceed' ? 'always-ask' : 'always-proceed'
                setSettingsToolPermission(config.toolPermission)
                updated = true
                break
            case 'autoUpdate':
                config.autoUpdate = !settingsAutoUpdate
                setSettingsAutoUpdate(!settingsAutoUpdate)
                updated = true
                break
            case 'thinkingLevel':
                const thinkingLevels: ('off' | 'minimal' | 'low' | 'medium' | 'high')[] = [
                    'off',
                    'minimal',
                    'low',
                    'medium',
                    'high',
                ]
                const nextThinkingLevel =
                    thinkingLevels[
                        (thinkingLevels.indexOf(settingsThinkingLevel) + 1) % thinkingLevels.length
                    ]
                config.thinkingLevel = nextThinkingLevel
                setSettingsThinkingLevel(nextThinkingLevel)
                updated = true
                break
            case 'steeringMode':
                config.steeringMode = settingsSteeringMode === 'all' ? 'one-at-a-time' : 'all'
                setSettingsSteeringMode(config.steeringMode)
                updated = true
                break
            case 'followUpMode':
                config.followUpMode = settingsFollowUpMode === 'all' ? 'one-at-a-time' : 'all'
                setSettingsFollowUpMode(config.followUpMode)
                updated = true
                break
            case 'back':
                setAuthMode('none')
                break
        }

        if (updated) {
            await saveConfig(config)
        }
    }

    const handleSettingsAgentSelect = (item: any) => {
        if (item.value === 'back') {
            setAuthMode('settings_main')
            return
        }
        if (item.value.startsWith('model:')) {
            const model = item.value.split(':')[1]
            setSettingsDefaultModel(model)
            addToast(`Default model updated to ${model}`)
        } else if (item.value.startsWith('tokens:')) {
            const tokens = parseInt(item.value.split(':')[1], 10)
            setSettingsMaxTokens(tokens.toString())
            addToast(`Max tokens set to ${tokens}`)
        }
    }

    const handleSettingsUISelect = (item: any) => {
        if (item.value === 'back') {
            setAuthMode('settings_main')
            return
        }
    }

    const handleSettingsKeysSelect = (item: any) => {
        if (item.value === 'back') {
            setAuthMode('settings_main')
            return
        }
    }

    return {
        handleSettingsMainSelect,
        handleSettingsAgentSelect,
        handleSettingsUISelect,
        handleSettingsKeysSelect,
    }
}
