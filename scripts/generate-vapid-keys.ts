/**
 * Prints a new VAPID key pair for browser push (#636). Put the lines in the server env.
 *
 * Make one pair for each environment and keep it. A new pair ends the push of every
 * browser, and each user must turn push on again. The private key is a secret: do not
 * commit it.
 *
 *   bun scripts/generate-vapid-keys.ts
 */
import { generateVapidKeys } from '../apps/server/src/shared/web-push'

const { publicKey, privateKey } = generateVapidKeys()

console.log(`VAPID_PUBLIC_KEY=${publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${privateKey}`)
console.log('# who sends the push: a mailto: or https url. empty means the app url')
console.log('VAPID_SUBJECT=')
