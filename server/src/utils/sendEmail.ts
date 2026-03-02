import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const sendOTP = async (email: string, otp: string) => {
    await resend.emails.send({
        from: 'Chaitanya <onboarding@resend.dev>',
        to: email,
        subject: 'Your Verification Code',
        html: `
      <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 40px 20px;">
        <div style="max-width: 500px; margin: auto; background: #ffffff; border-radius: 12px; padding: 30px; box-shadow: 0 5px 20px rgba(0,0,0,0.05);">
          
          <h2 style="margin: 0 0 10px; color: #111;">Verify your email</h2>
          <p style="margin: 0 0 25px; color: #555; font-size: 14px;">
            Use the verification code below to complete your sign in.
          </p>
  
          <div style="
            background: #f1f5f9;
            padding: 20px;
            text-align: center;
            border-radius: 10px;
            letter-spacing: 6px;
            font-size: 28px;
            font-weight: bold;
            color: #111;
          ">
            ${otp}
          </div>
  
          <p style="margin-top: 25px; font-size: 13px; color: #777;">
            This code will expire in <strong>10 minutes</strong>.
          </p>
  
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
  
          <p style="font-size: 12px; color: #999;">
            If you didn’t request this, you can safely ignore this email.
          </p>
  
        </div>
      </div>
      `,
    })
}
