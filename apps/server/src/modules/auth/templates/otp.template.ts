import { renderBaseEmail } from './base.template'

// 'signup' is a new user verifying their email, 'login' is a returning user signing in.
export type OtpType = 'signup' | 'login'

const OTP_COPY: Record<
    OtpType,
    { subject: string; codeLabel: string; heading: string; description: string; notice: string }
> = {
    signup: {
        subject: 'Your December verification code',
        codeLabel: 'Your verification code',
        heading: 'Verify your email',
        description: 'Use the code below to finish creating your December account.',
        notice: 'If you didn’t try to sign up for December, you can safely ignore this email.',
    },
    login: {
        subject: 'Your December sign-in code',
        codeLabel: 'Your sign-in code',
        heading: 'Sign in to December',
        description: 'Use the code below to sign in to December.',
        notice: 'If you didn’t try to sign in, you can safely ignore this email. Nobody can sign in without this code.',
    },
}

export interface RenderOtpEmailOptions {
    otp: string
    type?: OtpType
    supportEmail: string
    webUrl: string
}

export interface RenderedEmail {
    subject: string
    html: string
    text: string
}

export const renderOtpEmail = ({
    otp,
    type = 'signup',
    supportEmail,
    webUrl,
}: RenderOtpEmailOptions): RenderedEmail => {
    const copy = OTP_COPY[type] ?? OTP_COPY.signup
    const subject = `${copy.subject}: ${otp}`
    const previewText = `${copy.codeLabel} is ${otp}. Valid for 10 minutes.`
    const heading = copy.heading
    const description = copy.description
    const securityNotice = copy.notice

    const htmlContent = `
      <!-- Heading -->
      <tr>
        <td style='padding-bottom: 16px; text-align: center;'>
          <h1 class='text-primary' style='margin: 0; font-size: 20px; font-weight: 600; line-height: 28px; color: #1c1917; letter-spacing: -0.3px;'>
            ${heading}
          </h1>
        </td>
      </tr>
      <!-- Body Text -->
      <tr>
        <td style='padding-bottom: 24px; text-align: center;'>
          <p class='text-secondary' style='margin: 0; font-size: 14px; line-height: 22px; color: #57534e;'>
            ${description}
          </p>
        </td>
      </tr>
      <!-- OTP Box -->
      <tr>
        <td align='center' style='padding-bottom: 24px;'>
          <div class='otp-box' style='display: inline-block; padding: 14px 28px; background-color: #f5f5f4; border: 1px solid #e7e5e4; border-radius: 10px; color: #1c1917; font-size: 30px; line-height: 36px; font-weight: 700; letter-spacing: 8px; font-family: Menlo, Monaco, Consolas, "Courier New", monospace; text-align: center;'>
            ${otp}
          </div>
        </td>
      </tr>
      <!-- Expiry & Fallback -->
      <tr>
        <td style='padding-bottom: 36px; text-align: center;'>
          <p class='text-secondary' style='margin: 0; font-size: 13px; line-height: 20px; color: #57534e;'>
            This code expires in <strong class='text-primary' style='color: #1c1917; font-weight: 600;'>10 minutes</strong>.
          </p>
          <p class='text-muted' style='margin: 0; font-size: 12px; line-height: 18px; color: #a8a29e;'>
            ${securityNotice}
          </p>
        </td>
      </tr>
    `

    const html = renderBaseEmail({
        previewText,
        content: htmlContent,
        supportEmail,
        webUrl,
    })

    const text = `${heading}

${description}

${copy.codeLabel}: ${otp}

This code expires in 10 minutes.

${securityNotice}

---
December: ${webUrl}
Questions? Reach out to ${supportEmail}`

    return {
        subject,
        html,
        text,
    }
}
