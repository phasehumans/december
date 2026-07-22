export type GitHubAppInstallationPayload = {
    action: string
    installation: {
        id: number | string
    }
}
