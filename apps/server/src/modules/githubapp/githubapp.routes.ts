import express, { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import * as githubAppService from './githubapp.service'

const router = Router()

// OAuth flow start (placeholder)
router.get('/install-start', authMiddleware, (req, res) => {
    // Generate state and redirect to GitHub App installation URL
    const appName = process.env.GITHUB_APP_NAME || 'december-bot'
    res.redirect(`https://github.com/apps/${appName}/installations/new`)
})

// Webhook listener
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['x-hub-signature-256'] as string
    if (!signature) return res.status(401).send('Missing signature')

    const rawBody = req.body.toString('utf8')
    if (!githubAppService.verifySignature(rawBody, signature)) {
        return res.status(401).send('Invalid signature')
    }

    const payload = JSON.parse(rawBody)
    const event = req.headers['x-github-event']

    try {
        if (event === 'installation' && payload.action === 'created') {
            const installationId = payload.installation.id.toString()
            // In a real flow, the sender's account needs to map to a december user, or state token is used.
            // For now, placeholder user.
            const userId = 'system'
            await githubAppService.processInstallation(installationId, userId)
        } else if (event === 'installation' && payload.action === 'deleted') {
            const installationId = payload.installation.id.toString()
            await githubAppService.processUninstallation(installationId)
        }
        res.status(200).send('OK')
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal error')
    }
})

export default router
