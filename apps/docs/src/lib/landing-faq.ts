// Landing page FAQ. The visible FAQ and the FAQPage structured data both read this list,
// so Google always sees exactly the questions that are on the page.
// In answers, `backticks` mark inline code.

export interface FaqEntry {
    label: string
    question: string
    answer: string[]
}

export const landingFaq: FaqEntry[] = [
    {
        label: 'Comparison',
        question: 'How is December different from Claude Code or Codex?',
        answer: [
            "Those tools are built around one company's models. December works with any model, and it can also run on the Claude Code or Codex plan you already pay for.",
            'It is fully open source under the MIT license, and it can run in cloud sandboxes with live previews, not just in your terminal.',
        ],
    },
    {
        label: 'Pricing',
        question: 'Is December free?',
        answer: [
            'Yes. The CLI is free and open source. With your own API keys, you only pay your model provider, with no markup.',
            'December Cloud is optional. It uses December credits.',
        ],
    },
    {
        label: 'Install',
        question: 'How do I install December?',
        answer: [
            'Install the CLI with npm: `npm install -g @trydecember/cli`. Then run `december` in your project folder and type `/login` to connect a model.',
            'To skip the install, use December Cloud in your browser at app.trydecember.com.',
        ],
    },
    {
        label: 'Privacy',
        question: 'Does my code leave my machine?',
        answer: [
            'Only to the model provider you pick. December runs on your machine, and with your own keys, requests go straight from your machine to your provider.',
            "Nothing goes through December's servers unless you sign in with December Cloud.",
        ],
    },
]

const escapeHtml = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const CODE_CLASS =
    'font-mono text-[13px] text-[#090a0f] bg-[#f8fafc] border border-[#e2e8f0] px-1 py-0.5'

/** One answer paragraph as HTML, with `code` spans styled like the rest of the page. */
export const faqParagraphHtml = (paragraph: string): string =>
    escapeHtml(paragraph).replace(/`([^`]+)`/g, `<code class="${CODE_CLASS}">$1</code>`)

/** FAQPage JSON-LD for the landing page. */
export const landingFaqJsonLd = {
    '@type': 'FAQPage',
    '@id': 'https://trydecember.com/#faq',
    mainEntity: landingFaq.map((entry) => ({
        '@type': 'Question',
        name: entry.question,
        acceptedAnswer: {
            '@type': 'Answer',
            text: entry.answer.join(' ').replace(/`/g, ''),
        },
    })),
}
