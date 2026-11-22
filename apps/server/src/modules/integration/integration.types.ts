export type ConnectGithub = {
    userId: string
    accessToken: string
    username: string
    // GitHub's numeric user id. The GitHub App webhook matches installers by it.
    githubId?: string
}

export type HandleGitHubOAuth = {
    code: string
    userId: string
}
