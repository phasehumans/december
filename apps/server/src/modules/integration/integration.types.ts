export type ConnectGithub = {
    userId: string
    accessToken: string
    username: string
}

export type HandleGitHubOAuth = {
    code: string
    userId: string
}
