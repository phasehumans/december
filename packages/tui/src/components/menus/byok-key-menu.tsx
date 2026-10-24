import { Box, Text, useInput } from 'ink'
import React from 'react'

import { THEME } from '../../theme'
import { Spinner } from '../spinner'
import TextInput from '../text-input'

import { PROVIDER_MENU_ITEMS } from './byok-provider-menu'
import { MenuFooter } from './menu-footer'

export const PROVIDER_NAMES: Record<string, string> = {
    ...Object.fromEntries(PROVIDER_MENU_ITEMS.map((item) => [item.value, item.label])),
    abliteration: 'Abliteration AI',
    abliterationai: 'Abliteration AI',
    'abliteration-ai': 'Abliteration AI',
    agentrouter: 'AgentRouter',
    'agentrouter.org': 'AgentRouter',
    agnes: 'Agnes AI',
    agnesai: 'Agnes AI',
    'agnes-ai': 'Agnes AI',
    aiand: 'AI&',
    aki: 'AKI.IO',
    'aki-io': 'AKI.IO',
    akiio: 'AKI.IO',
    ambient: 'Ambient',
    anthropic: 'Anthropic',
    arcee: 'Arcee AI',
    arceeai: 'Arcee AI',
    'arcee-ai': 'Arcee AI',
    auriko: 'Auriko',
    aurikoai: 'Auriko',
    'auriko-ai': 'Auriko',
    baseten: 'Baseten',
    basetenco: 'Baseten',
    'baseten-co': 'Baseten',
    cerebras: 'Cerebras',
    claude: 'Anthropic',
    codex: 'OpenAI',
    cohere: 'Cohere',
    dashscope: 'Qwen (DashScope)',
    december: 'December Cloud',
    december_proxy: 'December Cloud',
    deepseek: 'DeepSeek',
    deepgram: 'Deepgram',
    fireworks: 'Fireworks AI',
    google: 'Google',
    gemini: 'Google AI Studio',
    groq: 'Groq',
    huggingface: 'Hugging Face',
    hyperbolic: 'Hyperbolic',
    kimi: 'Kimi',
    meta: 'Meta',
    metaai: 'Meta',
    'meta-ai': 'Meta',
    minimax: 'MiniMax',
    minimaxai: 'MiniMax',
    'minimax-ai': 'MiniMax',
    mistral: 'Mistral',
    mistralai: 'Mistral',
    'mistral-ai': 'Mistral',
    moonshot: 'Moonshot AI',
    moonshoot: 'Moonshot AI',
    moonshotai: 'Moonshot AI',
    'moonshot-ai': 'Moonshot AI',
    nvidia: 'NVIDIA NIM',
    openai: 'OpenAI',
    openrouter: 'OpenRouter',
    perplexity: 'Perplexity AI',
    qwen: 'Qwen (DashScope)',
    sakana: 'Sakana AI',
    'sakana-ai': 'Sakana AI',
    sakanaai: 'Sakana AI',
    sarvam: 'Sarvam AI',
    sarvamai: 'Sarvam AI',
    'sarvam-ai': 'Sarvam AI',
    stepfun: 'StepFun (Global)',
    stepfunai: 'StepFun (Global)',
    'stepfun-ai': 'StepFun (Global)',
    upstage: 'Upstage Solar',
    upstageai: 'Upstage Solar',
    solar: 'Upstage Solar',
    thinkingmachines: 'Thinking Machines (Tinker)',
    tinker: 'Thinking Machines (Tinker)',
    inkling: 'Thinking Machines (Tinker)',
    sambanova: 'SambaNova Cloud',
    siliconflow: 'SiliconFlow',
    together: 'Together AI',
    xAI: 'xAI',
    xai: 'xAI',
    xiaomi: 'Xiaomi',
    mimo: 'Xiaomi',
    zai: 'ZAI',
    zhipu: 'Zhipu AI',
    zhipuai: 'Zhipu AI',
}

export const PROVIDER_KEY_URLS: Record<string, string> = {
    abacus: 'https://abacus.ai/help/api',
    abliteration: 'https://abliteration.ai/console',
    'abliteration-ai': 'https://abliteration.ai/console',
    abliterationai: 'https://abliteration.ai/console',
    above: 'https://above.dev/',
    agentrouter: 'https://agentrouter.org/console/token',
    'agentrouter.org': 'https://agentrouter.org/console/token',
    agnes: 'https://platform.agnes-ai.com/settings/apiKeys',
    'agnes-ai': 'https://platform.agnes-ai.com/settings/apiKeys',
    agnesai: 'https://platform.agnes-ai.com/settings/apiKeys',
    ai21: 'https://studio.ai21.com/account/account',
    aiand: 'https://console.aiand.com/api-keys',
    aki: 'https://aki.io/admin/user-dashboard',
    'aki-io': 'https://aki.io/admin/user-dashboard',
    akiio: 'https://aki.io/admin/user-dashboard',
    ambient: 'https://app.ambient.xyz/keys',
    amd: 'https://developer.amd.com.cn/',
    anthropic: 'https://console.anthropic.com/settings/keys',
    anyapi: 'https://docs.anyapi.ai',
    arcee: 'https://platform.arcee.ai/api/api-keys',
    'arcee-ai': 'https://platform.arcee.ai/api/api-keys',
    arceeai: 'https://platform.arcee.ai/api/api-keys',
    auriko: 'https://www.auriko.ai/dashboard',
    'auriko-ai': 'https://www.auriko.ai/dashboard',
    aurikoai: 'https://www.auriko.ai/dashboard',
    baseten: 'https://app.baseten.co/settings/api_keys',
    'baseten-co': 'https://app.baseten.co/settings/api_keys',
    basetenco: 'https://app.baseten.co/settings/api_keys',
    berget: 'https://berget.ai/',
    blueclaw: 'https://blueclaw.network/',
    cerebras: 'https://cloud.cerebras.ai/platform',
    chutes: 'https://chutes.ai/',
    clarifai: 'https://clarifai.com/settings/security',
    claude: 'https://console.anthropic.com/settings/keys',
    'cloudferro-sherlock': 'https://cloudferro.com/',
    'cloudflare-ai-gateway': 'https://developers.cloudflare.com/ai-gateway/',
    codex: 'https://platform.openai.com/api-keys',
    cohere: 'https://dashboard.cohere.com/api-keys',
    coralbricks: 'https://coralbricks.ai/',
    cortecs: 'https://cortecs.ai/',
    crusoe: 'https://console.crusoecloud.com/',
    dashscope: 'https://dashscope.console.aliyun.com/apiKey',
    'dashscope-cn': 'https://dashscope.console.aliyun.com/apiKey',
    'dashscope-intl': 'https://dashscope.console.aliyun.com/apiKey',
    december: 'https://december.sh/login',
    december_proxy: 'https://december.sh/login',
    deepinfra: 'https://deepinfra.com/dash/api_keys',
    deepseek: 'https://platform.deepseek.com/api_keys',
    digitalocean: 'https://cloud.digitalocean.com/account/api/tokens',
    deepgram: 'https://console.deepgram.com',
    dinference: 'https://dinference.com/',
    drun: 'https://d.run/',
    edenai: 'https://docs.edenai.co',
    empiriolabs: 'https://empiriolabs.ai/',
    evroc: 'https://evroc.com/',
    fastrouter: 'https://fastrouter.ai/models',
    fireworks: 'https://app.fireworks.ai/api-keys',
    friendli: 'https://suite.friendli.ai/',
    gemini: 'https://aistudio.google.com/app/apikey',
    google: 'https://aistudio.google.com/app/apikey',
    groq: 'https://console.groq.com/keys',
    helicone: 'https://helicone.ai/models',
    hetzner: 'https://console.hetzner.cloud/',
    'hpc-ai': 'https://hpc-ai.com/',
    huggingface: 'https://huggingface.co/settings/tokens',
    hyper: 'https://hyper.charm.land/',
    hyperbolic: 'https://app.hyperbolic.ai/settings',
    inception: 'https://inceptionlabs.ai/',
    inco: 'https://inco.ai/',
    inkling: 'https://tinker.thinkingmachines.ai/',
    'io-net': 'https://cloud.io.net/',
    iteracompute: 'https://iteracompute.com/',
    kilo: 'https://kilo.ai',
    kimi: 'https://platform.moonshot.ai/console/api-keys',
    'kimi-code-plan-cn': 'https://www.kimi.com/code/docs/en/kimi-code/models.html',
    'kimi-code-plan-global': 'https://www.kimi.ai/code/docs/en/kimi-code/models.html',
    kosmik: 'https://koscompute.com/',
    llmgateway: 'https://llmgateway.io/docs',
    'merge-gateway': 'https://docs.merge.dev/merge-gateway',
    meta: 'https://dev.meta.ai/',
    'meta-ai': 'https://dev.meta.ai/',
    metaai: 'https://dev.meta.ai/',
    mimo: 'https://platform.xiaomimimo.com/console/api-keys',
    minimax: 'https://platform.minimax.io/console/access',
    'minimax-ai': 'https://platform.minimax.io/console/access',
    minimaxai: 'https://platform.minimax.io/console/access',
    mistral: 'https://console.mistral.ai/api-keys/',
    'mistral-ai': 'https://console.mistral.ai/api-keys/',
    mistralai: 'https://console.mistral.ai/api-keys/',
    modal: 'https://modal.com/settings',
    modelscope: 'https://modelscope.cn/my/myaccesstoken',
    moonshoot: 'https://platform.moonshot.ai/console/api-keys',
    moonshot: 'https://platform.moonshot.ai/console/api-keys',
    'moonshot-ai': 'https://platform.moonshot.ai/console/api-keys',
    moonshotai: 'https://platform.moonshot.ai/console/api-keys',
    morph: 'https://morphllm.com/',
    'nano-gpt': 'https://nano-gpt.com/api',
    nearai: 'https://cloud.near.ai/',
    nebius: 'https://tokenfactory.nebius.com/',
    'novita-ai': 'https://novita.ai/settings/key-management',
    nvidia: 'https://build.nvidia.com/',
    openai: 'https://platform.openai.com/api-keys',
    opencode: 'https://opencode.ai/docs/zen',
    'opencode-go': 'https://opencode.ai/docs/go',
    openreason: 'https://openreason.app/',
    openrouter: 'https://openrouter.ai/settings/keys',
    opper: 'https://opper.ai/models',
    orcarouter: 'https://docs.orcarouter.ai',
    ovhcloud: 'https://endpoints.kepler.ai.cloud.ovh.net/',
    pendra: 'https://pendra.ai/',
    perplexity: 'https://www.perplexity.ai/settings/api',
    'perplexity-agent': 'https://docs.perplexity.ai/docs/agent-api/models',
    poe: 'https://poe.com/api_key',
    'qiniu-ai': 'https://portal.qiniu.com/',
    qwen: 'https://dashscope.console.aliyun.com/apiKey',
    'regolo-ai': 'https://docs.regolo.ai/',
    requesty: 'https://requesty.ai/solution/llm-routing/models',
    runinfra: 'https://runinfra.ai/docs',
    sakana: 'https://console.sakana.ai/api-keys',
    'sakana-ai': 'https://console.sakana.ai/api-keys',
    sakanaai: 'https://console.sakana.ai/api-keys',
    'salad-cloud': 'https://portal.salad.com/',
    sambanova: 'https://cloud.sambanova.ai/apis',
    sarvam: 'https://dashboard.sarvam.ai/api-keys',
    'sarvam-ai': 'https://indus.sarvam.ai/',
    sarvamai: 'https://indus.sarvam.ai/',
    scaleway: 'https://console.scaleway.com/project/credentials',
    siliconcloud: 'https://cloud.siliconflow.cn/account/ak',
    siliconflow: 'https://cloud.siliconflow.com/account/ak',
    'siliconflow-cn': 'https://cloud.siliconflow.cn/account/ak',
    solar: 'https://console.upstage.ai',
    stackit: 'https://portal.stackit.cloud/',
    standardcompute: 'https://standardcompute.com/models',
    stepfun: 'https://platform.stepfun.ai/interface-key',
    'stepfun-ai': 'https://platform.stepfun.ai/interface-key',
    stepfunai: 'https://platform.stepfun.ai/interface-key',
    subconscious: 'https://subconscious.dev/',
    synthetic: 'https://synthetic.new/',
    'tencent-tokenhub': 'https://cloud.tencent.com/product/hunyuan',
    'the-grid-ai': 'https://thegrid.ai/',
    thinkingmachines: 'https://tinker.thinkingmachines.ai/',
    tinfoil: 'https://tinfoil.sh/',
    tinker: 'https://tinker.thinkingmachines.ai/',
    together: 'https://api.together.ai/settings/api-keys',
    togetherai: 'https://api.together.ai/settings/api-keys',
    upstage: 'https://console.upstage.ai/api-keys',
    upstageai: 'https://console.upstage.ai',
    venice: 'https://venice.ai/settings/api',
    vercel: 'https://vercel.com/docs/ai/ai-gateway',
    vivgrid: 'https://vivgrid.com/',
    volcengine: 'https://console.volcengine.com/ark',
    vultr: 'https://my.vultr.com/settings/#settingsapi',
    'wafer.ai': 'https://wafer.ai/',
    watsonx: 'https://cloud.ibm.com/iam/apikeys',
    xAI: 'https://console.x.ai/',
    xai: 'https://console.x.ai/',
    xiaomi: 'https://platform.xiaomimimo.com/console/api-keys',
    zai: 'https://z.ai/manage-apikey/apikey-list',
    zhipu: 'https://open.bigmodel.cn/usercenter/apikeys',
    zhipuai: 'https://open.bigmodel.cn/usercenter/apikeys',
}

export const PROVIDER_KEY_NOTES: Record<string, string> = {
    deepgram: ' ($200 free credit on signup)',
}

export function formatProviderName(provider?: string): string {
    if (!provider) return 'Provider'
    return PROVIDER_NAMES[provider] || provider.charAt(0).toUpperCase() + provider.slice(1)
}

export function ByokKeyMenu(props: any) {
    const {
        selectedProvider,
        apiKey,
        setApiKey,
        handleKeySubmit,
        isStreaming,
        authError,
        setAuthError,
        setAuthMode,
    } = props
    const formattedProvider = formatProviderName(selectedProvider)
    const keyUrl = selectedProvider ? PROVIDER_KEY_URLS[selectedProvider] : undefined
    const keyNote = selectedProvider
        ? PROVIDER_KEY_NOTES[selectedProvider.toLowerCase().trim()]
        : undefined

    useInput((input, key) => {
        if (key.escape || input === '\u001B') {
            if (setAuthError) {
                setAuthError(null)
            }
            if (setApiKey) {
                setApiKey('')
            }
            if (setAuthMode) {
                setAuthMode('byok_provider')
            }
            return
        }
    })

    return (
        <Box flexDirection="column">
            <Box flexDirection="column" marginBottom={1}>
                <Text color={THEME.colors.text}>Enter API Key for {formattedProvider}:</Text>
                {keyUrl && (
                    <Text italic color={THEME.colors.muted}>
                        {"Don't have an API key? Get one at "}
                        <Text color={THEME.colors.brand}>{keyUrl}</Text>
                        {keyNote}
                    </Text>
                )}
            </Box>
            <Box>
                <Text color={THEME.colors.brand} bold={false}>
                    {`${THEME.glyphs.prompt} `}
                </Text>
                <TextInput
                    focus={!isStreaming}
                    value={apiKey}
                    onChange={setApiKey}
                    onSubmit={handleKeySubmit}
                />
            </Box>
            {isStreaming ? (
                <Box marginTop={1}>
                    <Spinner label={`Verifying and saving API key for ${formattedProvider}...`} />
                </Box>
            ) : (
                <>
                    {authError && (
                        <Box marginTop={1}>
                            <Text color={THEME.colors.error}>{authError}</Text>
                        </Box>
                    )}
                    <MenuFooter
                        items={[
                            { key: 'enter', label: 'submit' },
                            { key: 'esc', label: 'close' },
                        ]}
                    />
                </>
            )}
        </Box>
    )
}
