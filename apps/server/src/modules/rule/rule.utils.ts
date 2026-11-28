import type { StoredRule } from './rule.types'

/** a rule as the web sees it */
export const toPublicRule = (rule: StoredRule) => ({
    name: rule.name,
    body: rule.body,
    enabled: rule.enabled,
    updatedAt: rule.updatedAt,
})
