import { OpenAIProvider, openaiProvider } from './openai.ts'

import type { LLMProvider } from '../types.ts'

export interface DynamicEndpoint {
    id: string
    baseURL: string
    envVar?: string
    defaultHeaders?: Record<string, string>
}

export const DYNAMIC_ENDPOINTS: Record<string, DynamicEndpoint> = {
    '302ai': { id: '302ai', baseURL: 'https://api.302.ai/v1' },
    abacus: { id: 'abacus', baseURL: 'https://routellm.abacus.ai/v1', envVar: 'ABACUS_API_KEY' },
    abliteration: {
        id: 'abliteration',
        baseURL: 'https://api.abliteration.ai/v1',
        envVar: 'ABLITERATION_API_KEY',
    },
    above: { id: 'above', baseURL: 'https://api.above.dev/v1', envVar: 'ABOVE_API_KEY' },
    agentrouter: {
        id: 'agentrouter',
        baseURL: 'https://agentrouter.org/v1',
        envVar: 'AGENTROUTER_API_KEY',
        defaultHeaders: { 'User-Agent': 'claude-cli/2.1.0 (external, sdk-cli)' },
    },
    agnes: { id: 'agnes', baseURL: 'https://apihub.agnes-ai.com/v1', envVar: 'AGNES_API_KEY' },
    ai21: { id: 'ai21', baseURL: 'https://api.ai21.com/studio/v1', envVar: 'AI21_API_KEY' },
    aiand: { id: 'aiand', baseURL: 'https://api.aiand.com/v1', envVar: 'AIAND_API_KEY' },
    aki: { id: 'aki', baseURL: 'https://aki.io/v1', envVar: 'AKI_API_KEY' },
    ambient: { id: 'ambient', baseURL: 'https://api.ambient.xyz/v1', envVar: 'AMBIENT_API_KEY' },
    amd: {
        id: 'amd',
        baseURL: 'https://developer.amd.com.cn/radeon/api/v1',
        envVar: 'AMD_API_KEY',
    },
    anyapi: { id: 'anyapi', baseURL: 'https://api.anyapi.ai/v1', envVar: 'ANYAPI_API_KEY' },
    arcee: { id: 'arcee', baseURL: 'https://api.arcee.ai/api/v1', envVar: 'ARCEE_API_KEY' },
    auriko: { id: 'auriko', baseURL: 'https://api.auriko.ai/v1', envVar: 'AURIKO_API_KEY' },
    baseten: {
        id: 'baseten',
        baseURL: 'https://inference.baseten.co/v1',
        envVar: 'BASETEN_API_KEY',
    },
    berget: { id: 'berget', baseURL: 'https://api.berget.ai/v1', envVar: 'BERGET_API_KEY' },
    blueclaw: {
        id: 'blueclaw',
        baseURL: 'https://openai.blueclaw.network/v1',
        envVar: 'BLUECLAW_API_KEY',
    },
    cerebras: { id: 'cerebras', baseURL: 'https://api.cerebras.ai/v1', envVar: 'CEREBRAS_API_KEY' },
    chutes: { id: 'chutes', baseURL: 'https://llm.chutes.ai/v1', envVar: 'CHUTES_API_KEY' },
    clarifai: {
        id: 'clarifai',
        baseURL: 'https://api.clarifai.com/v2/ext/openai/v1',
        envVar: 'CLARIFAI_PAT',
    },
    'cloudferro-sherlock': {
        id: 'cloudferro-sherlock',
        baseURL: 'https://api-sherlock.cloudferro.com/openai/v1/',
        envVar: 'CLOUDFERRO_SHERLOCK_API_KEY',
    },
    'cloudflare-ai-gateway': {
        id: 'cloudflare-ai-gateway',
        baseURL: 'https://gateway.ai.cloudflare.com/v1',
        envVar: 'CLOUDFLARE_API_TOKEN',
    },
    cohere: { id: 'cohere', baseURL: 'https://api.cohere.com/v2', envVar: 'COHERE_API_KEY' },
    coralbricks: {
        id: 'coralbricks',
        baseURL: 'https://inference.coralbricks.ai/v1',
        envVar: 'CORAL_API_KEY',
    },
    cortecs: { id: 'cortecs', baseURL: 'https://api.cortecs.ai/v1', envVar: 'CORTECS_API_KEY' },
    crusoe: {
        id: 'crusoe',
        baseURL: 'https://api.inference.crusoecloud.com/v1',
        envVar: 'CRUSOE_API_KEY',
    },
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
    digitalocean: {
        id: 'digitalocean',
        baseURL: 'https://inference.do-ai.run/v1',
        envVar: 'DIGITALOCEAN_ACCESS_TOKEN',
    },
    dinference: {
        id: 'dinference',
        baseURL: 'https://api.dinference.com/v1',
        envVar: 'DINFERENCE_API_KEY',
    },
    drun: { id: 'drun', baseURL: 'https://chat.d.run/v1', envVar: 'DRUN_API_KEY' },
    edenai: { id: 'edenai', baseURL: 'https://api.edenai.run/v3', envVar: 'EDENAI_API_KEY' },
    empiriolabs: {
        id: 'empiriolabs',
        baseURL: 'https://api.empiriolabs.ai/v1',
        envVar: 'EMPIRIOLABS_API_KEY',
    },
    evroc: { id: 'evroc', baseURL: 'https://models.think.evroc.com/v1', envVar: 'EVROC_API_KEY' },
    fastrouter: {
        id: 'fastrouter',
        baseURL: 'https://go.fastrouter.ai/api/v1',
        envVar: 'FASTROUTER_API_KEY',
    },
    fireworks: {
        id: 'fireworks',
        baseURL: 'https://api.fireworks.ai/inference/v1',
        envVar: 'FIREWORKS_API_KEY',
    },
    friendli: {
        id: 'friendli',
        baseURL: 'https://api.friendli.ai/serverless/v1',
        envVar: 'FRIENDLI_TOKEN',
    },
    groq: { id: 'groq', baseURL: 'https://api.groq.com/openai/v1', envVar: 'GROQ_API_KEY' },
    helicone: {
        id: 'helicone',
        baseURL: 'https://ai-gateway.helicone.ai/v1',
        envVar: 'HELICONE_API_KEY',
    },
    hetzner: {
        id: 'hetzner',
        baseURL: 'https://inference.hetzner.com/api/v1',
        envVar: 'HETZNER_API_KEY',
    },
    'hpc-ai': {
        id: 'hpc-ai',
        baseURL: 'https://api.hpc-ai.com/inference/v1',
        envVar: 'HPC_AI_API_KEY',
    },
    huggingface: {
        id: 'huggingface',
        baseURL: 'https://router.huggingface.co/v1',
        envVar: 'HF_TOKEN',
    },
    hyper: { id: 'hyper', baseURL: 'https://hyper.charm.land/v1', envVar: 'HYPER_API_KEY' },
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
    inco: { id: 'inco', baseURL: 'https://api.inco.ai/v1', envVar: 'INCO_API_KEY' },
    'io-net': {
        id: 'io-net',
        baseURL: 'https://api.intelligence.io.solutions/api/v1',
        envVar: 'IOINTELLIGENCE_API_KEY',
    },
    iteracompute: {
        id: 'iteracompute',
        baseURL: 'https://api.iteracompute.com/v1',
        envVar: 'ITERACOMPUTE_API_KEY',
    },
    kilo: { id: 'kilo', baseURL: 'https://api.kilo.ai/api/gateway', envVar: 'KILO_API_KEY' },
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
    kimi: { id: 'kimi', baseURL: 'https://api.kimi.com/coding', envVar: 'KIMI_API_KEY' },
    kosmik: { id: 'kosmik', baseURL: 'https://api.koscompute.com/v1', envVar: 'KOSMIK_API_KEY' },
    llmgateway: {
        id: 'llmgateway',
        baseURL: 'https://api.llmgateway.io/v1',
        envVar: 'LLMGATEWAY_API_KEY',
    },
    'merge-gateway': {
        id: 'merge-gateway',
        baseURL: 'https://api-gateway.merge.dev/v1/ai-sdk',
        envVar: 'MERGE_GATEWAY_API_KEY',
    },
    meta: { id: 'meta', baseURL: 'https://api.meta.ai/v1', envVar: 'META_API_KEY' },
    minimax: { id: 'minimax', baseURL: 'https://api.minimax.io/v1', envVar: 'MINIMAX_API_KEY' },
    mistral: { id: 'mistral', baseURL: 'https://api.mistral.ai/v1', envVar: 'MISTRAL_API_KEY' },
    modal: {
        id: 'modal',
        baseURL: 'https://inference.us-west.modal.direct/v1',
        envVar: 'MODAL_PROXY_TOKEN',
    },
    modelscope: {
        id: 'modelscope',
        baseURL: 'https://api-inference.modelscope.cn/v1',
        envVar: 'MODELSCOPE_API_KEY',
    },
    moonshot: { id: 'moonshot', baseURL: 'https://api.moonshot.ai/v1', envVar: 'MOONSHOT_API_KEY' },
    morph: { id: 'morph', baseURL: 'https://api.morphllm.com/v1', envVar: 'MORPH_API_KEY' },
    'nano-gpt': {
        id: 'nano-gpt',
        baseURL: 'https://nano-gpt.com/api/v1',
        envVar: 'NANO_GPT_API_KEY',
    },
    nearai: { id: 'nearai', baseURL: 'https://cloud-api.near.ai/v1', envVar: 'NEARAI_API_KEY' },
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
    'opencode-go': {
        id: 'opencode-go',
        baseURL: 'https://opencode.ai/zen/go/v1',
        envVar: 'OPENCODE_API_KEY',
    },
    opencode: { id: 'opencode', baseURL: 'https://opencode.ai/zen/v1', envVar: 'OPENCODE_API_KEY' },
    openreason: {
        id: 'openreason',
        baseURL: 'https://api.openreason.app/v1',
        envVar: 'OPENREASON_API_KEY',
    },
    opper: { id: 'opper', baseURL: 'https://api.opper.ai/v3/compat', envVar: 'OPPER_API_KEY' },
    orcarouter: {
        id: 'orcarouter',
        baseURL: 'https://api.orcarouter.ai/v1',
        envVar: 'ORCAROUTER_API_KEY',
    },
    ovhcloud: {
        id: 'ovhcloud',
        baseURL: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1',
        envVar: 'OVHCLOUD_API_KEY',
    },
    pendra: { id: 'pendra', baseURL: 'https://api.pendra.ai/api/v1', envVar: 'PENDRA_API_KEY' },
    'perplexity-agent': {
        id: 'perplexity-agent',
        baseURL: 'https://api.perplexity.ai/v1',
        envVar: 'PERPLEXITY_API_KEY',
    },
    perplexity: {
        id: 'perplexity',
        baseURL: 'https://api.perplexity.ai',
        envVar: 'PERPLEXITY_API_KEY',
    },
    poe: { id: 'poe', baseURL: 'https://api.poe.com/v1', envVar: 'POE_API_KEY' },
    'qiniu-ai': { id: 'qiniu-ai', baseURL: 'https://api.qnaigc.com/v1', envVar: 'QINIU_API_KEY' },
    'regolo-ai': { id: 'regolo-ai', baseURL: 'https://api.regolo.ai/v1', envVar: 'REGOLO_API_KEY' },
    requesty: {
        id: 'requesty',
        baseURL: 'https://router.requesty.ai/v1',
        envVar: 'REQUESTY_API_KEY',
    },
    runinfra: {
        id: 'runinfra',
        baseURL: 'https://api.runinfra.ai/v1',
        envVar: 'RUNINFRA_GATEWAY_KEY',
    },
    sakana: { id: 'sakana', baseURL: 'https://api.sakana.ai/v1', envVar: 'SAKANA_API_KEY' },
    'salad-cloud': {
        id: 'salad-cloud',
        baseURL: 'https://matrix.salad.com/api/v1',
        envVar: 'SALAD_CLOUD_API_KEY',
    },
    sambanova: {
        id: 'sambanova',
        baseURL: 'https://api.sambanova.ai/v1',
        envVar: 'SAMBANOVA_API_KEY',
    },
    sarvam: { id: 'sarvam', baseURL: 'https://api.sarvam.ai/v1', envVar: 'SARVAM_API_KEY' },
    scaleway: { id: 'scaleway', baseURL: 'https://api.scaleway.ai/v1', envVar: 'SCALEWAY_API_KEY' },
    siliconflow: {
        id: 'siliconflow',
        baseURL: 'https://api.siliconflow.cn/v1',
        envVar: 'SILICONFLOW_API_KEY',
    },
    stackit: {
        id: 'stackit',
        baseURL: 'https://api.openai-compat.model-serving.eu01.onstackit.cloud/v1',
        envVar: 'STACKIT_API_KEY',
    },
    standardcompute: {
        id: 'standardcompute',
        baseURL: 'https://api.stdcmpt.com/v1',
        envVar: 'STANDARDCOMPUTE_API_KEY',
    },
    stepfun: { id: 'stepfun', baseURL: 'https://api.stepfun.ai/v1', envVar: 'STEPFUN_API_KEY' },
    subconscious: {
        id: 'subconscious',
        baseURL: 'https://api.subconscious.dev/v1',
        envVar: 'SUBCONSCIOUS_API_KEY',
    },
    synthetic: {
        id: 'synthetic',
        baseURL: 'https://api.synthetic.new/openai/v1',
        envVar: 'SYNTHETIC_API_KEY',
    },
    'tencent-tokenhub': {
        id: 'tencent-tokenhub',
        baseURL: 'https://tokenhub.tencentmaas.com/v1',
        envVar: 'TENCENT_TOKENHUB_API_KEY',
    },
    'the-grid-ai': {
        id: 'the-grid-ai',
        baseURL: 'https://api.thegrid.ai/v1',
        envVar: 'THEGRID_API_KEY',
    },
    thinkingmachines: {
        id: 'thinkingmachines',
        baseURL: 'https://tinker.thinkingmachines.dev/services/tinker-prod/anthropic/api',
        envVar: 'TINKER_API_KEY',
    },
    tinfoil: {
        id: 'tinfoil',
        baseURL: 'https://inference.tinfoil.sh/v1',
        envVar: 'TINFOIL_API_KEY',
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
    venice: { id: 'venice', baseURL: 'https://api.venice.ai/api/v1', envVar: 'VENICE_API_KEY' },
    vercel: {
        id: 'vercel',
        baseURL: 'https://ai-gateway.vercel.sh/v1',
        envVar: 'AI_GATEWAY_API_KEY',
    },
    vivgrid: { id: 'vivgrid', baseURL: 'https://api.vivgrid.com/v1', envVar: 'VIVGRID_API_KEY' },
    volcengine: {
        id: 'volcengine',
        baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
        envVar: 'ARK_API_KEY',
    },
    vultr: { id: 'vultr', baseURL: 'https://api.vultrinference.com/v1', envVar: 'VULTR_API_KEY' },
    'wafer.ai': { id: 'wafer.ai', baseURL: 'https://pass.wafer.ai/v1', envVar: 'WAFER_API_KEY' },
    watsonx: {
        id: 'watsonx',
        baseURL: 'https://us-south.ml.cloud.ibm.com/v1',
        envVar: 'WATSONX_AI_APIKEY',
    },
    xai: { id: 'xai', baseURL: 'https://api.x.ai/v1', envVar: 'XAI_API_KEY' },
    xiaomi: { id: 'xiaomi', baseURL: 'https://api.xiaomimimo.com/v1', envVar: 'XIAOMI_API_KEY' },
    'moonshot-ai': { id: 'moonshot-ai', baseURL: 'https://api.moonshot.ai/v1' },
    'mistral-ai': { id: 'mistral-ai', baseURL: 'https://api.mistral.ai/v1' },
    mimo: { id: 'mimo', baseURL: 'https://api.xiaomimimo.com/v1' },
    zai: { id: 'zai', baseURL: 'https://api.z.ai/api/coding/paas/v4', envVar: 'ZAI_API_KEY' },
    'zai-coding-plan': { id: 'zai-coding-plan', baseURL: 'https://api.z.ai/api/coding/paas/v4' },
    'zai-paas': { id: 'zai-paas', baseURL: 'https://api.z.ai/api/paas/v4' },
    zhipuai: { id: 'zhipuai', baseURL: 'https://api.z.ai/api/coding/paas/v4' },
    nim: { id: 'nim', baseURL: 'https://integrate.api.nvidia.com/v1' },
    siliconcloud: { id: 'siliconcloud', baseURL: 'https://api.siliconflow.cn/v1' },
    'siliconflow-intl': { id: 'siliconflow-intl', baseURL: 'https://api.siliconflow.com/v1' },
    'siliconflow-cn': { id: 'siliconflow-cn', baseURL: 'https://api.siliconflow.cn/v1' },
    togetherai: { id: 'togetherai', baseURL: 'https://api.together.xyz/v1' },
    fireworksai: { id: 'fireworksai', baseURL: 'https://api.fireworks.ai/inference/v1' },
    'agentrouter.org': { id: 'agentrouter.org', baseURL: 'https://agentrouter.org/v1' },
    'minimax-ai': { id: 'minimax-ai', baseURL: 'https://api.minimax.io/v1' },
    'arcee-ai': { id: 'arcee-ai', baseURL: 'https://api.arcee.ai/api/v1' },
    'meta-ai': { id: 'meta-ai', baseURL: 'https://api.meta.ai/v1' },
    'sakana-ai': { id: 'sakana-ai', baseURL: 'https://api.sakana.ai/v1' },
    'sarvam-ai': { id: 'sarvam-ai', baseURL: 'https://api.sarvam.ai/v1' },
    'stepfun-ai': { id: 'stepfun-ai', baseURL: 'https://api.stepfun.ai/v1' },
    solar: { id: 'solar', baseURL: 'https://api.upstage.ai/v1/solar' },
    'abliteration-ai': { id: 'abliteration-ai', baseURL: 'https://api.abliteration.ai/v1' },
    'agnes-ai': { id: 'agnes-ai', baseURL: 'https://apihub.agnes-ai.com/v1' },
    akiio: { id: 'akiio', baseURL: 'https://aki.io/v1' },
    'auriko-ai': { id: 'auriko-ai', baseURL: 'https://api.auriko.ai/v1' },
    'baseten-co': { id: 'baseten-co', baseURL: 'https://inference.baseten.co/v1' },
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

export const ThreeZeroTwoAIProvider = createDynamicSubproviderClass('302ai')
export const AbacusProvider = createDynamicSubproviderClass('abacus')
export const AbliterationProvider = createDynamicSubproviderClass('abliteration')
export const AboveProvider = createDynamicSubproviderClass('above')
export const AgentRouterProvider = createDynamicSubproviderClass('agentrouter')
export const AgnesProvider = createDynamicSubproviderClass('agnes')
export const Ai21Provider = createDynamicSubproviderClass('ai21')
export const AIAndProvider = createDynamicSubproviderClass('aiand')
export const AKIProvider = createDynamicSubproviderClass('aki')
export const AmbientProvider = createDynamicSubproviderClass('ambient')
export const AmdProvider = createDynamicSubproviderClass('amd')
export const AnyapiProvider = createDynamicSubproviderClass('anyapi')
export const ArceeProvider = createDynamicSubproviderClass('arcee')
export const AurikoProvider = createDynamicSubproviderClass('auriko')
export const BasetenProvider = createDynamicSubproviderClass('baseten')
export const BergetProvider = createDynamicSubproviderClass('berget')
export const BlueclawProvider = createDynamicSubproviderClass('blueclaw')
export const CerebrasProvider = createDynamicSubproviderClass('cerebras')
export const ChutesProvider = createDynamicSubproviderClass('chutes')
export const ClarifaiProvider = createDynamicSubproviderClass('clarifai')
export const CloudferroSherlockProvider = createDynamicSubproviderClass('cloudferro-sherlock')
export const CloudflareAiGatewayProvider = createDynamicSubproviderClass('cloudflare-ai-gateway')
export const CohereProvider = createDynamicSubproviderClass('cohere')
export const CoralbricksProvider = createDynamicSubproviderClass('coralbricks')
export const CortecsProvider = createDynamicSubproviderClass('cortecs')
export const CrusoeProvider = createDynamicSubproviderClass('crusoe')
export const DashScopeProvider = createDynamicSubproviderClass('dashscope')
export const DeepinfraProvider = createDynamicSubproviderClass('deepinfra')
export const DeepSeekProvider = createDynamicSubproviderClass('deepseek')
export const DigitaloceanProvider = createDynamicSubproviderClass('digitalocean')
export const DinferenceProvider = createDynamicSubproviderClass('dinference')
export const DrunProvider = createDynamicSubproviderClass('drun')
export const EdenaiProvider = createDynamicSubproviderClass('edenai')
export const EmpiriolabsProvider = createDynamicSubproviderClass('empiriolabs')
export const EvrocProvider = createDynamicSubproviderClass('evroc')
export const FastrouterProvider = createDynamicSubproviderClass('fastrouter')
export const FireworksProvider = createDynamicSubproviderClass('fireworks')
export const FriendliProvider = createDynamicSubproviderClass('friendli')
export const GroqProvider = createDynamicSubproviderClass('groq')
export const HeliconeProvider = createDynamicSubproviderClass('helicone')
export const HetznerProvider = createDynamicSubproviderClass('hetzner')
export const HpcAiProvider = createDynamicSubproviderClass('hpc-ai')
export const HuggingFaceProvider = createDynamicSubproviderClass('huggingface')
export const HyperProvider = createDynamicSubproviderClass('hyper')
export const HyperbolicProvider = createDynamicSubproviderClass('hyperbolic')
export const InceptionProvider = createDynamicSubproviderClass('inception')
export const IncoProvider = createDynamicSubproviderClass('inco')
export const IoNetProvider = createDynamicSubproviderClass('io-net')
export const IteracomputeProvider = createDynamicSubproviderClass('iteracompute')
export const KiloProvider = createDynamicSubproviderClass('kilo')
export const KimiCodePlanCnProvider = createDynamicSubproviderClass('kimi-code-plan-cn')
export const KimiCodePlanGlobalProvider = createDynamicSubproviderClass('kimi-code-plan-global')
export const KosmikProvider = createDynamicSubproviderClass('kosmik')
export const LlmgatewayProvider = createDynamicSubproviderClass('llmgateway')
export const MergeGatewayProvider = createDynamicSubproviderClass('merge-gateway')
export const MetaProvider = createDynamicSubproviderClass('meta')
export const MiniMaxProvider = createDynamicSubproviderClass('minimax')
export const MistralProvider = createDynamicSubproviderClass('mistral')
export const ModalProvider = createDynamicSubproviderClass('modal')
export const ModelscopeProvider = createDynamicSubproviderClass('modelscope')
export const MoonshotProvider = createDynamicSubproviderClass('moonshot')
export const MorphProvider = createDynamicSubproviderClass('morph')
export const NanoGptProvider = createDynamicSubproviderClass('nano-gpt')
export const NearaiProvider = createDynamicSubproviderClass('nearai')
export const NebiusProvider = createDynamicSubproviderClass('nebius')
export const NovitaAiProvider = createDynamicSubproviderClass('novita-ai')
export const NvidiaProvider = createDynamicSubproviderClass('nvidia')
export const OpencodeGoProvider = createDynamicSubproviderClass('opencode-go')
export const OpencodeProvider = createDynamicSubproviderClass('opencode')
export const OpenreasonProvider = createDynamicSubproviderClass('openreason')
export const OpperProvider = createDynamicSubproviderClass('opper')
export const OrcarouterProvider = createDynamicSubproviderClass('orcarouter')
export const OvhcloudProvider = createDynamicSubproviderClass('ovhcloud')
export const PendraProvider = createDynamicSubproviderClass('pendra')
export const PerplexityAgentProvider = createDynamicSubproviderClass('perplexity-agent')
export const PerplexityProvider = createDynamicSubproviderClass('perplexity')
export const PoeProvider = createDynamicSubproviderClass('poe')
export const QiniuAiProvider = createDynamicSubproviderClass('qiniu-ai')
export const RegoloAiProvider = createDynamicSubproviderClass('regolo-ai')
export const RequestyProvider = createDynamicSubproviderClass('requesty')
export const RuninfraProvider = createDynamicSubproviderClass('runinfra')
export const SakanaProvider = createDynamicSubproviderClass('sakana')
export const SaladCloudProvider = createDynamicSubproviderClass('salad-cloud')
export const SambaNovaProvider = createDynamicSubproviderClass('sambanova')
export const SarvamProvider = createDynamicSubproviderClass('sarvam')
export const ScalewayProvider = createDynamicSubproviderClass('scaleway')
export const SiliconFlowProvider = createDynamicSubproviderClass('siliconflow')
export const StackitProvider = createDynamicSubproviderClass('stackit')
export const StandardcomputeProvider = createDynamicSubproviderClass('standardcompute')
export const StepFunProvider = createDynamicSubproviderClass('stepfun')
export const SubconsciousProvider = createDynamicSubproviderClass('subconscious')
export const SyntheticProvider = createDynamicSubproviderClass('synthetic')
export const TencentTokenhubProvider = createDynamicSubproviderClass('tencent-tokenhub')
export const TheGridAiProvider = createDynamicSubproviderClass('the-grid-ai')
export const TinfoilProvider = createDynamicSubproviderClass('tinfoil')
export const TogetherProvider = createDynamicSubproviderClass('together')
export const UpstageProvider = createDynamicSubproviderClass('upstage')
export const VeniceProvider = createDynamicSubproviderClass('venice')
export const VercelProvider = createDynamicSubproviderClass('vercel')
export const VivgridProvider = createDynamicSubproviderClass('vivgrid')
export const VolcengineProvider = createDynamicSubproviderClass('volcengine')
export const VultrProvider = createDynamicSubproviderClass('vultr')
export const WaferAiProvider = createDynamicSubproviderClass('wafer.ai')
export const WatsonxProvider = createDynamicSubproviderClass('watsonx')
export const XAIProvider = createDynamicSubproviderClass('xai')
export const XiaomiProvider = createDynamicSubproviderClass('xiaomi')
export const ZAIProvider = createDynamicSubproviderClass('zai')
export const ZhipuAIProvider = ZAIProvider
