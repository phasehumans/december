import { ensureValidModelForProvider, getModelLabel } from './utils/models'

import type { DecemberConfig } from './config'
import type { SettingItem } from '@december/tui'

/** Default provider when the config names none, same as session startup */
const DEFAULT_PROVIDER = 'gemini'

/**
 * The rows of the /settings overlay, with the values that are in effect. A key that is not
 * set shows the default that the runtime uses, not "off".
 */
export function buildSettingsFromConfig(
    cfg: DecemberConfig,
    provider?: string,
    model?: string
): SettingItem[] {
    const settingsProvider = provider || cfg.activeProvider || DEFAULT_PROVIDER
    return [
        { id: 'provider', title: 'Provider', value: settingsProvider },
        {
            id: 'model',
            title: 'Model',
            value: getModelLabel(
                model || ensureValidModelForProvider(settingsProvider, cfg.activeModel)
            ),
        },
        {
            id: 'tool_permission',
            title: 'Tool permission',
            value: cfg.toolPermission || 'always-proceed',
        },
        { id: 'pathguard', title: 'Path guard', value: cfg.pathGuard === false ? 'off' : 'on' },
        {
            id: 'non_workspace',
            title: 'Files outside workspace',
            value: cfg.nonWorkspaceAccess ? 'on' : 'off',
        },
        { id: 'thinking_level', title: 'Thinking level', value: cfg.thinkingLevel || 'fast' },
        { id: 'steering_mode', title: 'Steering', value: cfg.steeringMode || 'all' },
        {
            id: 'browser_visible',
            title: 'Browser window',
            // Same rule as the browser runner: unset means visible
            value: cfg.browserVisible === false ? 'off' : 'on',
        },
    ]
}
