import { renderBaseEmail } from '../auth/templates/base.template'

import type { FooterLink } from '../auth/templates/base.template'

export type RenderMessageEmailOptions = {
    subject: string
    // plain text: blank lines split paragraphs, urls become links
    body: string
    supportEmail: string
    footerLinks?: FooterLink[]
}

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

const linkify = (escaped: string) =>
    escaped.replace(
        /(https?:\/\/[^\s<]+)/g,
        (url) =>
            `<a class='link' href='${url}' target='_blank' style='color: #1c1917; text-decoration: underline;'>${url}</a>`
    )

/** A plain message (announcements, feedback requests, credit request updates) in the december layout. */
export const renderMessageEmail = (options: RenderMessageEmailOptions) => {
    const { subject, body, supportEmail, footerLinks } = options
    const paragraphs = body
        .trim()
        .split(/\n\s*\n/)
        .map(
            (paragraph) =>
                `<p class='text-secondary' style='margin: 0 0 16px 0; font-size: 14px; line-height: 22px; color: #57534e;'>${linkify(
                    escapeHtml(paragraph.trim())
                ).replace(/\n/g, '<br />')}</p>`
        )
        .join('\n')

    const html = renderBaseEmail({
        // the layout puts this in the hidden preview line as is: escape it here
        previewText: escapeHtml(body.trim().split('\n')[0]?.slice(0, 120) ?? subject),
        content: `<tr><td style='padding-bottom: 8px;'>${paragraphs}</td></tr>`,
        supportEmail,
        footerLinks,
    })

    const footerText = (footerLinks ?? []).map((link) => `${link.label}: ${link.url}`).join('\n')
    const text = footerText ? `${body.trim()}\n\n${footerText}` : body.trim()

    return { subject, html, text }
}
