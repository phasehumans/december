import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const sendOTP = async (email: string, otp: string) => {
    await resend.emails.send({
        from: 'Chaitanya Sonawane <onboarding@resend.dev>',
        to: email,
        subject: 'Your Verification Code',
        html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>December Verification Code</title>
          </head>

          <body style="margin:0; padding:0; background:#ffffff; font-family:Arial, Helvetica, sans-serif;">
            <table
              role="presentation"
              width="100%"
              cellspacing="0"
              cellpadding="0"
              border="0"
              style="background:#ffffff; margin:0; padding:40px 16px;"
            >
              <tr>
                <td align="center">
                  <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                    style="
                      max-width:560px;
                      background:#171615;
                      border:1px solid #2A2927;
                      border-radius:20px;
                      overflow:hidden;
                    "
                  >
                    <!-- Header -->
                    <tr>
                      <td style="padding:36px 32px 20px; text-align:center;">
                        <h1
                          style="
                            margin:0;
                            font-size:26px;
                            line-height:32px;
                            font-weight:600;
                            color:#F5F5F4;
                            letter-spacing:-0.3px;
                          "
                        >
                          December
                        </h1>

                        <p
                          style="
                            margin:14px 0 0;
                            font-size:14px;
                            line-height:22px;
                            color:#A8A29E;
                          "
                        >
                          Verify your email
                        </p>
                      </td>
                    </tr>

                    <!-- Divider -->
                    <tr>
                      <td style="padding:0 32px;">
                        <div style="height:1px; background:#2A2927;"></div>
                      </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                      <td style="padding:28px 32px 32px;">
                        <p
                          style="
                            margin:0 0 20px;
                            font-size:15px;
                            line-height:24px;
                            color:#D6D3D1;
                            text-align:center;
                          "
                        >
                          Use the verification code below to continue.
                        </p>

                        <!-- OTP Box -->
                        <div style="margin:0 0 24px; text-align:center;">
                          <div
                            style="
                              display:inline-block;
                              min-width:220px;
                              padding:18px 24px;
                              background:#1E1D1B;
                              border:1px solid #2A2927;
                              border-radius:14px;
                              color:#FAFAF9;
                              font-size:34px;
                              line-height:40px;
                              font-weight:700;
                              letter-spacing:10px;
                              font-family:'Courier New', monospace;
                              text-align:center;
                            "
                          >
                            ${otp}
                          </div>
                        </div>

                        <p
                          style="
                            margin:0 0 8px;
                            font-size:14px;
                            line-height:22px;
                            color:#D6D3D1;
                            text-align:center;
                          "
                        >
                          This code will expire in <strong style="color:#FAFAF9;">10 minutes</strong>.
                        </p>

                        <p
                          style="
                            margin:0;
                            font-size:13px;
                            line-height:22px;
                            color:#78716C;
                            text-align:center;
                          "
                        >
                          If you didn’t request this, you can safely ignore this email.
                        </p>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td
                        style="
                          padding:18px 32px 24px;
                          border-top:1px solid #2A2927;
                          text-align:center;
                        "
                      >
                        <p
                          style="
                            margin:0;
                            font-size:12px;
                            line-height:18px;
                            color:#78716C;
                          "
                        >
                          Automated email from December
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    })
}

export const getNameFromEmail = (email: string) => {
    return email.split('@')[0]?.replace(/\d+/g, '')
}

export const getUsername = (): string => {
    const firstWords = [
        'golden',
        'velvet',
        'silver',
        'lunar',
        'wild',
        'quiet',
        'blue',
        'amber',
        'soft',
        'rosy',
        'midnight',
        'ivory',
        'starry',
        'gentle',
        'moonlit',
        'faded',
        'violet',
        'honey',
        'silent',
        'crystal',
        'scarlet',
        'dusky',
        'sunlit',
        'misty',
        'dreamy',
        'glowing',
        'winter',
        'summer',
        'autumn',
        'spring',
        'opal',
        'pearl',
        'satin',
        'royal',
        'blissful',
        'sacred',
        'sunkissed',
        'whispering',
        'calm',
        'lucky',
        'sweet',
        'mellow',
        'radiant',
        'shiny',
        'glassy',
        'floating',
        'urban',
        'golden',
        'stormy',
        'cosy',
        'serene',
        'warm',
        'cool',
        'frosty',
        'distant',
        'rare',
        'bright',
        'dim',
        'secret',
        'gentle',
        'breezy',
        'angelic',
        'lovely',
        'pure',
        'tender',
        'magic',
        'eternal',
        'blushing',
        'hazy',
        'glimmering',
        'noisy',
        'softly',
        'tranquil',
        'feathered',
        'candid',
        'sleepy',
        'dreaming',
        'silken',
        'polished',
        'dewy',
        'fresh',
        'dusklit',
        'moonkissed',
        'sunset',
        'dawnlit',
        'shimmering',
        'cloudy',
        'starborn',
        'velvety',
        'roselight',
        'whimsical',
        'celestial',
        'pastel',
        'moody',
        'airy',
        'sunny',
        'twilight',
        'glossy',
        'fancy',
        'delicate',
    ]

    const secondWords = [
        'echo',
        'moon',
        'bloom',
        'drift',
        'haze',
        'flame',
        'muse',
        'shadow',
        'dawn',
        'ember',
        'mist',
        'sky',
        'glow',
        'dream',
        'storm',
        'river',
        'heart',
        'rose',
        'cloud',
        'horizon',
        'meadow',
        'light',
        'petal',
        'breeze',
        'wave',
        'star',
        'dust',
        'pearl',
        'garden',
        'forest',
        'sunset',
        'morning',
        'rain',
        'thunder',
        'dew',
        'bloom',
        'lily',
        'violet',
        'lotus',
        'willow',
        'feather',
        'bird',
        'butterfly',
        'spark',
        'secret',
        'kiss',
        'whisper',
        'soul',
        'spirit',
        'blush',
        'crystal',
        'gem',
        'stone',
        'shell',
        'sea',
        'ocean',
        'brook',
        'field',
        'path',
        'cove',
        'glimmer',
        'shine',
        'beam',
        'aurora',
        'nova',
        'comet',
        'planet',
        'sun',
        'night',
        'twilight',
        'dusk',
        'daydream',
        'poem',
        'verse',
        'song',
        'melody',
        'rhythm',
        'canvas',
        'mirror',
        'silence',
        'wonder',
        'desire',
        'memory',
        'story',
        'secret',
        'bloom',
        'ripple',
        'glade',
        'petals',
        'shore',
        'briar',
        'honey',
        'berry',
        'lavender',
        'orchid',
        'jasmine',
        'halo',
        'charm',
        'sparkle',
        'serenade',
    ]

    const chars = 'abcdefghijklmnopqrstuvwxyz'

    const first = firstWords[Math.floor(Math.random() * firstWords.length)]
    const second = secondWords[Math.floor(Math.random() * secondWords.length)]

    let suffix = ''
    for (let i = 0; i < 4; i++) {
        suffix += chars[Math.floor(Math.random() * chars.length)]
    }

    return `${first}_${second}_${suffix}`
}
