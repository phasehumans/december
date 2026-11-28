import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import {
    importPreviewSchema,
    importSetupSchema,
    mcpNameParamsSchema,
    saveMcpServerSchema,
    saveSkillSchema,
    setEnabledSchema,
    skillNameParamsSchema,
    updateMcpServerSchema,
} from './connection.schema'
import { connectionService } from './connection.service'

import type { Request, Response } from 'express'

const requireUser = (req: Request): string => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    return userId
}

const listSkills = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    return sendSuccess(res, 'skills fetched', await connectionService.listSkills({ userId }))
})

const saveSkill = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { name: currentName } = skillNameParamsSchema.parse(req.params)
    const { name, description, body, runs, enabled } = saveSkillSchema.parse(req.body)
    const result = await connectionService.saveSkill({
        userId,
        currentName,
        name,
        description,
        body,
        runs,
        enabled,
    })
    return sendSuccess(res, 'skill saved', result)
})

const setSkillEnabled = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { name } = skillNameParamsSchema.parse(req.params)
    const { enabled } = setEnabledSchema.parse(req.body)
    const result = await connectionService.setSkillEnabled({ userId, name, enabled })
    return sendSuccess(res, 'skill updated', result)
})

const deleteSkill = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { name } = skillNameParamsSchema.parse(req.params)
    return sendSuccess(res, 'skill deleted', await connectionService.deleteSkill({ userId, name }))
})

const listMcpServers = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    return sendSuccess(
        res,
        'mcp servers fetched',
        await connectionService.listMcpServers({ userId })
    )
})

const saveMcpServer = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { name: currentName } = mcpNameParamsSchema.parse(req.params)
    const { name, url, transport, auth, headers, enabled, disabledTools } =
        saveMcpServerSchema.parse(req.body)
    const result = await connectionService.saveMcpServer({
        userId,
        currentName,
        name,
        url,
        transport,
        auth,
        headers,
        enabled,
        disabledTools,
    })
    return sendSuccess(res, 'mcp server saved', result)
})

const updateMcpServer = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { name } = mcpNameParamsSchema.parse(req.params)
    const { enabled, disabledTools } = updateMcpServerSchema.parse(req.body)
    const result = await connectionService.updateMcpServer({ userId, name, enabled, disabledTools })
    return sendSuccess(res, 'mcp server updated', result)
})

const deleteMcpServer = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { name } = mcpNameParamsSchema.parse(req.params)
    const result = await connectionService.deleteMcpServer({ userId, name })
    return sendSuccess(res, 'mcp server deleted', result)
})

const getPromptBoxLists = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const result = await connectionService.getPromptBoxLists({ userId })
    return sendSuccess(res, 'prompt box lists fetched', result)
})

const previewImport = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { repoFullName, provider } = importPreviewSchema.parse(req.body)
    const result = await connectionService.previewImport({ userId, repoFullName, provider })
    return sendSuccess(res, 'repository read', result)
})

const importSetup = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { repoFullName, provider, skills, mcps, rules, overwrite } = importSetupSchema.parse(
        req.body
    )
    const result = await connectionService.importSetup({
        userId,
        repoFullName,
        provider,
        skills,
        mcps,
        rules,
        overwrite,
    })
    return sendSuccess(res, 'setup imported', result)
})

export const connectionController = {
    listSkills,
    saveSkill,
    setSkillEnabled,
    deleteSkill,
    listMcpServers,
    saveMcpServer,
    updateMcpServer,
    deleteMcpServer,
    getPromptBoxLists,
    previewImport,
    importSetup,
}
