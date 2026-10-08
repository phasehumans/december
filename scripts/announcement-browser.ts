import { resolve } from 'node:path'

import { sendCampaign } from './email-sender'

const SUBJECT = 'december now has eyes and hands (new look + browser actions)'

const BODY = `December v0.4.5

December now has eyes and hands.

hey {name},

i'm chaitanya from december (https://trydecember.com).

we just released v0.4.5, our biggest update yet. december is now a computer-use agent right from your terminal.

what's new:

- browser actions & computer use: launch a browser, navigate pages, click, type, capture screenshots, and inspect console or network errors.
- fresh look & fullscreen tui: fullscreen terminal mode by default, smooth 60fps streaming, and collapsible reasoning thoughts.
- workspace memory & voice: remembers project context across sessions, plus voice input dictation.

update to the latest version:
$ npm install -g @trydecember/cli@latest

try it out on your project and let me know what you think. just reply directly to this email!

thanks,
chaitanya

docs: https://trydecember.com/docs
github: https://github.com/phasehumans/december`

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>December v0.4.5</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #090a0f;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; padding: 28px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; text-align: left;">
          
          <!-- Landing Page Style Nav (December v0.4.5, no logo, no divider line) -->
          <tr>
            <td style="padding: 0 0 28px 0;">
              <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; font-size: 13px; font-weight: 500; color: #090a0f;">December</span>
              <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; font-size: 13px; color: #64748b; margin-left: 6px;">v0.4.5</span>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td>
              <h1 style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 22px; font-weight: 600; color: #090a0f; line-height: 1.25; margin: 0 0 16px 0; letter-spacing: -0.025em;">
                December now has eyes and hands.
              </h1>

              <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 14px 0;">
                Hey {name},
              </p>

              <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 24px 0;">
                I'm Chaitanya from <a href="https://trydecember.com" style="color: #2563eb; text-decoration: none; font-weight: 500;">December</a>. We just shipped v0.4.5, our biggest update yet. December is now a computer-use agent right from your terminal.
              </p>

              <!-- Points with minimal, simple wording -->
              <div style="margin-bottom: 20px;">
                <div style="font-size: 15px; font-weight: 600; color: #090a0f; margin-bottom: 4px;">
                  <span style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #87b2f4; margin-right: 6px;">01 /</span>Browser actions &amp; computer use
                </div>
                <p style="font-size: 14px; line-height: 1.6; color: #52525b; margin: 0;">
                  December can now launch a browser, navigate pages, click, type, capture screenshots, and inspect console or network errors.
                </p>
              </div>

              <div style="margin-bottom: 20px;">
                <div style="font-size: 15px; font-weight: 600; color: #090a0f; margin-bottom: 4px;">
                  <span style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #87b2f4; margin-right: 6px;">02 /</span>Fresh look &amp; fullscreen TUI
                </div>
                <p style="font-size: 14px; line-height: 1.6; color: #52525b; margin: 0;">
                  Fullscreen terminal interface by default, butter-smooth 60fps streaming, and collapsible reasoning thoughts.
                </p>
              </div>

              <div style="margin-bottom: 26px;">
                <div style="font-size: 15px; font-weight: 600; color: #090a0f; margin-bottom: 4px;">
                  <span style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #87b2f4; margin-right: 6px;">03 /</span>Workspace memory &amp; voice
                </div>
                <p style="font-size: 14px; line-height: 1.6; color: #52525b; margin: 0;">
                  Passively remembers project context across sessions, plus voice input dictation for hands-free coding.
                </p>
              </div>

              <!-- Install command -->
              <div style="margin: 24px 0 24px 0;">
                <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;">
                  Update or install
                </div>
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; background: #f8fafc;">
                  <tr>
                    <td style="padding: 10px 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #0f172a;">
                      <span style="color: #87b2f4; font-weight: bold; margin-right: 8px;">$</span>npm install -g @trydecember/cli@latest
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Closing -->
              <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
                Try it out on your project and let me know what you think. Just hit reply directly to this email!
              </p>

              <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 4px 0;">
                Thanks,
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #090a0f; font-weight: 600; margin: 0;">
                Chaitanya
              </p>
            </td>
          </tr>

          <!-- Clean Footer -->
          <tr>
            <td style="padding: 28px 0 0 0; font-size: 12px; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <div style="margin-bottom: 8px;">
                <a href="https://github.com/phasehumans/december" style="color: #64748b; text-decoration: underline; margin-right: 12px;">GitHub</a>
                <a href="https://trydecember.com" style="color: #64748b; text-decoration: underline; margin-right: 12px;">Website</a>
                <a href="https://trydecember.com/docs" style="color: #64748b; text-decoration: underline;">Docs</a>
              </div>
              <div style="line-height: 1.5;">
                You received this email because you signed up on trydecember.com.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

const run = async () => {
    const args = process.argv.slice(2)
    const dryRun = args.includes('--dry-run')
    const test = args.includes('--test')
    const send = args.includes('--send')

    const getArgValue = (flag: string): string | undefined => {
        const idx = args.indexOf(flag)
        return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined
    }

    const usersPath = getArgValue('--users') || resolve(import.meta.dir, 'users.txt')
    const testEmail = getArgValue('--test-email') || 'phasehumans@gmail.com'

    if (!dryRun && !test && !send) {
        console.log('Usage:')
        console.log('  bun scripts/announcement-browser.ts --dry-run')
        console.log('  bun scripts/announcement-browser.ts --test [--test-email <email>]')
        console.log('  bun scripts/announcement-browser.ts --send [--users <path>]')
        process.exit(0)
    }

    await sendCampaign({
        subject: SUBJECT,
        body: BODY,
        html: HTML,
        usersPath,
        testEmail,
        from: 'December <team@trydecember.com>',
        replyTo: 'team@trydecember.com',
        useResend: true,
        dryRun,
        test,
        send,
    })
}

run().catch((err) => {
    console.error(`error: ${err.message || err}`)
    process.exit(1)
})
