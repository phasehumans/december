import {
    RULES_PER_USER_MAX,
    RULES_TOTAL_MAX_BYTES,
    utf8Bytes,
} from '@december/shared/agent-context'

import { AppError } from '../../shared/appError'

import { ruleRepository } from './rule.repository'
import { toPublicRule } from './rule.utils'

import type { RuleByName, SaveRule, SetRuleEnabled, UserRef } from './rule.types'

/** true for the error prisma throws when a unique name is taken by a save at the same time */
const isNameTaken = (error: unknown) =>
    Boolean(error && typeof error === 'object' && (error as { code?: string }).code === 'P2002')

const listRules = async (data: UserRef) => {
    const { userId } = data
    const rules = await ruleRepository.findRules(userId)
    return { rules: rules.map(toPublicRule) }
}

/** creates the rule, or saves it under its current name (a rename keeps one row) */
const saveRule = async (data: SaveRule) => {
    const { userId, currentName, name, body, enabled } = data
    const rules = await ruleRepository.findRules(userId)
    const existing = rules.find((rule) => rule.name === currentName)

    if (name !== currentName && rules.some((rule) => rule.name === name)) {
        throw new AppError(`A rule named ${name} already exists.`, 409)
    }
    if (!existing && rules.length >= RULES_PER_USER_MAX) {
        throw new AppError(`You can save up to ${RULES_PER_USER_MAX} rules.`, 409)
    }
    // every rule that is on goes into each run, so all of them together have a limit
    const othersBytes = rules
        .filter((rule) => rule.id !== existing?.id)
        .reduce((total, rule) => total + utf8Bytes(rule.body), 0)
    if (othersBytes + utf8Bytes(body) > RULES_TOTAL_MAX_BYTES) {
        throw new AppError('All rules together can be up to 32 KiB. Make a rule shorter.', 400)
    }

    try {
        const rule = existing
            ? await ruleRepository.updateRule(existing.id, { name, body, enabled })
            : await ruleRepository.createRule({ userId, name, body, enabled })
        return { rule: toPublicRule(rule) }
    } catch (error) {
        if (isNameTaken(error)) throw new AppError(`A rule named ${name} already exists.`, 409)
        throw error
    }
}

const setRuleEnabled = async (data: SetRuleEnabled) => {
    const { userId, name, enabled } = data
    const existing = await ruleRepository.findRule(userId, name)
    if (!existing) throw new AppError('Rule not found', 404)
    const rule = await ruleRepository.updateRule(existing.id, { enabled })
    return { rule: toPublicRule(rule) }
}

const deleteRule = async (data: RuleByName) => {
    const { userId, name } = data
    const result = await ruleRepository.deleteRule(userId, name)
    if (result.count === 0) throw new AppError('Rule not found', 404)
    return { deleted: true }
}

export const ruleService = {
    listRules,
    saveRule,
    setRuleEnabled,
    deleteRule,
}
