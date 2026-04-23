import type { Request, Response } from 'express'
import { uploadRepoSchema } from './upload.schema'
import { success } from 'zod'
import { uploadService } from './upload.service'

const listGithubRepos = async (req: Request, res: Response) => {}

const importFromGithub = async (req: Request, res: Response) => {
    const userId = req.userId as string | undefined
    const parseData = uploadRepoSchema.safeParse(req.body)

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    try {
        const { repoURL } = parseData.data

        const result = await uploadService.importFromGithub({ repoURL, userId })
        return res.status(200).json({
            success: true,
            message: 'upload successfully',
            data: result,
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            errors: error.message,
        })
    }
}

const importFromZip = async (req: Request, res: Response) => {}

export const uploadController = {
    listGithubRepos,
    importFromGithub,
    importFromZip,
}
