# action

Run December on your own GitHub Actions runners. Mention `@trydecember` on an issue or pull request, and December makes the change and opens a pull request.

## How it works

1. Someone comments `@trydecember fix this issue` on an issue, or writes `@trydecember` in a pull request description.
2. December reads the request and edits the code on a new branch.
3. December runs `npm test`. If the tests fail, December stops and does not open a pull request.
4. If the tests pass, December commits the change and opens a pull request.
5. Optional: December sends a message to Slack or Discord when the task finishes.

December uses your own API key. The work runs on your runner, so there is no December Cloud cost.

## Setup

1. Add your model API key as a repository secret, for example `GEMINI_API_KEY`.
2. Add this file as `.github/workflows/december.yml`:

```yaml
name: December
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
            (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@trydecember')) ||
            (github.event_name == 'pull_request' && contains(github.event.pull_request.body, '@trydecember'))
        steps:
            - uses: actions/checkout@v4
            - uses: trydecember/action@v1
              with:
                  gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
```

## Inputs

| Input                | Description                                                                                                                   | Default               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `prompt`             | The task for December. If empty, December reads it from the comment or pull request text.                                     |                       |
| `github_token`       | Token for branches, commits, and pull requests.                                                                               | `${{ github.token }}` |
| `provider`           | `gemini`, `openai`, `anthropic`, or `openrouter`. If this provider has no key, December uses the first provider that has one. | `gemini`              |
| `model`              | Model name. If empty, December uses the provider's default model.                                                             |                       |
| `gemini_api_key`     | Google Gemini API key.                                                                                                        |                       |
| `openai_api_key`     | OpenAI API key.                                                                                                               |                       |
| `anthropic_api_key`  | Anthropic API key.                                                                                                            |                       |
| `openrouter_api_key` | OpenRouter API key.                                                                                                           |                       |
| `branch`             | Name of the branch for the change.                                                                                            |                       |
| `base_branch`        | Branch the pull request targets.                                                                                              | `main`                |
| `create_pr`          | Set to `false` to push the branch without a pull request.                                                                     | `true`                |
| `pr_title`           | Custom pull request title.                                                                                                    |                       |
| `slack_webhook`      | Slack webhook URL for task alerts.                                                                                            |                       |
| `discord_webhook`    | Discord webhook URL for task alerts.                                                                                          |                       |
