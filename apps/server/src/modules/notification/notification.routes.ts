import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { notificationController } from './notification.controller'

const notificationRouter = Router()

notificationRouter.use(authMiddleware)

// browser push (#636)
notificationRouter.get('/push/key', notificationController.getPushConfig)
notificationRouter.post('/push/status', notificationController.getPushStatus)
notificationRouter.post('/push/subscribe', notificationController.subscribePush)
notificationRouter.delete('/push/subscribe', notificationController.unsubscribePush)

notificationRouter.get('/unread-count', notificationController.getUnreadCount)
notificationRouter.get('/', notificationController.getNotifications)
notificationRouter.patch('/read-all', notificationController.markAllAsRead)
notificationRouter.patch('/read-session/:sessionId', notificationController.markSessionRead)
notificationRouter.get('/:id', notificationController.getNotificationById)
notificationRouter.patch('/:id/read', notificationController.markAsRead)
notificationRouter.delete('/', notificationController.deleteAllReadNotification)
notificationRouter.delete('/:id', notificationController.deleteNotification)

export default notificationRouter
