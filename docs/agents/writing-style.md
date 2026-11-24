# Writing style

Public writing in December follows **Simplified Technical English** (STE, ASD-STE100): the controlled language written in 1986 so aircraft mechanics could follow maintenance manuals without error. We use its sentence rules, not its fixed dictionary.

The reader is a developer who wants to do one thing and leave. Every sentence helps them do it.

## Core rules

1. **One idea per sentence.** Steps are 20 words or fewer. Explanations are 25 words or fewer.
2. **Steps start with a verb.** "Run `december`." One action per step. Number steps that happen in order.
3. **Active voice.** Name who does the action: "December runs your tests."
4. **One word, one meaning.** Use the term from the table below every time, for the same thing.
5. **Common words.** Use "use", "help", "start", "make", "about", "many". Write the plain word a reader would say out loud.
6. **Condition first.** "If you use your own keys, run `/login` first." Warnings go before the step they apply to.
7. **Short paragraphs.** One topic, six sentences or fewer.
8. **Concrete.** Give the number, the command, the file name, the provider name. Replace an adjective with the fact behind it.
9. **Keep articles.** Write "the file", "a sandbox". STE keeps them so sentences parse in one read.

## User-facing terms

| Use                       | For                                                               |
| ------------------------- | ----------------------------------------------------------------- |
| December                  | the product and the agent                                         |
| the CLI                   | the `@trydecember/cli` terminal app                               |
| December Cloud            | the hosted web app at app.trydecember.com                         |
| sandbox                   | the cloud machine a December Cloud session runs in                |
| preview                   | the live view of the running app in a sandbox                     |
| your own keys             | bring-your-own API keys (write "BYOK" only after the full phrase) |
| plan                      | a Claude Code or Codex subscription the user already pays for     |
| skill, MCP server, plugin | as defined on their docs pages                                    |

Internal architecture terms (Brain, Hands, Lease, Mailbox) live in `GLOSSARY.md` and stay out of public pages.

## By page type

- **Docs** (`apps/docs/src/pages/docs/`): apply every rule. Each page opens with one sentence on what the page helps the reader do.
- **Landing page**: apply every rule. Shortest form wins.
- **Blogs**: apply rules 1, 3, 5 and 8. Keep the author's voice, opinions and humour. Define every technical term on first use.
- **Legal pages** (`terms.astro`, `privacy.astro`): the legal text stays word for word, with nothing added around it. Changes to legal text need the owner's sign-off.

## Example

Before:

> The cloud workspace provides zero-configuration micro-VM sandboxes with live interactive previews and GitHub synchronization.

After:

> December Cloud runs your project in a sandbox. You do not need to set anything up. You see a live preview of your app, and you can sync with GitHub.
