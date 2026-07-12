import React from 'react'
import { MenuMenu } from './menu-menu'
import { DecemberLoginSelectMenu } from './december-login-select-menu'
import { ByokProviderMenu } from './byok-provider-menu'
import { ByokKeyMenu } from './byok-key-menu'
import { ModelSelectMenu } from './model-select-menu'
import { ContextSelectMenu } from './context-select-menu'
import { LogoutSelectMenu } from './logout-select-menu'
import { SessionSelectMenu } from './session-select-menu'
import { TasksModeMenu } from './tasks-mode-menu'
import { PlanApproveMenu } from './plan-approve-menu'
import { GrillQuestionMenu } from './grill-question-menu'
import { SettingsMainMenu } from './settings-main-menu'
import { HooksMenu } from './hooks-menu'
import { UsageMenu } from './usage-menu'

export function AuthMenus(props: any) {
    switch (props.authMode) {
        case 'menu':
            return <MenuMenu {...props} />
        case 'december_login_select':
            return <DecemberLoginSelectMenu {...props} />
        case 'byok_provider':
            return <ByokProviderMenu {...props} />
        case 'byok_key':
            return <ByokKeyMenu {...props} />
        case 'model_select':
            return <ModelSelectMenu {...props} />
        case 'context_select':
            return <ContextSelectMenu {...props} />
        case 'logout_select':
            return <LogoutSelectMenu {...props} />
        case 'session_select':
            return <SessionSelectMenu {...props} />
        case 'tasks_mode':
            return <TasksModeMenu {...props} />
        case 'plan_approve':
            return <PlanApproveMenu {...props} />
        case 'grill_question':
            return <GrillQuestionMenu {...props} />
        case 'settings_main':
            return <SettingsMainMenu {...props} />
        case 'hooks':
            return <HooksMenu {...props} />
        case 'usage':
            return <UsageMenu {...props} />
        default:
            return null
    }
}
