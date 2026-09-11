import { resolve } from 'node:path'

import { sendCampaign } from './email-sender'

const SUBJECT = 'quick ask'

const BODY = `hey {name},

i'm chaitanya, one of the engineers behind december (https://trydecember.com).

saw you signed up recently and wanted to say hi. we just released v0.3.27 with support for sarvam ai, upstage, and agentrouter, which brings us to 35 byok providers so people can plug in whatever model they like.

if you have only seen the web version so far, definitely check out our cli:
https://www.npmjs.com/package/@trydecember/cli

i really want to make december better, so if you have a minute, i would love to know how your experience was. did you run into any bugs? was there anything that felt missing or annoyed you?

feel free to just reply to this email with your thoughts.

we are keeping everything open source, so if you like what we are doing, leaving a star on github would mean a lot:
https://github.com/phasehumans/december

thanks for giving it a shot,
chaitanya`

const run = async () => {
    const args = process.argv.slice(2)
    const dryRun = args.includes('--dry-run')
    const test = args.includes('--test')
    const send = args.includes('--send')

    const getArgValue = (flag: string): string | undefined => {
        const idx = args.indexOf(flag)
        return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined
    }

    const usersPath = getArgValue('--users') || resolve(__dirname, 'users.txt')
    const testEmail = getArgValue('--test-email')

    if (!dryRun && !test && !send) {
        console.log('Usage:')
        console.log('  bun scripts/feedback.ts --dry-run')
        console.log('  bun scripts/feedback.ts --test')
        console.log('  bun scripts/feedback.ts --send')
        console.log('Options:')
        console.log('  --users <path>      Custom users file (default: scripts/users.txt)')
        console.log('  --test-email <email> Custom test email')
        process.exit(0)
    }

    await sendCampaign({
        subject: SUBJECT,
        body: BODY,
        usersPath,
        testEmail,
        dryRun,
        test,
        send,
    })
}

run().catch((err) => {
    console.error(`error: ${err.message || err}`)
    process.exit(1)
})
