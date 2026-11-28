import { apiRequest } from '@/shared/api/client'

// account rules (connections, rules tab). server module: rule

export type ApiRule = {
    name: string
    body: string
    enabled: boolean
    updatedAt: string
}

export type SaveRuleInput = Pick<ApiRule, 'name' | 'body' | 'enabled'>

const rulePath = (name: string) => `/connections/rules/${encodeURIComponent(name)}`

const listRules = async () => {
    const data = await apiRequest<{ rules: ApiRule[] }>('/connections/rules')
    return data.rules ?? []
}

/** creates the rule or saves it. `currentName` is the saved name: the body may rename it */
const saveRule = async (currentName: string, rule: SaveRuleInput) => {
    const data = await apiRequest<{ rule: ApiRule }>(rulePath(currentName), {
        method: 'PUT',
        body: JSON.stringify(rule),
    })
    return data.rule
}

const setRuleEnabled = async (name: string, enabled: boolean) => {
    const data = await apiRequest<{ rule: ApiRule }>(rulePath(name), {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
    })
    return data.rule
}

const deleteRule = (name: string) =>
    apiRequest<{ deleted: boolean }>(rulePath(name), { method: 'DELETE' })

export const rulesAPI = {
    listRules,
    saveRule,
    setRuleEnabled,
    deleteRule,
}
