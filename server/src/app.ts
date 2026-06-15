import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'

import authRouter from './modules/auth/auth.routes'
import billingRouter from './modules/billing/billing.routes'
import canvasRouter from './modules/canvas/canvas.routes'
import generateRouter from './modules/generation/generation.routes'
import integrationsRouter from './modules/integration/integration.routes'
import notificationRouter from './modules/notification/notification.routes'
import platformRouter from './modules/platform/platform.routes'
import profileRouter from './modules/profile/profile.routes'
import projectRouter from './modules/project/project.routes'
import runtimeRouter from './modules/runtime/runtime.routes'
import templateRouter from './modules/template/template.routes'
import uploadRouter from './modules/upload/upload.routes'
import usageRouter from './modules/usage/usage.routes'

const app = express()

app.use(
    express.json({
        limit: '25mb',
        verify: (req: any, _res, buf) => {
            if (req.originalUrl === '/api/v1/billing/webhooks/razorpay') {
                req.rawBody = Buffer.from(buf)
            }
        },
    })
)
app.use(cookieParser())
app.use(express.urlencoded({ extended: true, limit: '25mb' }))
app.use(
    cors({
        origin: process.env.FRONTEND_URL,
        credentials: true,
    })
)

app.use('/api/v1/auth', authRouter)
app.use('/api/v1/profile', profileRouter)
app.use('/api/v1/project', projectRouter)
app.use('/api/v1/canvas', canvasRouter)
app.use('/api/v1/generate', generateRouter)
app.use('/api/v1/runtime', runtimeRouter)
app.use('/api/v1/upload', uploadRouter)
app.use('/api/v1/usage', usageRouter)
app.use('/api/v1/template', templateRouter)
app.use('/api/v1/integrations', integrationsRouter)
app.use('/api/v1/notification', notificationRouter)
app.use('/api/v1/billing', billingRouter)
app.use('/api/v1/platform', platformRouter)

export default app
