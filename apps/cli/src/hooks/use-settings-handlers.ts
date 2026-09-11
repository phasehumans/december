import { loadConfig, saveConfig, getProviderConfig } from '../config'
import { useCliStore } from '../store'
import { instantiateProvider } from '../utils/provider-factory'

export function useSettingsHandlers() {
    const {
        settingsNonWorkspace,
        setSettingsNonWorkspace,
        settingsToolPermission,
        setSettingsToolPermission,
        settingsPathGuard,
        setSettingsPathGuard,
        setAuthMode,
        settingsThinkingLevel,
        setSettingsThinkingLevel,
        settingsSteeringMode,
        setSettingsSteeringMode,
        settingsFollowUpMode,
        setSettingsFollowUpMode,
        settingsAuthPriority,
        setSettingsAuthPriority,
        setAuthMethod,
        setActiveModel,
        setSelectedProvider,
        setSwitchItems,
        setDynamicModels,
        setOllamaModels,
        agent,
        addToast,
    } = useCliStore()

    const handleSettingsMainSelect = async (item: any) => {
        const config = await loadConfig()
        let updated = false

        switch (item.value) {
            case 'switchProvider': {
                const { getConfiguredProviders } = await import('../config')
                const configuredList = getConfiguredProviders(config)
                const menuItems = configuredList.map((i) => ({
                    label: i.label,
                    value: i.value,
                    model: i.model,
                    isActive: i.isActive,
                }))
                setSwitchItems(menuItems)
                setAuthMode('switch_select')
                break
            }
            case 'activeModel': {
                const { getAuthStatus } = await import('../config')
                const status = await getAuthStatus()
                if (!status.hasByok && !status.hasDecember && !status.hasSubscription) {
                    addToast('Please configure a provider first', 'error')
                    break
                }
                const activeProvider = config.activeProvider || ''
                setSelectedProvider(activeProvider)
                if (activeProvider === 'ollama') {
                    const { fetchOllamaModels } = await import('../utils/models')
                    const endpoint = config.providers?.['ollama'] || 'http://localhost:11434'
                    fetchOllamaModels(endpoint).then((models) => {
                        setOllamaModels(models)
                    })
                } else if (activeProvider) {
                    const { fetchLiveProviderModels } = await import('../utils/models')
                    const providerConfig = await getProviderConfig()
                    if (providerConfig?.apiKey) {
                        fetchLiveProviderModels(
                            activeProvider,
                            providerConfig.apiKey,
                            providerConfig.baseURL
                        ).then((models) => {
                            if (models.length > 0) {
                                setDynamicModels(models)
                            }
                        })
                    }
                }
                setAuthMode('model_select')
                break
            }
            case 'pathGuard': {
                const nextVal = !(settingsPathGuard !== false)
                config.pathGuard = nextVal
                setSettingsPathGuard(nextVal)
                updated = true
                break
            }
            case 'nonWorkspaceAccess':
                config.nonWorkspaceAccess = !settingsNonWorkspace
                setSettingsNonWorkspace(!settingsNonWorkspace)
                updated = true
                break
            case 'toolPermission':
                config.toolPermission =
                    settingsToolPermission === 'always-proceed' ? 'always-ask' : 'always-proceed'
                setSettingsToolPermission(config.toolPermission)
                updated = true
                break
            case 'thinkingLevel': {
                const thinkingLevels: ('auto' | 'off' | 'minimal' | 'low' | 'medium' | 'high')[] = [
                    'auto',
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
                if (agent) {
                    agent.thinkingLevel = nextThinkingLevel
                    agent.modelOptions = {
                        ...agent.modelOptions,
                        thinkingLevel: nextThinkingLevel,
                    }
                }
                updated = true
                break
            }
            case 'steeringMode': {
                const nextVal = (settingsSteeringMode || 'all') === 'all' ? 'one-at-a-time' : 'all'
                config.steeringMode = nextVal
                setSettingsSteeringMode(nextVal)
                if (agent) {
                    agent.steeringQueue.mode = nextVal
                }
                addToast(`Steering mode set to ${nextVal}`)
                updated = true
                break
            }
            case 'followUpMode': {
                const nextVal = (settingsFollowUpMode || 'all') === 'all' ? 'one-at-a-time' : 'all'
                config.followUpMode = nextVal
                setSettingsFollowUpMode(nextVal)
                if (agent) {
                    agent.followUpQueue.mode = nextVal
                }
                addToast(`Follow-up mode set to ${nextVal}`)
                updated = true
                break
            }
            case 'authPriority': {
                const priorities: ('subscription' | 'byok' | 'december')[] = [
                    'subscription',
                    'byok',
                    'december',
                ]
                const currIdx = priorities.indexOf(settingsAuthPriority || 'byok')
                const nextIdx = currIdx >= 0 ? (currIdx + 1) % priorities.length : 0
                const newPriority = priorities[nextIdx]
                config.authPriority = newPriority
                setSettingsAuthPriority(newPriority)
                updated = true

                // hot reload the llm
                await saveConfig(config)
                const newProviderConfig = await getProviderConfig()
                if (newProviderConfig && agent) {
                    const llm = instantiateProvider(
                        newProviderConfig.provider,
                        newProviderConfig.apiKey,
                        {
                            authMethod: newProviderConfig.authMethod,
                            subscription: newProviderConfig.subscription,
                            headers: newProviderConfig.headers,
                            baseURL: newProviderConfig.baseURL,
                        }
                    )
                    agent.setLLM(llm)

                    const targetModel = newProviderConfig.model
                    config.activeModel = targetModel
                    await saveConfig(config)

                    agent.modelOptions = { ...agent.modelOptions, model: targetModel }
                    setActiveModel(targetModel)
                    const { useCliStore } = await import('../store')
                    useCliStore.getState().setSelectedProvider(newProviderConfig.provider)
                    setAuthMethod(newProviderConfig.authMethod)
                    const displayPriority =
                        newPriority === 'subscription'
                            ? 'Subscription'
                            : newPriority === 'december'
                              ? 'December Cloud Wallet'
                              : 'BYOK'
                    addToast(
                        `Auth priority set to ${displayPriority} (${newProviderConfig.provider} / ${targetModel})`
                    )
                } else {
                    const displayPriority =
                        newPriority === 'subscription'
                            ? 'Subscription'
                            : newPriority === 'december'
                              ? 'December Cloud Wallet'
                              : 'BYOK'
                    addToast(`Auth priority set to ${displayPriority}`)
                }
                break
            }
            case 'back':
                setAuthMode('none')
                break
        }

        if (updated) {
            await saveConfig(config)
        }
    }

    return {
        handleSettingsMainSelect,
    }
}
