export type VerifyWalletBalance = {
    userId: string
}

export type ProxyChatCompletions = {
    userId: string
    body: any
    res: any
}

export type ReconciledCliMessage = {
    role: 'USER' | 'ASSISTANT' | 'SYSTEM'
    content: string
    blocks?: any
    sequence: number
}

export type ServerProviderResolution = {
    provider: any
    providerName: 'gemini' | 'anthropic' | 'openai' | 'deepseek' | 'openrouter'
    model: string
}
