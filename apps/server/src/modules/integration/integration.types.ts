export type ConnectVercel = {
    code: string
    userId: string
    teamId?: string
    configurationId?: string
}

export type ConnectSupabase = {
    userId: string
    code: string
}

export type ConnectNotion = {
    userId: string
    code: string
}

export type ConnectGithub = {
    userId: string
    accessToken: string
    username: string
}

export type HandleGitHubOAuth = {
    code: string
    userId: string
}
