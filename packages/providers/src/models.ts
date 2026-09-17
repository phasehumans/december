import type { LLMProvider, Message, ProviderTool, ProviderStreamChunk } from './types.ts'

export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
    'december-auto': 1000000,
    'gemini-3.8-flash': 1000000,
    'gemini-3.7-flash': 1000000,
    'gemini-3.6-flash': 1000000,
    'gemini-3.5-flash': 1000000,
    'gemini-3.5-flash-lite': 1000000,
    'gemini-3.1-pro-preview': 1000000,
    'gemini-3.1-flash-lite': 1000000,
    'gemini-3-pro-preview': 1000000,
    'gemini-2.5-pro': 1000000,
    'gemini-2.5-flash': 1000000,
    'gemini-2.5-flash-lite': 1000000,
    'gemini-1.5-pro': 1000000,
    'gemini-1.5-flash': 1000000,
    'claude-opus-5': 1000000,
    'claude-sonnet-5': 1000000,
    'claude-fable-5-1': 1000000,
    'claude-fable-5.1': 1000000,
    'claude-fable-5': 1000000,
    'claude-haiku-4.5': 200000,
    'claude-haiku-4-5': 200000,
    'claude-opus-4.8': 1000000,
    'claude-opus-4-8': 1000000,
    'claude-opus-4.7': 200000,
    'claude-opus-4-7': 200000,
    'claude-sonnet-4.6': 200000,
    'claude-sonnet-4-6': 200000,
    'claude-opus-4.6': 200000,
    'claude-opus-4-6': 200000,
    'claude-opus-4.5': 200000,
    'claude-opus-4-5': 200000,
    'claude-sonnet-4.5': 200000,
    'claude-sonnet-4-5': 200000,
    'gpt-5.6-sol': 1050000,
    'gpt-5.6-terra': 1050000,
    'gpt-5.6-luna': 1050000,
    'gpt-5.5-pro': 1050000,
    'gpt-5.5': 1050000,
    'gpt-5.4-pro': 400000,
    'gpt-5.4': 400000,
    'gpt-5.4-mini': 400000,
    'o4-mini': 200000,
    'o3-pro': 200000,
    o3: 200000,
    'o3-mini': 200000,
    'o1-pro': 200000,
    'gpt-4.1': 128000,
    'gpt-4.1-mini': 128000,
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'deepseek-v4-pro': 1000000,
    'deepseek-v4-flash': 1000000,
    'deepseek-chat': 128000,
    'deepseek-reasoner': 128000,
    'glm-5.3-flash': 1000000,
    'glm-5.3': 1000000,
    'glm-5.2': 1000000,
    'glm-5.1': 200000,
    'glm-5': 204800,
    'glm-5-turbo': 200000,
    'glm-5v-turbo': 200000,
    'glm-4.7': 204800,
    'glm-4.7-flash': 200000,
    'glm-4.7-flashx': 200000,
    'glm-4.6': 204800,
    'glm-4.6v': 128000,
    'glm-4.5': 131072,
    'glm-4.5-air': 131072,
    'glm-4.5-flash': 131072,
    'glm-4.5v': 64000,
    'glm-4-plus': 128000,
    'glm-4-flash': 128000,
    'MiniMax-M3': 1000000,
    'MiniMax-M2.7': 204800,
    'MiniMax-M2.7-highspeed': 204800,
    'MiniMax-M2.5': 204800,
    'MiniMax-M2.5-highspeed': 204800,
    'MiniMax-M2.1': 204800,
    'MiniMax-M2.1-highspeed': 204800,
    'MiniMax-M2': 204800,
    'MiniMax-Text-01': 1000000,
    'MiniMax-VL-01': 1000000,
    'qwen3.8-max': 1000000,
    'qwen3.8-flash-next': 262144,
    'qwen3.7-max': 1000000,
    'qwen3-coder-30b-a3b-instruct': 262144,
    'grok-4.6': 500000,
    'grok-4.5': 500000,
    'grok-4.3': 1000000,
    'grok-4.20': 1000000,
    'grok-4.20-0309-reasoning': 1000000,
    'grok-4.20-0309-non-reasoning': 1000000,
    'grok-4.1-fast': 2000000,
    'grok-4.1-fast-reasoning': 2000000,
    'grok-build-0.1': 256000,
    'mimo-v2.5': 1048576,
    'mimo-v2.5-pro': 1048576,
    'mimo-v2.5-pro-ultraspeed': 1048576,
    'mimo-v2-flash': 262144,
    'mimo-v2-omni': 262144,
    'mimo-v2-pro': 1048576,
    'xiaomi/mimo-v2.5': 1048576,
    'xiaomi/mimo-v2.5-pro': 1048576,
    'xiaomi/mimo-v2.5-pro-ultraspeed': 1048576,
    'xiaomi/mimo-v2-flash': 262144,
    'xiaomi/mimo-v2-omni': 262144,
    'xiaomi/mimo-v2-pro': 1048576,

    'sonar-deep-research': 128000,
    'sonar-reasoning-pro': 128000,
    'sonar-pro': 128000,
    sonar: 128000,
    'command-a-plus-05-2026': 256000,
    'command-a-reasoning-08-2025': 256000,
    'trinity-large-thinking': 262144,
    'thinkingmachines/inkling-small': 262144,
    'deepseek/deepseek-v4-flash-latest': 1000000,
    'deepseek/deepseek-v4-pro-0813': 1000000,
    'deepseek/deepseek-v4-pro': 512000,
    'zai-org/glm-5.2': 262144,
    'moonshotai/kimi-k3': 1000000,
    'kimi-k3': 1048576,
    'kimi-k2.7-code': 262144,
    'kimi-k2.7-code-highspeed': 262144,
    'kimi-k2.6': 262144,
    'kimi-k2.5': 262144,
    'codestral-latest': 256000,
    'codestral-2501': 256000,
    'devstral-2512': 262144,
    'devstral-latest': 262144,
    'mistral-large-latest': 262144,
    'mistral-large-2512': 262144,
    'mistral-medium-latest': 262144,
    'mistral-medium-2604': 262144,
    'mistral-small-latest': 256000,
    'mistral-small-2603': 256000,
    'magistral-medium-latest': 128000,
    'magistral-small': 128000,
    'ministral-8b-latest': 128000,
    'ministral-3b-latest': 128000,
    'muse-spark-1.3': 1048576,
    'muse-spark-1.3-contributor': 1048576,
    'muse-spark-1.2': 1048576,
    'muse-spark-1.2-contributor': 1048576,
    'muse-spark-1.1': 1048576,
    'laguna-s-2.1': 1048576,
    'laguna-m.1': 262144,
    'laguna-xs-2.1': 262144,
    'poolside/laguna-s-2.1': 1048576,
    'poolside/laguna-m.1': 262144,
    'poolside/laguna-xs-2.1': 262144,
    fugu: 1000000,
    'fugu-ultra': 1000000,
    'fugu-ultra-v1.1': 1000000,
    'fugu-ultra-v1.0': 1000000,
    'fugu-ultra-20260615': 1000000,
    'fugu-cyber': 1000000,
    'fugu-cyber-v1.0': 1000000,
    'sakana-namazu': 262144,
    'sakana-namazu-v1.0': 262144,
    'sakana/fugu': 1000000,
    'sakana/fugu-ultra': 1000000,
    'sakana/sakana-namazu': 262144,
    'solar-pro4': 524288,
    'solar-pro3': 524288,
    'solar-pro2': 524288,
    'solar-mini': 65536,
    'thinkingmachines/Inkling': 131072,
    'thinkingmachines/Inkling:peft:262144': 262144,
    inkling: 131072,

    // Abliteration AI
    'abliterated-model': 262144,
    'abliterated-model-large': 1000000,
    'abliterated-model-large-v2': 1000000,
    'abliteration/abliterated-model': 262144,
    'abliteration/abliterated-model-large': 1000000,
    'abliteration/abliterated-model-large-v2': 1000000,

    // Agnes AI
    'agnes-3.0-flash': 512000,
    'agnes-2.5-pro': 1000000,
    'agnes-2.5-flash': 512000,
    'agnes-2.5-pro-beta': 1000000,
    'agnes/agnes-3.0-flash': 512000,
    'agnes/agnes-2.5-pro': 1000000,
    'agnes/agnes-2.5-flash': 512000,
    'agnes/agnes-2.5-pro-beta': 1000000,

    // AI Router
    'airouter/gpt-5.6-luna': 1050000,
    'airouter/gpt-5.6-terra': 1050000,
    'airouter/gpt-5.6-sol': 1050000,
    'airouter/gpt-5.4': 1050000,
    'airouter/gpt-5.5': 1050000,

    // AI&
    'deepseek-ai/deepseek-v4-flash': 1050000,
    'deepseek-ai/deepseek-v4-pro': 1050000,
    'aiand/deepseek-ai/deepseek-v4-flash': 1050000,
    'aiand/deepseek-ai/deepseek-v4-pro': 1050000,
    'aiand/zai-org/glm-5.3': 1050000,
    'aiand/zai-org/glm-5.2': 1050000,
    'aiand/moonshotai/kimi-k2.7-code': 262144,
    'aiand/moonshotai/kimi-k3': 1050000,
    'aiand/google/gemma-4-31b-it': 262144,
    'aiand/openai/gpt-oss-120b': 131072,
    'aiand/motif-technologies/motif-3': 262144,
    'aiand/qwen/qwen3.8-27b': 262144,

    // AKI.IO
    'deepseek-v4-flash-0731-284b': 1050000,
    'glm5.3-754b': 524288,
    'gemma4-26b': 256000,
    'mistral4-119b': 262144,
    'qwen3.6-35b': 256000,
    'aki/deepseek-v4-flash-0731-284b': 1050000,
    'aki/glm5.3-754b': 524288,
    'aki/gemma4-26b': 256000,
    'aki/gpt-oss-120b': 128000,
    'aki/mistral4-119b': 262144,
    'aki/qwen3.8-27b': 262144,
    'aki/qwen3.6-35b': 256000,

    // Ambient
    'deepseek/deepseek-v4-flash': 1050000,
    'deepseek/deepseek-v4-flash-0731': 1050000,
    'ambient/large': 202000,
    'zai-org/GLM-5.2-FP8': 202000,
    'ambient/deepseek/deepseek-v4-flash': 1050000,
    'ambient/deepseek/deepseek-v4-flash-0731': 1050000,
    'ambient/ambient/large': 202000,
    'ambient/zai-org/GLM-5.2-FP8': 202000,
    'ambient/moonshotai/kimi-k2.7-code': 262144,
    'ambient/xiaomi/mimo-v2.5': 1050000,
    'ambient/stepfun/step-3.7-flash': 262144,
}

export function getModelContextWindow(value: string): number {
    if (!value) return 100000
    if (MODEL_CONTEXT_WINDOWS[value]) {
        return MODEL_CONTEXT_WINDOWS[value]
    }
    let lower = value.toLowerCase()
    if (lower.startsWith('ollama/')) {
        lower = lower.slice('ollama/'.length)
    }
    if (lower.includes('december-auto')) return 1000000
    if (lower.includes('gemini')) return 1000000
    if (
        lower.includes('claude-5') ||
        lower.includes('opus-5') ||
        lower.includes('sonnet-5') ||
        lower.includes('fable-5') ||
        lower.includes('opus-4.8') ||
        lower.includes('opus-4-8')
    )
        return 1000000
    if (lower.includes('claude')) return 200000
    if (lower.includes('grok-4.1-fast')) return 2000000
    if (lower.includes('grok-4.3') || lower.includes('grok-4.20')) return 1000000
    if (lower.includes('grok-build')) return 256000
    if (lower.includes('grok')) return 500000
    if (lower.includes('mimo-v2-flash') || lower.includes('mimo-v2-omni')) return 262144
    if (lower.includes('mimo')) return 1048576
    if (lower.includes('abliterated-model-large')) return 1000000
    if (lower.includes('abliterated-model')) return 262144
    if (lower.includes('agnes-2.5-pro') || lower.includes('agnes-2.5-pro-beta')) return 1000000
    if (lower.includes('agnes-3.0-flash') || lower.includes('agnes-2.5-flash')) return 512000
    if (lower.startsWith('agnes-') || lower.startsWith('agnes/')) return 512000
    if (lower.includes('ambient/large') || lower.includes('glm-5.2-fp8')) return 202000
    if (lower.includes('glm5.3-754b')) return 524288

    if (
        lower.includes('codestral') ||
        lower.includes('mistral-large') ||
        lower.includes('devstral') ||
        lower.includes('mistral-medium') ||
        lower.includes('mistral-small') ||
        lower.includes('command-a') ||
        lower.includes('qwen3.8-flash-next') ||
        lower.includes('qwen3-coder') ||
        lower.includes('trinity') ||
        lower.includes('inkling') ||
        lower.includes('kimi-k2') ||
        lower.includes('kimi-for-coding')
    )
        return 262144
    if (lower.includes('muse-spark') || lower.includes('muse')) return 1048576
    if (lower.includes('laguna-s')) return 1048576
    if (lower.includes('laguna')) return 262144
    if (lower.includes('fugu')) return 1000000
    if (lower.includes('namazu')) return 262144
    if (lower.includes('gpt-5.6') || lower.includes('gpt-5.5')) return 1050000
    if (lower.includes('gpt-5.4')) return 400000
    if (lower.includes('gpt-5')) return 200000
    if (lower.includes('o4') || lower.includes('o3') || lower.includes('o1')) return 200000
    if (lower.includes('deepseek-v4')) return 1000000
    if (lower.includes('glm-5')) return 1000000
    if (lower.includes('qwen3.8-max') || lower.includes('qwen3.7-max') || lower.includes('kimi'))
        return 1000000
    if (
        lower.includes('minimax-m3') ||
        lower.includes('minimax-text-01') ||
        lower.includes('minimax-vl-01')
    )
        return 1000000
    if (lower.includes('minimax')) return 204800
    if (lower.includes('gpt-4.5')) return 128000
    if (lower.includes('gpt-4')) return 128000
    if (lower.includes('gpt-3.5')) return 16385
    if (lower.includes('deepseek') || lower.includes('glm')) return 128000
    if (
        lower.includes('llama-4') ||
        lower.includes('llama-3.3') ||
        lower.includes('llama-3.1') ||
        lower.includes('llama3.3') ||
        lower.includes('llama3.1') ||
        lower.includes('mistral-nemo') ||
        lower.includes('magistral') ||
        lower.includes('ministral') ||
        lower.includes('gpt-oss') ||
        lower.includes('sonar')
    ) {
        return 128000
    }
    if (
        lower.includes('qwen3') ||
        lower.includes('qwen2.5-coder') ||
        lower.includes('qwen2.5') ||
        lower.includes('qwen')
    ) {
        return 32768
    }
    if (lower.includes('codellama')) return 16384
    if (lower.includes('128k')) return 131072
    if (lower.includes('32k')) return 32768
    if (lower.includes('8192')) return 8192
    if (lower.includes('8k')) return 8192
    return 100000
}

export function supportsModelThinking(model?: string): boolean {
    if (!model) return false
    let lower = model.toLowerCase()
    if (lower.startsWith('ollama/')) {
        lower = lower.slice('ollama/'.length)
    }
    if (lower.startsWith('openai/')) {
        lower = lower.slice('openai/'.length)
    }
    if (lower.startsWith('anthropic/')) {
        lower = lower.slice('anthropic/'.length)
    }
    if (lower.startsWith('google/')) {
        lower = lower.slice('google/'.length)
    }
    if (lower.startsWith('deepseek/')) {
        lower = lower.slice('deepseek/'.length)
    }

    // Explicit non-thinking models first
    if (
        lower.includes('claude-3-5') ||
        lower.includes('claude-3.5') ||
        lower.includes('claude-3-opus') ||
        lower.includes('claude-3-haiku') ||
        lower.includes('claude-2')
    ) {
        return false
    }

    if (
        lower === 'gpt-4o' ||
        lower === 'gpt-4o-mini' ||
        lower.startsWith('gpt-4o') ||
        lower.startsWith('gpt-4') ||
        lower.startsWith('gpt-3.5')
    ) {
        return false
    }

    if (
        lower.includes('gemini-1.5') ||
        lower.includes('gemini-1.0') ||
        lower === 'gemini-pro' ||
        lower === 'gemini-flash' ||
        (lower.includes('gemini-2.0-flash') && !lower.includes('thinking'))
    ) {
        return false
    }

    if (
        lower.includes('llama') ||
        lower.includes('mistral') ||
        lower.includes('codestral') ||
        lower.includes('ministral') ||
        lower.includes('magistral') ||
        lower.includes('devstral') ||
        lower.includes('sarvam') ||
        lower.includes('minimax') ||
        lower.includes('gemma') ||
        lower.includes('command-r')
    ) {
        if (
            !lower.includes('thinking') &&
            !lower.includes('reasoning') &&
            !lower.includes('reasoner')
        ) {
            return false
        }
    }

    // Known thinking / reasoning models
    if (
        lower.startsWith('o1') ||
        lower.startsWith('o3') ||
        lower.startsWith('o4') ||
        lower.includes('/o1') ||
        lower.includes('/o3') ||
        lower.includes('/o4')
    ) {
        return true
    }

    if (
        lower.includes('claude-3-7') ||
        lower.includes('claude-3.7') ||
        lower.includes('claude-4') ||
        lower.includes('claude-opus-4') ||
        lower.includes('claude-sonnet-4') ||
        lower.includes('claude-haiku-4') ||
        lower.includes('claude-5') ||
        lower.includes('claude-fable-5') ||
        lower.includes('sonnet-5') ||
        lower.includes('opus-5')
    ) {
        return true
    }

    if (
        lower.includes('gemini-2.5') ||
        lower.includes('gemini-3') ||
        lower.includes('december-auto')
    ) {
        return true
    }

    if (
        lower.includes('deepseek-reasoner') ||
        lower.includes('deepseek-r1') ||
        lower.includes('r1-1776')
    ) {
        return true
    }

    if (
        lower.includes('glm-5') ||
        lower.includes('glm5') ||
        lower.includes('abliterated-model-large-v2')
    ) {
        return true
    }

    if (lower.includes('qwq')) {
        return true
    }

    if (lower.includes('thinking') || lower.includes('reasoning') || lower.includes('reasoner')) {
        return true
    }

    return false
}

export interface ProviderConfig<T> {
    id: string
    name: string
    baseUrl?: string
    auth?: Record<string, string>
    models: any[]
    api: T
}

export function createProvider<T>(
    config: ProviderConfig<T>,
    streamImpl: (
        messages: Message[],
        tools?: ProviderTool[],
        systemPrompt?: string,
        modelOptions?: Record<string, any>,
        signal?: AbortSignal
    ) => AsyncGenerator<ProviderStreamChunk, void, unknown>
): LLMProvider {
    return {
        id: config.id,
        stream: streamImpl,
    }
}
