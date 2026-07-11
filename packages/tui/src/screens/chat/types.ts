export type Message = {
    id: number | string
    role: 'user' | 'assistant' | 'error' | 'header'
    text?: string
    blocks?: any[]
}

export type AuthMode =
    | 'none'
    | 'menu'
    | 'context_select'
    | 'december_login_select'
    | 'byok_provider'
    | 'byok_key'
    | 'model_select'
    | 'logout_select'
    | 'session_select'
    | 'plan_approve'
    | 'grill_question'
    | 'settings_main'
    | 'plan_mode'
    | 'grill_mode'
    | 'tasks_mode'
