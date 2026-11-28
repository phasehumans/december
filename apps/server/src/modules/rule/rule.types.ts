/** account rules (connections, rules tab): instructions the agent always follows */

export type UserRef = {
    userId: string
}

export type SaveRule = {
    userId: string
    /** the name in the url; the body may rename the rule */
    currentName: string
    name: string
    body: string
    enabled: boolean
}

export type SetRuleEnabled = {
    userId: string
    name: string
    enabled: boolean
}

export type RuleByName = {
    userId: string
    name: string
}

export type StoredRule = {
    name: string
    body: string
    enabled: boolean
    updatedAt: Date
}
