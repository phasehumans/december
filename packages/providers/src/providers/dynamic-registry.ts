import { OpenAIProvider, openaiProvider } from './openai.ts'

import type { LLMProvider } from '../types.ts'

export interface DynamicEndpoint {
    id: string
    baseURL: string
    envVar?: string
    defaultHeaders?: Record<string, string>
}

export const DYNAMIC_ENDPOINTS: Record<string, DynamicEndpoint> = {
    abacus: { id: 'abacus', baseURL: 'https://routellm.abacus.ai/v1', envVar: 'ABACUS_API_KEY' },
    ai21: { id: 'ai21', baseURL: 'https://api.ai21.com/studio/v1', envVar: 'AI21_API_KEY' },
    arcee: { id: 'arcee', baseURL: 'https://api.arcee.ai/api/v1', envVar: 'ARCEE_API_KEY' },
    cerebras: { id: 'cerebras', baseURL: 'https://api.cerebras.ai/v1', envVar: 'CEREBRAS_API_KEY' },
    cohere: { id: 'cohere', baseURL: 'https://api.cohere.com/v2', envVar: 'COHERE_API_KEY' },
    dashscope: {
        id: 'dashscope',
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        envVar: 'DASHSCOPE_API_KEY',
    },
    deepinfra: {
        id: 'deepinfra',
        baseURL: 'https://api.deepinfra.com/v1/openai',
        envVar: 'DEEPINFRA_API_KEY',
    },
    deepseek: { id: 'deepseek', baseURL: 'https://api.deepseek.com', envVar: 'DEEPSEEK_API_KEY' },
    fireworks: {
        id: 'fireworks',
        baseURL: 'https://api.fireworks.ai/inference/v1',
        envVar: 'FIREWORKS_API_KEY',
    },
    groq: { id: 'groq', baseURL: 'https://api.groq.com/openai/v1', envVar: 'GROQ_API_KEY' },
    huggingface: {
        id: 'huggingface',
        baseURL: 'https://router.huggingface.co/v1',
        envVar: 'HF_TOKEN',
    },
    hyperbolic: {
        id: 'hyperbolic',
        baseURL: 'https://api.hyperbolic.xyz/v1',
        envVar: 'HYPERBOLIC_API_KEY',
    },
    inception: {
        id: 'inception',
        baseURL: 'https://api.inceptionlabs.ai/v1/',
        envVar: 'INCEPTION_API_KEY',
    },
    kimi: { id: 'kimi', baseURL: 'https://api.kimi.com/coding', envVar: 'KIMI_API_KEY' },
    'kimi-code-plan-cn': {
        id: 'kimi-code-plan-cn',
        baseURL: 'https://api.kimi.com/coding/v1',
        envVar: 'KIMI_API_KEY',
    },
    'kimi-code-plan-global': {
        id: 'kimi-code-plan-global',
        baseURL: 'https://api.kimi.ai/coding/v1',
        envVar: 'KIMI_API_KEY',
    },
    'kimi-code-plan': {
        id: 'kimi-code-plan',
        baseURL: 'https://api.kimi.ai/coding/v1',
        envVar: 'KIMI_API_KEY',
    },
    meta: { id: 'meta', baseURL: 'https://api.meta.ai/v1', envVar: 'META_API_KEY' },
    minimax: { id: 'minimax', baseURL: 'https://api.minimax.io/v1', envVar: 'MINIMAX_API_KEY' },
    mistral: { id: 'mistral', baseURL: 'https://api.mistral.ai/v1', envVar: 'MISTRAL_API_KEY' },
    moonshot: { id: 'moonshot', baseURL: 'https://api.moonshot.ai/v1', envVar: 'MOONSHOT_API_KEY' },
    morph: { id: 'morph', baseURL: 'https://api.morphllm.com/v1', envVar: 'MORPH_API_KEY' },
    nebius: {
        id: 'nebius',
        baseURL: 'https://api.tokenfactory.nebius.com/v1',
        envVar: 'NEBIUS_API_KEY',
    },
    'novita-ai': {
        id: 'novita-ai',
        baseURL: 'https://api.novita.ai/openai',
        envVar: 'NOVITA_API_KEY',
    },
    nvidia: {
        id: 'nvidia',
        baseURL: 'https://integrate.api.nvidia.com/v1',
        envVar: 'NVIDIA_API_KEY',
    },
    perplexity: {
        id: 'perplexity',
        baseURL: 'https://api.perplexity.ai',
        envVar: 'PERPLEXITY_API_KEY',
    },
    'perplexity-agent': {
        id: 'perplexity-agent',
        baseURL: 'https://api.perplexity.ai/v1',
        envVar: 'PERPLEXITY_API_KEY',
    },
    sakana: { id: 'sakana', baseURL: 'https://api.sakana.ai/v1', envVar: 'SAKANA_API_KEY' },
    sambanova: {
        id: 'sambanova',
        baseURL: 'https://api.sambanova.ai/v1',
        envVar: 'SAMBANOVA_API_KEY',
    },
    sarvam: { id: 'sarvam', baseURL: 'https://api.sarvam.ai/v1', envVar: 'SARVAM_API_KEY' },
    siliconflow: {
        id: 'siliconflow',
        baseURL: 'https://api.siliconflow.cn/v1',
        envVar: 'SILICONFLOW_API_KEY',
    },
    stepfun: { id: 'stepfun', baseURL: 'https://api.stepfun.ai/v1', envVar: 'STEPFUN_API_KEY' },
    'tencent-tokenhub': {
        id: 'tencent-tokenhub',
        baseURL: 'https://tokenhub.tencentmaas.com/v1',
        envVar: 'TENCENT_TOKENHUB_API_KEY',
    },
    thinkingmachines: {
        id: 'thinkingmachines',
        baseURL: 'https://tinker.thinkingmachines.dev/services/tinker-prod/anthropic/api',
        envVar: 'TINKER_API_KEY',
    },
    together: {
        id: 'together',
        baseURL: 'https://api.together.xyz/v1',
        envVar: 'TOGETHER_API_KEY',
    },
    upstage: {
        id: 'upstage',
        baseURL: 'https://api.upstage.ai/v1/solar',
        envVar: 'UPSTAGE_API_KEY',
    },
    volcengine: {
        id: 'volcengine',
        baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
        envVar: 'ARK_API_KEY',
    },
    'wafer.ai': { id: 'wafer.ai', baseURL: 'https://pass.wafer.ai/v1', envVar: 'WAFER_API_KEY' },
    watsonx: {
        id: 'watsonx',
        baseURL: 'https://us-south.ml.cloud.ibm.com/v1',
        envVar: 'WATSONX_AI_APIKEY',
    },
    xai: { id: 'xai', baseURL: 'https://api.x.ai/v1', envVar: 'XAI_API_KEY' },
    xiaomi: { id: 'xiaomi', baseURL: 'https://api.xiaomimimo.com/v1', envVar: 'XIAOMI_API_KEY' },
    zai: { id: 'zai', baseURL: 'https://api.z.ai/api/coding/paas/v4', envVar: 'ZAI_API_KEY' },
    // Common aliases
    'moonshot-ai': { id: 'moonshot-ai', baseURL: 'https://api.moonshot.ai/v1' },
    'mistral-ai': { id: 'mistral-ai', baseURL: 'https://api.mistral.ai/v1' },
    mimo: { id: 'mimo', baseURL: 'https://api.xiaomimimo.com/v1' },
    'zai-coding-plan': { id: 'zai-coding-plan', baseURL: 'https://api.z.ai/api/coding/paas/v4' },
    'zai-paas': { id: 'zai-paas', baseURL: 'https://api.z.ai/api/paas/v4' },
    zhipuai: { id: 'zhipuai', baseURL: 'https://api.z.ai/api/coding/paas/v4' },
    nim: { id: 'nim', baseURL: 'https://integrate.api.nvidia.com/v1' },
    siliconcloud: { id: 'siliconcloud', baseURL: 'https://api.siliconflow.cn/v1' },
    'siliconflow-intl': { id: 'siliconflow-intl', baseURL: 'https://api.siliconflow.com/v1' },
    'siliconflow-cn': { id: 'siliconflow-cn', baseURL: 'https://api.siliconflow.cn/v1' },
    togetherai: { id: 'togetherai', baseURL: 'https://api.together.xyz/v1' },
    fireworksai: { id: 'fireworksai', baseURL: 'https://api.fireworks.ai/inference/v1' },
    'minimax-ai': { id: 'minimax-ai', baseURL: 'https://api.minimax.io/v1' },
    'arcee-ai': { id: 'arcee-ai', baseURL: 'https://api.arcee.ai/api/v1' },
    'meta-ai': { id: 'meta-ai', baseURL: 'https://api.meta.ai/v1' },
    'sakana-ai': { id: 'sakana-ai', baseURL: 'https://api.sakana.ai/v1' },
    'sarvam-ai': { id: 'sarvam-ai', baseURL: 'https://api.sarvam.ai/v1' },
    'stepfun-ai': { id: 'stepfun-ai', baseURL: 'https://api.stepfun.ai/v1' },
    solar: { id: 'solar', baseURL: 'https://api.upstage.ai/v1/solar' },
    alibaba: { id: 'alibaba', baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1' },
    qwen: { id: 'qwen', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
}

export function getDynamicEndpoint(id: string): DynamicEndpoint | undefined {
    return DYNAMIC_ENDPOINTS[id.toLowerCase().trim()]
}

export function createDynamicSubprovider(
    id: string,
    apiKey?: string,
    options?: { baseURL?: string; headers?: Record<string, string> }
): LLMProvider {
    const endpoint = getDynamicEndpoint(id)
    const effectiveBaseURL = options?.baseURL || endpoint?.baseURL || 'https://api.openai.com/v1'
    const effectiveKey = apiKey || (endpoint?.envVar ? process.env[endpoint.envVar] : undefined)
    const p = openaiProvider(effectiveBaseURL, effectiveKey, options?.headers)
    return {
        ...p,
        id,
    }
}

export function createDynamicSubproviderClass(id: string) {
    return class extends OpenAIProvider {
        public override id = id
        constructor(apiKey?: string, baseURL?: string) {
            const endpoint = getDynamicEndpoint(id)
            const effectiveBaseURL = baseURL || endpoint?.baseURL
            const effectiveKey =
                apiKey || (endpoint?.envVar ? process.env[endpoint.envVar] : undefined)
            super(effectiveBaseURL, effectiveKey)
        }
    }
}

export const AbacusProvider = createDynamicSubproviderClass('abacus')
export const Ai21Provider = createDynamicSubproviderClass('ai21')
export const ArceeProvider = createDynamicSubproviderClass('arcee')
export const CerebrasProvider = createDynamicSubproviderClass('cerebras')
export const CohereProvider = createDynamicSubproviderClass('cohere')
export const DashScopeProvider = createDynamicSubproviderClass('dashscope')
export const DeepinfraProvider = createDynamicSubproviderClass('deepinfra')
export const DeepSeekProvider = createDynamicSubproviderClass('deepseek')
export const FireworksProvider = createDynamicSubproviderClass('fireworks')
export const GroqProvider = createDynamicSubproviderClass('groq')
export const HuggingFaceProvider = createDynamicSubproviderClass('huggingface')
export const HyperbolicProvider = createDynamicSubproviderClass('hyperbolic')
export const InceptionProvider = createDynamicSubproviderClass('inception')
export const KimiCodePlanCnProvider = createDynamicSubproviderClass('kimi-code-plan-cn')
export const KimiCodePlanGlobalProvider = createDynamicSubproviderClass('kimi-code-plan-global')
export const KimiCodePlanProvider = createDynamicSubproviderClass('kimi-code-plan')
export const MetaProvider = createDynamicSubproviderClass('meta')
export const MiniMaxProvider = createDynamicSubproviderClass('minimax')
export const MistralProvider = createDynamicSubproviderClass('mistral')
export const MoonshotProvider = createDynamicSubproviderClass('moonshot')
export const MorphProvider = createDynamicSubproviderClass('morph')
export const NebiusProvider = createDynamicSubproviderClass('nebius')
export const NovitaAiProvider = createDynamicSubproviderClass('novita-ai')
export const NvidiaProvider = createDynamicSubproviderClass('nvidia')
export const PerplexityAgentProvider = createDynamicSubproviderClass('perplexity-agent')
export const PerplexityProvider = createDynamicSubproviderClass('perplexity')
export const SakanaProvider = createDynamicSubproviderClass('sakana')
export const SambaNovaProvider = createDynamicSubproviderClass('sambanova')
export const SarvamProvider = createDynamicSubproviderClass('sarvam')
export const SiliconFlowProvider = createDynamicSubproviderClass('siliconflow')
export const StepFunProvider = createDynamicSubproviderClass('stepfun')
export const TencentTokenhubProvider = createDynamicSubproviderClass('tencent-tokenhub')
export const TogetherProvider = createDynamicSubproviderClass('together')
export const UpstageProvider = createDynamicSubproviderClass('upstage')
export const VolcengineProvider = createDynamicSubproviderClass('volcengine')
export const WaferAiProvider = createDynamicSubproviderClass('wafer.ai')
export const WatsonxProvider = createDynamicSubproviderClass('watsonx')
export const XAIProvider = createDynamicSubproviderClass('xai')
export const XiaomiProvider = createDynamicSubproviderClass('xiaomi')
export const ZAIProvider = createDynamicSubproviderClass('zai')
export const ZhipuAIProvider = ZAIProvider
