import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

import nodemailer from 'nodemailer'

export interface UserRecipient {
    name: string
    email: string
}

export interface CampaignOptions {
    subject?: string
    body?: string
    templatePath?: string
    usersPath?: string
    dryRun?: boolean
    test?: boolean
    send?: boolean
    testEmail?: string
}

interface SendEmailConfig {
    sender?: string
    password?: string
    sender_name?: string
}

const CONFIG_PATH = join(homedir(), '.config', 'sendemail', 'config.json')

export const loadSmtpCredentials = (): {
    sender: string
    password: string
    host?: string
    port?: number
} => {
    const envSender = process.env.SMTP_USER || process.env.SMTP_EMAIL || process.env.GMAIL_USER
    const envPassword =
        process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD

    if (envSender && envPassword) {
        return {
            sender: envSender,
            password: envPassword,
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465,
        }
    }

    if (existsSync(CONFIG_PATH)) {
        const raw = readFileSync(CONFIG_PATH, 'utf-8')
        const parsed = JSON.parse(raw) as SendEmailConfig
        const sender = parsed.sender || envSender
        const password = parsed.password || envPassword

        if (sender && password) {
            return {
                sender,
                password,
                host: 'smtp.gmail.com',
                port: 465,
            }
        }
    }

    throw new Error(
        'missing SMTP credentials. configure SMTP_USER and SMTP_PASS in .env or ~/.config/sendemail/config.json'
    )
}

export const parseUsersFile = (filePath: string): UserRecipient[] => {
    if (!existsSync(filePath)) {
        throw new Error(`users file not found at ${filePath}`)
    }

    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const users: UserRecipient[] = []

    for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) {
            continue
        }

        // Check if format is "Name <email@example.com>"
        const angleBracketMatch = line.match(/^(.*?)\s*<([^>]+)>$/)
        if (angleBracketMatch) {
            const name = angleBracketMatch[1]?.trim() || 'there'
            const email = angleBracketMatch[2]?.trim() || ''
            if (email) {
                users.push({ name, email })
                continue
            }
        }

        // Check if format is "name, email"
        if (line.includes(',')) {
            const [rawName, rawEmail] = line.split(',')
            const name = (rawName || '').trim() || 'there'
            const email = (rawEmail || '').trim()
            if (email) {
                users.push({ name, email })
                continue
            }
        }

        // Otherwise assume whole line is an email address
        users.push({
            name: 'there',
            email: line,
        })
    }

    return users
}

export const parseTemplateFile = (filePath: string): { subject: string; body: string } => {
    if (!existsSync(filePath)) {
        throw new Error(`template file not found at ${filePath}`)
    }

    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')

    let subject = ''
    let bodyStartIndex = 0

    const firstLine = (lines[0] || '').trim()
    if (firstLine.toLowerCase().startsWith('subject:')) {
        subject = firstLine.substring('subject:'.length).trim()
        bodyStartIndex = 1
        // Skip leading empty line after subject
        if (lines[1] !== undefined && lines[1].trim() === '') {
            bodyStartIndex = 2
        }
    }

    const body = lines.slice(bodyStartIndex).join('\n').trim()
    return { subject, body }
}

export const createSmtpTransporter = (credentials: {
    sender: string
    password: string
    host?: string
    port?: number
}) => {
    const host = credentials.host || 'smtp.gmail.com'
    const port = credentials.port || 465
    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
            user: credentials.sender,
            pass: credentials.password,
        },
    })
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const sendCampaign = async (options: CampaignOptions): Promise<void> => {
    const {
        dryRun = false,
        test = false,
        send = false,
        testEmail = 'dev.chaitanyasonawane@gmail.com',
    } = options

    if (!dryRun && !test && !send) {
        console.log('please specify an action mode: --dry-run, --test, or --send')
        return
    }

    let subject = options.subject || ''
    let body = options.body || ''

    if (options.templatePath) {
        const parsed = parseTemplateFile(options.templatePath)
        if (!subject) subject = parsed.subject
        if (!body) body = parsed.body
    }

    if (!subject) {
        throw new Error('subject is required (specify in template file or via options)')
    }

    if (!body) {
        throw new Error('body is required (specify in template file or via options)')
    }

    const usersPath = options.usersPath || resolve(__dirname, 'users.txt')
    const allUsers = parseUsersFile(usersPath)

    const recipients: UserRecipient[] = test ? [{ name: 'chaitanya', email: testEmail }] : allUsers

    if (recipients.length === 0) {
        console.log('no recipients found.')
        return
    }

    const credentials = loadSmtpCredentials()
    const { sender } = credentials

    if (dryRun) {
        console.log(`[dry-run] previewing ${recipients.length} email(s):\n`)
        for (const recipient of recipients) {
            const recipientSubject = subject.replaceAll('{name}', recipient.name)
            const recipientBody = body.replaceAll('{name}', recipient.name)
            console.log(`To: ${recipient.name} <${recipient.email}>`)
            console.log(`From: chaitanya <${sender}>`)
            console.log(`Subject: ${recipientSubject}`)
            console.log('-'.repeat(50))
            console.log(recipientBody)
            console.log('='.repeat(60) + '\n')
        }
        return
    }

    console.log(`connecting to smtp as ${sender}...`)
    const transporter = createSmtpTransporter(credentials)

    try {
        await transporter.verify()
        console.log('smtp connection verified.')
    } catch (err) {
        // Intentionally throw descriptive error when SMTP verification fails
        throw new Error(`smtp connection failed: ${err}`)
    }

    for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i]!
        const recipientSubject = subject.replaceAll('{name}', recipient.name)
        const recipientBody = body.replaceAll('{name}', recipient.name)

        console.log(
            `[${i + 1}/${recipients.length}] sending to ${recipient.name} <${recipient.email}>...`
        )

        await transporter.sendMail({
            from: `chaitanya <${sender}>`,
            to: recipient.email,
            subject: recipientSubject,
            text: recipientBody,
            replyTo: sender,
        })

        console.log('  sent successfully')

        if (i < recipients.length - 1) {
            await sleep(2000)
        }
    }

    console.log('\nall emails sent successfully.')
}

// CLI runner if executed directly
if (import.meta.main) {
    const args = process.argv.slice(2)
    const dryRun = args.includes('--dry-run')
    const test = args.includes('--test')
    const send = args.includes('--send')

    const getArgValue = (flag: string): string | undefined => {
        const idx = args.indexOf(flag)
        return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined
    }

    const templatePath = getArgValue('--template') || resolve(__dirname, 'email.txt')
    const usersPath = getArgValue('--users') || resolve(__dirname, 'users.txt')
    const subject = getArgValue('--subject')
    const testEmail = getArgValue('--test-email')

    sendCampaign({
        templatePath,
        usersPath,
        subject,
        testEmail,
        dryRun,
        test,
        send,
    }).catch((err) => {
        console.error(`error: ${err.message || err}`)
        process.exit(1)
    })
}
