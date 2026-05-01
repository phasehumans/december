import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'

import authRouter from './modules/auth/auth.routes'
import profileRouter from './modules/profile/profile.routes'
import projectRouter from './modules/project/project.routes'
import canvasRouter from './modules/canvas/canvas.routes'
import generateRouter from './modules/generation/generation.routes'
import runtimeRouter from './modules/runtime/runtime.routes'
import uploadRouter, { importRouter } from './modules/upload/upload.routes'
import usageRouter from './modules/usage/usage.routes'
import templateRouter from './modules/template/template.routes'

const app = express()

app.use(express.json({ limit: '25mb' }))
app.use(cookieParser())
app.use(express.urlencoded({ extended: true, limit: '25mb' }))
app.use(
    cors({
        origin: 'http://localhost:3000',
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
app.use('/api/v1/import', importRouter)
app.use('/api/v1/usage', usageRouter)
app.use('/api/v1/template', templateRouter)

export default app
