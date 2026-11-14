# december-action

Automated GitHub Action wrapper for December, enabling self-hosted and BYOK workflows on your own GitHub Actions runners without cloud compute costs.

## Overview

Trigger autonomous issue fixes and pull request tasks directly from GitHub events:

- Maintainers or contributors comment `@december fix this issue` or `@december write tests`.
- December runs tests, makes changes, and opens a clean pull request.
- Optional webhook notifications alert Slack or Discord channels when tasks finish.

## Usage

```yaml
name: December Bot
on:
    issue_comment:
        types: [created]
    pull_request:
        types: [opened]

permissions:
    contents: write
    pull-requests: write
    issues: write

jobs:
    december:
        runs-on: ubuntu-latest
        if: |
            (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@december')) ||
            (github.event_name == 'pull_request' && contains(github.event.pull_request.body, '@december'))
        steps:
            - uses: actions/checkout@v4
            - uses: trydecember/december-action@v1
              with:
                  github_token: ${{ secrets.GITHUB_TOKEN }}
                  gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
                  slack_webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Inputs

- `prompt`: Instruction or task prompt for December (optional, extracted from comment/PR body if omitted).
- `github_token`: GitHub token for repository operations (default: `${{ github.token }}`).
- `model`: Model name (default: `gemini-2.5-flash`).
- `provider`: Model provider (e.g. `gemini`, `openai`, `anthropic`, `openrouter`).
- `gemini_api_key`: Google Gemini API key.
- `openai_api_key`: OpenAI API key.
- `anthropic_api_key`: Anthropic API key.
- `openrouter_api_key`: OpenRouter API key.
- `branch`: Dedicated branch name.
- `base_branch`: Base branch for PR (default: `main`).
- `create_pr`: Whether to open a pull request (default: `true`).
- `slack_webhook`: Optional Slack webhook URL for task completion alerts.
- `discord_webhook`: Optional Discord webhook URL for task completion alerts.
