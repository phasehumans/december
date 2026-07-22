export type GitHubAppInstallationPayload = {
    action: string
    installation: {
        id: number | string
    }
}

export type ProcessInstallation = {
    installationId: string
    userId: string
}

export type ProcessUninstallation = {
    installationId: string
}

export type VerifySignature = {
    payload: string
    signature: string
}
