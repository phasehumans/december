import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

import { httpLogger } from './config/logger'
import { env } from './env'
import { parseAuthToken } from './middleware/auth.middleware'
import { errorHandler } from './middleware/error.middleware'
import { cliRateLimiter, globalRateLimiter, runtimeRateLimiter } from './middleware/rate-limiter'
import adminRouter from './modules/admin/admin.routes'
import attachmentRouter from './modules/attachment/attachment.routes'
import authRouter from './modules/auth/auth.routes'
import billingRouter from './modules/billing/billing.routes'
import byokRouter from './modules/byok/byok.routes'
import cliRouter from './modules/cli/cli.routes'
import connectionRouter from './modules/connection/connection.routes'
import githubAppRouter from './modules/githubapp/githubapp.routes'
import integrationsRouter from './modules/integration/integration.routes'
import notificationRouter from './modules/notification/notification.routes'
import platformRouter from './modules/platform/platform.routes'
import runtimeRouter from './modules/runtime/runtime.routes'
import secretsRouter from './modules/secrets/secrets.routes'
import sessionRouter from './modules/session/session.routes'
import sessionCommandRouter from './modules/sessioncommand/sessioncommand.routes'
import settingRouter from './modules/setting/setting.routes'
import teamRouter from './modules/team/team.routes'
import usageRouter from './modules/usage/usage.routes'
import waitlistRouter from './modules/waitlist/waitlist.routes'

const app = express()

app.use(helmet())
app.set('trust proxy', true)
app.use(httpLogger)

app.use(
    express.json({
        limit: '25mb',
        verify: (req: any, _res, buf) => {
            req.rawBody = buf
        },
    })
)
app.use(cookieParser())
app.use(express.urlencoded({ extended: true, limit: '25mb' }))
const allowedOrigins = [
    env.WEB_URL?.replace(/\/+$/, ''),
    env.APP_URL?.replace(/\/+$/, ''),
    'https://app.trydecember.com',
    'https://trydecember.com',
    'https://www.trydecember.com',
    ...(env.NODE_ENV !== 'production'
        ? [
              'http://localhost:3000',
              'http://localhost:2000',
              'http://localhost:5173',
              'http://127.0.0.1:3000',
              'http://127.0.0.1:2000',
          ]
        : []),
].filter(Boolean) as string[]

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || (env.NODE_ENV !== 'production' && origin === 'null')) {
                return callback(null, true)
            }
            if (
                allowedOrigins.includes(origin) ||
                (env.NODE_ENV !== 'production' &&
                    (origin.includes('localhost') || origin.includes('127.0.0.1')))
            ) {
                return callback(null, true)
            }
            return callback(null, false)
        },
        credentials: true,
        // the web reads the file name of a receipt or an export from this header
        exposedHeaders: ['Content-Disposition'],
    })
)

// Unauthenticated Health Check Endpoints for ALB / CloudWatch / Docker / Monitoring
const healthCheckHandler = (_req: express.Request, res: express.Response) => {
    res.status(200).json({
        status: 'ok',
        service: 'december-server',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    })
}

app.get('/health', healthCheckHandler)
app.get('/api/health', healthCheckHandler)
app.get('/api/v1/health', healthCheckHandler)

// Pre-parse token context for user-aware rate limiting and auth routing
app.use(parseAuthToken)

// Mount auth router before global rate limiter so auth endpoints (signup, login, otp, etc.)
// are governed exclusively by their dedicated strict rate limiters (authRateLimiter, refreshRateLimiter)
// and are not blocked by generic API traffic quota exhaustion.
app.use('/api/v1/auth', authRouter)

// Apply global baseline rate limiter to all other API endpoints
app.use('/api', globalRateLimiter)

app.use('/api/v1/setting', settingRouter)

app.use('/api/v1/runtime', runtimeRateLimiter, runtimeRouter)
app.use('/api/v1/usage', usageRouter)
app.use('/api/v1/integrations', integrationsRouter)
app.use('/api/v1/notification', notificationRouter)
app.use('/api/v1/waitlist', waitlistRouter)
app.use('/api/v1/billing', billingRouter)
app.use('/api/v1/platform', platformRouter)
app.use('/api/v1/cli', cliRateLimiter, cliRouter)
// files sent with a prompt (#634): POST /session/:id/attachments
app.use('/api/v1/session', attachmentRouter)
app.use('/api/v1/sessions', attachmentRouter)
// the slash commands first: their /check and /review must not reach the /:id route
app.use('/api/v1/session', sessionCommandRouter)
app.use('/api/v1/sessions', sessionCommandRouter)
app.use('/api/v1/session', sessionRouter)
app.use('/api/v1/sessions', sessionRouter)
app.use('/api/v1/secrets', secretsRouter)
app.use('/api/v1/connections', connectionRouter)
app.use('/api/v1/byok', byokRouter)
app.use('/api/v1/githubapp', githubAppRouter)
app.use('/api/v1/team', teamRouter)
app.use('/api/v1/admin', adminRouter)

app.use(errorHandler)

export default app
