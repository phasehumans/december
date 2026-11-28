import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import { ruleNameParamsSchema, saveRuleSchema, setRuleEnabledSchema } from './rule.schema'
import { ruleService } from './rule.service'

import type { Request, Response } from 'express'

const requireUser = (req: Request): string => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    return userId
}

const listRules = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    return sendSuccess(res, 'rules fetched', await ruleService.listRules({ userId }))
})

const saveRule = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { name: currentName } = ruleNameParamsSchema.parse(req.params)
    const { name, body, enabled } = saveRuleSchema.parse(req.body)
    const result = await ruleService.saveRule({ userId, currentName, name, body, enabled })
    return sendSuccess(res, 'rule saved', result)
})

const setRuleEnabled = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { name } = ruleNameParamsSchema.parse(req.params)
    const { enabled } = setRuleEnabledSchema.parse(req.body)
    return sendSuccess(
        res,
        'rule updated',
        await ruleService.setRuleEnabled({ userId, name, enabled })
    )
})

const deleteRule = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { name } = ruleNameParamsSchema.parse(req.params)
    return sendSuccess(res, 'rule deleted', await ruleService.deleteRule({ userId, name }))
})

export const ruleController = {
    listRules,
    saveRule,
    setRuleEnabled,
    deleteRule,
}
