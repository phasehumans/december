import type { Response } from 'express'

export const sendSuccess = (res: Response, message: string, data: any = null, statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message: message.toLowerCase(),
        data,
    })
}
