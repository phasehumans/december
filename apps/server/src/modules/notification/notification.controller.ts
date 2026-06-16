import { NotificationParamsSchema } from '@december/shared'

import { AppError } from '../../shared/appError'

import { notificationService } from './notification.service'

import type { Request, Response } from 'express'

const getNotifications = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await notificationService.getNotifications({ userId })
        return res.status(200).json({
            success: true,
            message: 'notifications fetched successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to fetch notifications',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to fetch notifications',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const getNotificationById = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const parseData = NotificationParamsSchema.safeParse(req.params)

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

    const { id } = parseData.data

    try {
        const notification = await notificationService.getNotificationById({ userId, id })

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'notification not found',
            })
        }

        // Mark as read when fetched in detail
        if (!notification.isRead) {
            await notificationService.markAsRead({ userId, id })
            notification.isRead = true
        }

        return res.status(200).json({
            success: true,
            message: 'notification fetched successfully',
            data: notification,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to fetch notification',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to fetch notification',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const markAsRead = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const parseData = NotificationParamsSchema.safeParse(req.params)

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

    const { id } = parseData.data

    try {
        const result = await notificationService.markAsRead({ userId, id })
        return res.status(200).json({
            success: true,
            message: 'notification marked as read',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to mark notification as read',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to mark notification as read',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const deleteNotification = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const parseData = NotificationParamsSchema.safeParse(req.params)

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

    const { id } = parseData.data

    try {
        await notificationService.deleteNotification({ userId, id })
        return res.status(200).json({
            success: true,
            message: 'notification deleted successfully',
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to delete notification',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to delete notification',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const deleteAllReadNotification = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        await notificationService.deleteAllReadNotification({ userId })
        return res.status(200).json({
            success: true,
            message: 'read notifications successfully',
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to delete read notifications',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to delete read notifications',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

export const notificationController = {
    getNotifications,
    getNotificationById,
    markAsRead,
    deleteNotification,
    deleteAllReadNotification,
}
