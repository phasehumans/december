import crypto from 'crypto'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envPath = path.resolve(__dirname, '../server/.env')
dotenv.config({ path: envPath })

if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL not found in server/.env')
    process.exit(1)
}

let prisma: any = null

function printHelp() {
    console.log(`
December Secure Redeem Code

Usage:
  bun scripts/generate-codes.ts [options]

Options:
  --count <number>       Number of unique codes to generate (default: 5)
  --amount <cents>       Credit value in cents, e.g., 1000 for $10.00 (default: 1000)
  --limit <number>       Max redemption limit per code (default: 1)
  --expiry <days>        Days until code expires from now (default: none)
  --desc <string>        Description metadata for generation (default: "CLI Promo")
  --help, -h             Show this help screen
`)
}

function generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let str = ''
    while (str.length < 8) {
        const bytes = crypto.randomBytes(1)
        const byte = bytes[0]
        if (byte !== undefined && byte < 252) {
            str += chars[byte % chars.length]
        }
    }
    return str
}

async function main() {
    const dbModule = await import('../server/src/config/db')
    prisma = dbModule.prisma

    const args = process.argv.slice(2)

    if (args.includes('--help') || args.includes('-h')) {
        printHelp()
        return
    }

    let count = 5
    let amountInCents = 1000
    let maxRedemptions: number | null = 1
    let expiryDays: number | null = null
    let description = 'CLI Promo'

    for (let i = 0; i < args.length; i++) {
        const arg = args[i]
        if (arg === undefined) continue

        const nextVal = args[i + 1]
        if (nextVal !== undefined) {
            if (arg === '--count') {
                count = parseInt(nextVal, 10)
            } else if (arg === '--amount') {
                amountInCents = parseInt(nextVal, 10)
            } else if (arg === '--limit') {
                maxRedemptions = nextVal === 'unlimited' ? null : parseInt(nextVal, 10)
            } else if (arg === '--expiry') {
                expiryDays = parseInt(nextVal, 10)
            } else if (arg === '--desc') {
                description = nextVal
            }
        }
    }

    if (isNaN(count) || count <= 0) {
        console.error('Error: --count must be a positive integer.')
        process.exit(1)
    }
    if (isNaN(amountInCents) || amountInCents <= 0) {
        console.error('Error: --amount must be a positive integer.')
        process.exit(1)
    }

    const expiresAt = expiryDays ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) : null

    console.log(`Starting secure generation of ${count} codes...`)
    console.log(`  Amount per code: $${(amountInCents / 100).toFixed(2)} (${amountInCents} cents)`)
    console.log(`  Max redemptions: ${maxRedemptions ?? 'Unlimited'}`)
    console.log(`  Expiration: ${expiresAt ? expiresAt.toISOString() : 'Never'}`)
    console.log(`  Description: "${description}"\n`)

    const generatedItems: Array<{ code: string; hash: string }> = []
    const duplicateChecker = new Set<string>()

    while (generatedItems.length < count) {
        const code = generateCode()
        if (duplicateChecker.has(code)) continue

        duplicateChecker.add(code)
        const hash = crypto.createHash('sha256').update(code).digest('hex')
        generatedItems.push({ code, hash })
    }

    console.log('Saving secure hashes to PostgreSQL database...')
    let successCount = 0

    for (const item of generatedItems) {
        try {
            await prisma.redeemCode.create({
                data: {
                    codeHash: item.hash,
                    creditAmount: amountInCents,
                    maxRedemptions,
                    expiresAt,
                    metadata: {
                        description,
                        generatedAt: new Date().toISOString(),
                    } as any,
                },
            })
            successCount++
        } catch (err: any) {
            console.error(`Database insert failed for a code hash: ${err?.message || err}`)
        }
    }

    console.log(`Successfully stored ${successCount} hashes in the database.`)

    const mdPath = path.resolve(__dirname, '../codes.md')
    let fileExists = false
    try {
        if (fs.existsSync(mdPath) && fs.statSync(mdPath).size > 0) {
            fileExists = true
        }
    } catch (_) {}

    let mdContent = ''
    if (!fileExists) {
        mdContent += '# Generated Redeem Codes\n\n'
        mdContent +=
            '| Plaintext Code | Credit Amount (Cents) | Dollar Value | Max Redemptions | Expires At | Description | Generated At |\n'
        mdContent += '| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n'
    }

    const newRows = generatedItems
        .map(
            (item) =>
                `| \`${item.code}\` | ${amountInCents} | $${(amountInCents / 100).toFixed(2)} | ${
                    maxRedemptions ?? 'unlimited'
                } | ${expiresAt ? expiresAt.toISOString() : 'never'} | ${description} | ${new Date().toISOString()} |`
        )
        .join('\n')

    fs.appendFileSync(mdPath, mdContent + newRows + '\n', 'utf8')

    console.log(`\nEXPORT COMPLETED SECURELY!`)
    console.log(`Plaintext codes appended to: ${mdPath}`)
    console.log(`WARNING: Keep this file secure. Plaintext codes are NOT stored in the database!\n`)

    await prisma.$disconnect()
}

main().catch(async (e) => {
    console.error('Script failed fatally:', e)
    if (prisma) {
        await prisma.$disconnect()
    }
    process.exit(1)
})
