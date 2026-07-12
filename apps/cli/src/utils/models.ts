export const getProviderModels = (provider: string) => {
    switch (provider) {
        case 'anthropic':
            return [
                { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-latest' },
                { label: 'Claude 3 Opus', value: 'claude-3-opus-latest' },
                { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
            ]
        case 'google':
            return [
                { label: 'Gemini 3.5 Flash', value: 'gemini-3.5-flash' },
                { label: 'Gemini 3.1 Pro', value: 'gemini-3.1-pro' },
                { label: 'Gemini 3 Pro Preview', value: 'gemini-3-pro-preview' },
                { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
            ]
        case 'openai':
            return [
                { label: 'GPT-4o', value: 'gpt-4o' },
                { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
                { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
            ]
        case 'openrouter':
            return [
                { label: 'Anthropic: Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
                { label: 'Google: Gemini 1.5 Pro', value: 'google/gemini-1.5-pro' },
                { label: 'OpenAI: GPT-4o', value: 'openai/gpt-4o' },
                { label: 'Meta: Llama 3 70B', value: 'meta-llama/llama-3-70b-instruct' },
            ]
        case 'deepseek':
            return [
                { label: 'DeepSeek Chat', value: 'deepseek-chat' },
                { label: 'DeepSeek Coder', value: 'deepseek-coder' },
            ]
        case 'groq':
            return [
                { label: 'Llama 3 8B', value: 'llama3-8b-8192' },
                { label: 'Llama 3 70B', value: 'llama3-70b-8192' },
                { label: 'Mixtral 8x7B', value: 'mixtral-8x7b-32768' },
            ]
        case 'huggingface':
            return [{ label: 'Llama 3 8B Instruct', value: 'meta-llama/Meta-Llama-3-8B-Instruct' }]
        case 'kimi':
        case 'moonshoot':
            return [
                { label: 'Moonshot v1 8K', value: 'moonshot-v1-8k' },
                { label: 'Moonshot v1 32K', value: 'moonshot-v1-32k' },
            ]
        case 'mistral':
            return [
                { label: 'Mistral Large', value: 'mistral-large-latest' },
                { label: 'Mistral Small', value: 'mistral-small-latest' },
            ]
        case 'xai':
            return [{ label: 'Grok Beta', value: 'grok-beta' }]
        case 'zai':
            return [{ label: 'ZAI v1', value: 'zai-v1' }]
        default:
            return [{ label: 'Default', value: 'default' }]
    }
}

export const getModelLabel = (value: string) => {
    const allProviders = [
        'anthropic',
        'google',
        'openai',
        'openrouter',
        'deepseek',
        'groq',
        'huggingface',
        'kimi',
        'mistral',
        'xai',
        'zai',
    ]
    for (const p of allProviders) {
        const models = getProviderModels(p)
        const found = models.find((m) => m.value === value)
        if (found) return found.label
    }
    return value
}

export const getModelContextWindow = (value: string) => {
    if (value.includes('gemini')) return 1000000
    if (value.includes('claude')) return 200000
    if (value.includes('gpt-4')) return 128000
    if (value.includes('gpt-3.5')) return 16385
    if (value.includes('32k')) return 32768
    if (value.includes('8192')) return 8192
    if (value.includes('8k')) return 8192
    return 100000
}
