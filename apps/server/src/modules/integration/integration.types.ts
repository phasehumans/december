export type ConnectGithub = {
    userId: string
    accessToken: string
    username: string
    // GitHub's numeric user id. The GitHub App webhook matches installers by it.
    githubId?: string
}

export type GetGitlabAuthorizeUrl = {
    state: string
}

export type ConnectGitlab = {
    code: string
    userId: string
}

export type GitlabUser = {
    userId: string
}

export type GitlabStatus = {
    // false until the gitlab oauth app is set on the server
    available: boolean
    connected: boolean
    username: string | null
}
