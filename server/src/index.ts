import express from 'express'
import dotenv from 'dotenv'
import authRouter from './modules/auth/auth.routes'
import profileRouter from './modules/profile/profile.routes'
dotenv.config()

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/api/v1/auth', authRouter)
app.use('/api/v1/profile', profileRouter)

const PORT = process.env.PORT || 4000
app.listen(PORT, function () {
  console.log(`server is listening on PORT ${PORT}`)
})
