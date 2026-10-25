import React from 'react'

import { ArtifactViewMenu } from './artifact-view-menu'
import { ByokKeyMenu } from './byok-key-menu'
import { ByokProviderMenu } from './byok-provider-menu'
import { CodeSearchMenu } from './code-search-menu'
import { ContextSelectMenu } from './context-select-menu'
import { DiffViewMenu } from './diff-view-menu'
import { FileViewMenu } from './file-view-menu'
import { GrillQuestionMenu } from './grill-question-menu'
import { HelpMenu } from './help-menu'
import { MemoryViewMenu } from './memory-view-menu'
import { MenuMenu } from './menu-menu'
import { ModelSelectMenu } from './model-select-menu'
import { PlanApproveMenu } from './plan-approve-menu'
import { ReasoningMenu } from './reasoning-menu'
import { RewindSelectMenu } from './rewind-select-menu'
import { SessionSelectMenu } from './session-select-menu'
import { SettingsMainMenu } from './settings-main-menu'
import { SkillsMenu } from './skills-menu'
import { SubscriptionSelectMenu } from './subscription-select-menu'
import { SwitchSelectMenu } from './switch-select-menu'
import { TasksModeMenu } from './tasks-mode-menu'
import { UsageSelectMenu } from './usage-select-menu'

export function AuthMenus(props: any) {
    switch (props.authMode) {
        case 'menu':
            return <MenuMenu {...props} />
        case 'subscription_select':
        case 'subscription_provider':
            return <SubscriptionSelectMenu {...props} />
        case 'byok_provider':
            return <ByokProviderMenu {...props} />
        case 'byok_key':
            return <ByokKeyMenu {...props} />
        case 'model_select':
            return <ModelSelectMenu {...props} />
        case 'context_select':
            return <ContextSelectMenu {...props} />
        case 'switch_select':
            return <SwitchSelectMenu {...props} />
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
        case 'usage':
            return <UsageSelectMenu {...props} />
        case 'diff_view':
            return <DiffViewMenu {...props} />
        case 'rewind_select':
            return <RewindSelectMenu {...props} />
        case 'help':
            return <HelpMenu {...props} />
        case 'reasoning_select':
            return <ReasoningMenu {...props} />
        case 'code_search':
            return <CodeSearchMenu {...props} />
        case 'file_view':
            return <FileViewMenu {...props} onClose={props.onCloseFileView || props.onClose} />
        case 'artifact_view':
            return <ArtifactViewMenu {...props} />
        case 'skills':
        case 'skills_menu':
            return <SkillsMenu {...props} />
        case 'memory':
        case 'memory_view':
            return <MemoryViewMenu {...props} initialTab={props.memoryInitialTab || 'memory'} />

        default:
            return null
    }
}
