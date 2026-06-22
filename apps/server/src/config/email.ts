import { Resend } from 'resend'

const resendkey = process.env.RESEND_API_KEY
if (!resendkey) {
    console.log('resend key is missing')
}
const resend = new Resend(resendkey)

export default resend
