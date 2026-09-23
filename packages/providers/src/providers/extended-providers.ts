import { AnthropicProvider } from './anthropic.ts'
import { OpenAIProvider } from './openai.ts'

// Extended BYOK Providers from models.dev (142 providers)
export class ThreeZeroTwoAIProvider extends OpenAIProvider {
    public override id = '302ai'

    constructor(apiKey?: string) {
        super('https://api.302.ai/v1', apiKey || process.env['302AI_API_KEY'])
    }
}

export class AbacusProvider extends OpenAIProvider {
    public override id = 'abacus'

    constructor(apiKey?: string) {
        super('https://routellm.abacus.ai/v1', apiKey || process.env.ABACUS_API_KEY)
    }
}

export class AboveProvider extends OpenAIProvider {
    public override id = 'above'

    constructor(apiKey?: string) {
        super('https://api.above.dev/v1', apiKey || process.env.ABOVE_API_KEY)
    }
}

export class Ai21Provider extends OpenAIProvider {
    public override id = 'ai21'

    constructor(apiKey?: string) {
        super('https://api.ai21.com/studio/v1', apiKey || process.env.AI21_API_KEY)
    }
}

export class AihubmixProvider extends OpenAIProvider {
    public override id = 'aihubmix'

    constructor(apiKey?: string) {
        super('https://aihubmix.com/v1', apiKey || process.env.AIHUBMIX_API_KEY)
    }
}

export class AinetcafeProvider extends OpenAIProvider {
    public override id = 'ainetcafe'

    constructor(apiKey?: string) {
        super('https://microquickjs.com/v1', apiKey || process.env.AINETCAFE_API_KEY)
    }
}

export class AixyProvider extends OpenAIProvider {
    public override id = 'aixy'

    constructor(apiKey?: string) {
        super('https://api.aixy-gateway.com/v1', apiKey || process.env.AIXY_API_KEY)
    }
}

export class AmdProvider extends OpenAIProvider {
    public override id = 'amd'

    constructor(apiKey?: string) {
        super('https://developer.amd.com.cn/radeon/api/v1', apiKey || process.env.AMD_API_KEY)
    }
}

export class AnyapiProvider extends OpenAIProvider {
    public override id = 'anyapi'

    constructor(apiKey?: string) {
        super('https://api.anyapi.ai/v1', apiKey || process.env.ANYAPI_API_KEY)
    }
}

export class BailingProvider extends OpenAIProvider {
    public override id = 'bailing'

    constructor(apiKey?: string) {
        super(
            'https://api.tbox.cn/api/llm/v1/chat/completions',
            apiKey || process.env.BAILING_API_TOKEN
        )
    }
}

export class BergetProvider extends OpenAIProvider {
    public override id = 'berget'

    constructor(apiKey?: string) {
        super('https://api.berget.ai/v1', apiKey || process.env.BERGET_API_KEY)
    }
}

export class BlueclawProvider extends OpenAIProvider {
    public override id = 'blueclaw'

    constructor(apiKey?: string) {
        super('https://openai.blueclaw.network/v1', apiKey || process.env.BLUECLAW_API_KEY)
    }
}

export class BothubProvider extends OpenAIProvider {
    public override id = 'bothub'

    constructor(apiKey?: string) {
        super('https://openai.bothub.ru/v1', apiKey || process.env.BOTHUB_API_KEY)
    }
}

export class ChutesProvider extends OpenAIProvider {
    public override id = 'chutes'

    constructor(apiKey?: string) {
        super('https://llm.chutes.ai/v1', apiKey || process.env.CHUTES_API_KEY)
    }
}

export class ClarifaiProvider extends OpenAIProvider {
    public override id = 'clarifai'

    constructor(apiKey?: string) {
        super('https://api.clarifai.com/v2/ext/openai/v1', apiKey || process.env.CLARIFAI_PAT)
    }
}

export class ClaudinioProvider extends OpenAIProvider {
    public override id = 'claudinio'

    constructor(apiKey?: string) {
        super('https://api.claudin.io/v1', apiKey || process.env.CLAUDINIO_API_KEY)
    }
}

export class ClinePassProvider extends OpenAIProvider {
    public override id = 'cline-pass'

    constructor(apiKey?: string) {
        super('https://api.cline.bot/api/v1', apiKey || process.env.CLINE_API_KEY)
    }
}

export class CloudferroSherlockProvider extends OpenAIProvider {
    public override id = 'cloudferro-sherlock'

    constructor(apiKey?: string) {
        super(
            'https://api-sherlock.cloudferro.com/openai/v1/',
            apiKey || process.env.CLOUDFERRO_SHERLOCK_API_KEY
        )
    }
}

export class CloudflareAiGatewayProvider extends OpenAIProvider {
    public override id = 'cloudflare-ai-gateway'

    constructor(apiKey?: string) {
        super('https://gateway.ai.cloudflare.com/v1', apiKey || process.env.CLOUDFLARE_API_TOKEN)
    }
}

export class CoralbricksProvider extends OpenAIProvider {
    public override id = 'coralbricks'

    constructor(apiKey?: string) {
        super('https://inference.coralbricks.ai/v1', apiKey || process.env.CORAL_API_KEY)
    }
}

export class CortecsProvider extends OpenAIProvider {
    public override id = 'cortecs'

    constructor(apiKey?: string) {
        super('https://api.cortecs.ai/v1', apiKey || process.env.CORTECS_API_KEY)
    }
}

export class CrofProvider extends OpenAIProvider {
    public override id = 'crof'

    constructor(apiKey?: string) {
        super('https://crof.ai/v1', apiKey || process.env.CROF_API_KEY)
    }
}

export class CrossmodelProvider extends OpenAIProvider {
    public override id = 'crossmodel'

    constructor(apiKey?: string) {
        super('https://api.crossmodel.ai/v1', apiKey || process.env.CROSSMODEL_API_KEY)
    }
}

export class CrusoeProvider extends OpenAIProvider {
    public override id = 'crusoe'

    constructor(apiKey?: string) {
        super('https://api.inference.crusoecloud.com/v1', apiKey || process.env.CRUSOE_API_KEY)
    }
}

export class DaoxeProvider extends OpenAIProvider {
    public override id = 'daoxe'

    constructor(apiKey?: string) {
        super('https://daoxe.com/v1', apiKey || process.env.DAOXE_API_KEY)
    }
}

export class DeepinfraProvider extends OpenAIProvider {
    public override id = 'deepinfra'

    constructor(apiKey?: string) {
        super('https://api.deepinfra.com/v1/openai', apiKey || process.env.DEEPINFRA_API_KEY)
    }
}

export class DigitaloceanProvider extends OpenAIProvider {
    public override id = 'digitalocean'

    constructor(apiKey?: string) {
        super('https://inference.do-ai.run/v1', apiKey || process.env.DIGITALOCEAN_ACCESS_TOKEN)
    }
}

export class DinferenceProvider extends OpenAIProvider {
    public override id = 'dinference'

    constructor(apiKey?: string) {
        super('https://api.dinference.com/v1', apiKey || process.env.DINFERENCE_API_KEY)
    }
}

export class DrunProvider extends OpenAIProvider {
    public override id = 'drun'

    constructor(apiKey?: string) {
        super('https://chat.d.run/v1', apiKey || process.env.DRUN_API_KEY)
    }
}

export class EbcloudProvider extends OpenAIProvider {
    public override id = 'ebcloud'

    constructor(apiKey?: string) {
        super('https://maas-api.ebcloud.com/v1', apiKey || process.env.EBCLOUD_API_KEY)
    }
}

export class EchoProvider extends OpenAIProvider {
    public override id = 'echo'

    constructor(apiKey?: string) {
        super('https://echo.tracerml.ai/v1', apiKey || process.env.ECHO_API_KEY)
    }
}

export class EdenaiProvider extends OpenAIProvider {
    public override id = 'edenai'

    constructor(apiKey?: string) {
        super('https://api.edenai.run/v3', apiKey || process.env.EDENAI_API_KEY)
    }
}

export class EmpiriolabsProvider extends OpenAIProvider {
    public override id = 'empiriolabs'

    constructor(apiKey?: string) {
        super('https://api.empiriolabs.ai/v1', apiKey || process.env.EMPIRIOLABS_API_KEY)
    }
}

export class EvrocProvider extends OpenAIProvider {
    public override id = 'evroc'

    constructor(apiKey?: string) {
        super('https://models.think.evroc.com/v1', apiKey || process.env.EVROC_API_KEY)
    }
}

export class FastrouterProvider extends OpenAIProvider {
    public override id = 'fastrouter'

    constructor(apiKey?: string) {
        super('https://go.fastrouter.ai/api/v1', apiKey || process.env.FASTROUTER_API_KEY)
    }
}

export class FreemodelProvider extends AnthropicProvider {
    public override id = 'freemodel'

    constructor(apiKey?: string) {
        super('https://cc.freemodel.dev/v1', apiKey || process.env.FREEMODEL_API_KEY)
    }
}

export class FriendliProvider extends OpenAIProvider {
    public override id = 'friendli'

    constructor(apiKey?: string) {
        super('https://api.friendli.ai/serverless/v1', apiKey || process.env.FRIENDLI_TOKEN)
    }
}

export class FrogbotProvider extends OpenAIProvider {
    public override id = 'frogbot'

    constructor(apiKey?: string) {
        super('https://app.frogbot.ai/api/v1', apiKey || process.env.FROGBOT_API_KEY)
    }
}

export class GmicloudProvider extends OpenAIProvider {
    public override id = 'gmicloud'

    constructor(apiKey?: string) {
        super('https://api.gmi-serving.com/v1', apiKey || process.env.GMICLOUD_API_KEY)
    }
}

export class GreenptProvider extends OpenAIProvider {
    public override id = 'greenpt'

    constructor(apiKey?: string) {
        super('https://api.greenpt.ai/v1', apiKey || process.env.GREENPT_API_KEY)
    }
}

export class HeliconeProvider extends OpenAIProvider {
    public override id = 'helicone'

    constructor(apiKey?: string) {
        super('https://ai-gateway.helicone.ai/v1', apiKey || process.env.HELICONE_API_KEY)
    }
}

export class HetznerProvider extends OpenAIProvider {
    public override id = 'hetzner'

    constructor(apiKey?: string) {
        super('https://inference.hetzner.com/api/v1', apiKey || process.env.HETZNER_API_KEY)
    }
}

export class HpcAiProvider extends OpenAIProvider {
    public override id = 'hpc-ai'

    constructor(apiKey?: string) {
        super('https://api.hpc-ai.com/inference/v1', apiKey || process.env.HPC_AI_API_KEY)
    }
}

export class HyperProvider extends OpenAIProvider {
    public override id = 'hyper'

    constructor(apiKey?: string) {
        super('https://hyper.charm.land/v1', apiKey || process.env.HYPER_API_KEY)
    }
}

export class IflowcnProvider extends OpenAIProvider {
    public override id = 'iflowcn'

    constructor(apiKey?: string) {
        super('https://apis.iflow.cn/v1', apiKey || process.env.IFLOW_API_KEY)
    }
}

export class ImpossiblProvider extends OpenAIProvider {
    public override id = 'impossibl'

    constructor(apiKey?: string) {
        super('https://api.impossibl.com/v1', apiKey || process.env.IMPOSSIBL_API_KEY)
    }
}

export class InceptionProvider extends OpenAIProvider {
    public override id = 'inception'

    constructor(apiKey?: string) {
        super('https://api.inceptionlabs.ai/v1/', apiKey || process.env.INCEPTION_API_KEY)
    }
}

export class InceptronProvider extends OpenAIProvider {
    public override id = 'inceptron'

    constructor(apiKey?: string) {
        super('https://api.inceptron.io/v1', apiKey || process.env.INCEPTRON_API_KEY)
    }
}

export class IncoProvider extends OpenAIProvider {
    public override id = 'inco'

    constructor(apiKey?: string) {
        super('https://api.inco.ai/v1', apiKey || process.env.INCO_API_KEY)
    }
}

export class InferProvider extends OpenAIProvider {
    public override id = 'infer'

    constructor(apiKey?: string) {
        super('https://infer.flow7.org/v1', apiKey || process.env.INFER_API_KEY)
    }
}

export class InferenceProvider extends OpenAIProvider {
    public override id = 'inference'

    constructor(apiKey?: string) {
        super('https://inference.net/v1', apiKey || process.env.INFERENCE_API_KEY)
    }
}

export class InferxProvider extends OpenAIProvider {
    public override id = 'inferx'

    constructor(apiKey?: string) {
        super('https://model.inferx.net/endpoints/v1', apiKey || process.env.INFERX_API_KEY)
    }
}

export class IoNetProvider extends OpenAIProvider {
    public override id = 'io-net'

    constructor(apiKey?: string) {
        super(
            'https://api.intelligence.io.solutions/api/v1',
            apiKey || process.env.IOINTELLIGENCE_API_KEY
        )
    }
}

export class IteracomputeProvider extends OpenAIProvider {
    public override id = 'iteracompute'

    constructor(apiKey?: string) {
        super('https://api.iteracompute.com/v1', apiKey || process.env.ITERACOMPUTE_API_KEY)
    }
}

export class JalapenoProvider extends OpenAIProvider {
    public override id = 'jalapeno'

    constructor(apiKey?: string) {
        super('https://api.jalapeno-cloud.ai/v1', apiKey || process.env.JALAPENO_API_KEY)
    }
}

export class JiekouProvider extends OpenAIProvider {
    public override id = 'jiekou'

    constructor(apiKey?: string) {
        super('https://api.jiekou.ai/openai', apiKey || process.env.JIEKOU_API_KEY)
    }
}

export class KenariProvider extends OpenAIProvider {
    public override id = 'kenari'

    constructor(apiKey?: string) {
        super('https://kenari.id/v1', apiKey || process.env.KENARI_API_KEY)
    }
}

export class KiloProvider extends OpenAIProvider {
    public override id = 'kilo'

    constructor(apiKey?: string) {
        super('https://api.kilo.ai/api/gateway', apiKey || process.env.KILO_API_KEY)
    }
}

export class KimiCodePlanCnProvider extends OpenAIProvider {
    public override id = 'kimi-code-plan-cn'

    constructor(apiKey?: string) {
        super('https://api.kimi.com/coding/v1', apiKey || process.env.KIMI_API_KEY)
    }
}

export class KimiCodePlanGlobalProvider extends OpenAIProvider {
    public override id = 'kimi-code-plan-global'

    constructor(apiKey?: string) {
        super('https://api.kimi.ai/coding/v1', apiKey || process.env.KIMI_API_KEY)
    }
}

export class KlokintegrationProvider extends OpenAIProvider {
    public override id = 'klokintegration'

    constructor(apiKey?: string) {
        super(
            'https://api-gw.klok.ipaas.se/proxy/kloker-key/v1',
            apiKey || process.env.KLOKINTEGRATION_API_KEY
        )
    }
}

export class KosmikProvider extends OpenAIProvider {
    public override id = 'kosmik'

    constructor(apiKey?: string) {
        super('https://api.koscompute.com/v1', apiKey || process.env.KOSMIK_API_KEY)
    }
}

export class LilacProvider extends OpenAIProvider {
    public override id = 'lilac'

    constructor(apiKey?: string) {
        super('https://api.getlilac.com/v1', apiKey || process.env.LILAC_API_KEY)
    }
}

export class LlamaProvider extends OpenAIProvider {
    public override id = 'llama'

    constructor(apiKey?: string) {
        super('https://api.llama.com/compat/v1/', apiKey || process.env.LLAMA_API_KEY)
    }
}

export class LlmgatewayProvider extends OpenAIProvider {
    public override id = 'llmgateway'

    constructor(apiKey?: string) {
        super('https://api.llmgateway.io/v1', apiKey || process.env.LLMGATEWAY_API_KEY)
    }
}

export class LlmgatewayProvidersProvider extends OpenAIProvider {
    public override id = 'llmgateway-providers'

    constructor(apiKey?: string) {
        super('https://api.llmgateway.io/v1', apiKey || process.env.LLMGATEWAY_API_KEY)
    }
}

export class LlmtechProvider extends OpenAIProvider {
    public override id = 'llmtech'

    constructor(apiKey?: string) {
        super('https://api.llmtech.eu/v1', apiKey || process.env.LLMTECH_API_KEY)
    }
}

export class LlmtrProvider extends OpenAIProvider {
    public override id = 'llmtr'

    constructor(apiKey?: string) {
        super('https://llmtr.com/v1', apiKey || process.env.LLMTR_API_KEY)
    }
}

export class LongcatProvider extends OpenAIProvider {
    public override id = 'longcat'

    constructor(apiKey?: string) {
        super('https://api.longcat.chat/openai', apiKey || process.env.LONGCAT_API_KEY)
    }
}

export class LucidqueryProvider extends OpenAIProvider {
    public override id = 'lucidquery'

    constructor(apiKey?: string) {
        super('https://api.lucidquery.com/v1', apiKey || process.env.LUCIDQUERY_API_KEY)
    }
}

export class MeganovaProvider extends OpenAIProvider {
    public override id = 'meganova'

    constructor(apiKey?: string) {
        super('https://api.meganova.ai/v1', apiKey || process.env.MEGANOVA_API_KEY)
    }
}

export class MeliousProvider extends OpenAIProvider {
    public override id = 'melious'

    constructor(apiKey?: string) {
        super('https://api.melious.ai/v1', apiKey || process.env.MELIOUS_API_KEY)
    }
}

export class MergeGatewayProvider extends OpenAIProvider {
    public override id = 'merge-gateway'

    constructor(apiKey?: string) {
        super(
            'https://api-gateway.merge.dev/v1/ai-sdk',
            apiKey || process.env.MERGE_GATEWAY_API_KEY
        )
    }
}

export class MixlayerProvider extends OpenAIProvider {
    public override id = 'mixlayer'

    constructor(apiKey?: string) {
        super('https://models.mixlayer.ai/v1', apiKey || process.env.MIXLAYER_API_KEY)
    }
}

export class MoarkProvider extends OpenAIProvider {
    public override id = 'moark'

    constructor(apiKey?: string) {
        super('https://moark.com/v1', apiKey || process.env.MOARK_API_KEY)
    }
}

export class ModalProvider extends OpenAIProvider {
    public override id = 'modal'

    constructor(apiKey?: string) {
        super('https://inference.us-west.modal.direct/v1', apiKey || process.env.MODAL_PROXY_TOKEN)
    }
}

export class ModelOracleAiProvider extends OpenAIProvider {
    public override id = 'model-oracle-ai'

    constructor(apiKey?: string) {
        super('https://api.modeloracle.com/api/v1', apiKey || process.env.MODEL_ORACLE_API_KEY)
    }
}

export class ModelisProvider extends OpenAIProvider {
    public override id = 'modelis'

    constructor(apiKey?: string) {
        super('https://modelishub.com/v1', apiKey || process.env.MODELIS_API_KEY)
    }
}

export class ModelscopeProvider extends OpenAIProvider {
    public override id = 'modelscope'

    constructor(apiKey?: string) {
        super('https://api-inference.modelscope.cn/v1', apiKey || process.env.MODELSCOPE_API_KEY)
    }
}

export class MorphProvider extends OpenAIProvider {
    public override id = 'morph'

    constructor(apiKey?: string) {
        super('https://api.morphllm.com/v1', apiKey || process.env.MORPH_API_KEY)
    }
}

export class NanProvider extends OpenAIProvider {
    public override id = 'nan'

    constructor(apiKey?: string) {
        super('https://api.nan.builders/v1', apiKey || process.env.NAN_API_KEY)
    }
}

export class NanoGptProvider extends OpenAIProvider {
    public override id = 'nano-gpt'

    constructor(apiKey?: string) {
        super('https://nano-gpt.com/api/v1', apiKey || process.env.NANO_GPT_API_KEY)
    }
}

export class NearaiProvider extends OpenAIProvider {
    public override id = 'nearai'

    constructor(apiKey?: string) {
        super('https://cloud-api.near.ai/v1', apiKey || process.env.NEARAI_API_KEY)
    }
}

export class NebiusProvider extends OpenAIProvider {
    public override id = 'nebius'

    constructor(apiKey?: string) {
        super('https://api.tokenfactory.nebius.com/v1', apiKey || process.env.NEBIUS_API_KEY)
    }
}

export class NeosmithProvider extends OpenAIProvider {
    public override id = 'neosmith'

    constructor(apiKey?: string) {
        super('https://router.neosmith.ai/v1', apiKey || process.env.NEOSMITH_API_KEY)
    }
}

export class NeuralwattProvider extends OpenAIProvider {
    public override id = 'neuralwatt'

    constructor(apiKey?: string) {
        super('https://api.neuralwatt.com/v1', apiKey || process.env.NEURALWATT_API_KEY)
    }
}

export class NovaProvider extends OpenAIProvider {
    public override id = 'nova'

    constructor(apiKey?: string) {
        super('https://api.nova.amazon.com/v1', apiKey || process.env.NOVA_API_KEY)
    }
}

export class NovitaAiProvider extends OpenAIProvider {
    public override id = 'novita-ai'

    constructor(apiKey?: string) {
        super('https://api.novita.ai/openai', apiKey || process.env.NOVITA_API_KEY)
    }
}

export class OfoxProvider extends OpenAIProvider {
    public override id = 'ofox'

    constructor(apiKey?: string) {
        super('https://api.ofox.ai/v1', apiKey || process.env.OFOX_API_KEY)
    }
}

export class OllamaCloudProvider extends OpenAIProvider {
    public override id = 'ollama-cloud'

    constructor(apiKey?: string) {
        super('https://ollama.com/v1', apiKey || process.env.OLLAMA_API_KEY)
    }
}

export class OpencodeProvider extends OpenAIProvider {
    public override id = 'opencode'

    constructor(apiKey?: string) {
        super('https://opencode.ai/zen/v1', apiKey || process.env.OPENCODE_API_KEY)
    }
}

export class OpencodeGoProvider extends OpenAIProvider {
    public override id = 'opencode-go'

    constructor(apiKey?: string) {
        super('https://opencode.ai/zen/go/v1', apiKey || process.env.OPENCODE_API_KEY)
    }
}

export class OpenreasonProvider extends OpenAIProvider {
    public override id = 'openreason'

    constructor(apiKey?: string) {
        super('https://api.openreason.app/v1', apiKey || process.env.OPENREASON_API_KEY)
    }
}

export class OpperProvider extends OpenAIProvider {
    public override id = 'opper'

    constructor(apiKey?: string) {
        super('https://api.opper.ai/v3/compat', apiKey || process.env.OPPER_API_KEY)
    }
}

export class OrcarouterProvider extends OpenAIProvider {
    public override id = 'orcarouter'

    constructor(apiKey?: string) {
        super('https://api.orcarouter.ai/v1', apiKey || process.env.ORCAROUTER_API_KEY)
    }
}

export class OvhcloudProvider extends OpenAIProvider {
    public override id = 'ovhcloud'

    constructor(apiKey?: string) {
        super(
            'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1',
            apiKey || process.env.OVHCLOUD_API_KEY
        )
    }
}

export class PendraProvider extends OpenAIProvider {
    public override id = 'pendra'

    constructor(apiKey?: string) {
        super('https://api.pendra.ai/api/v1', apiKey || process.env.PENDRA_API_KEY)
    }
}

export class PerplexityAgentProvider extends OpenAIProvider {
    public override id = 'perplexity-agent'

    constructor(apiKey?: string) {
        super('https://api.perplexity.ai/v1', apiKey || process.env.PERPLEXITY_API_KEY)
    }
}

export class PioneerProvider extends OpenAIProvider {
    public override id = 'pioneer'

    constructor(apiKey?: string) {
        super('https://api.pioneer.ai/v1', apiKey || process.env.PIONEER_API_KEY)
    }
}

export class PoeProvider extends OpenAIProvider {
    public override id = 'poe'

    constructor(apiKey?: string) {
        super('https://api.poe.com/v1', apiKey || process.env.POE_API_KEY)
    }
}

export class QihangAiProvider extends OpenAIProvider {
    public override id = 'qihang-ai'

    constructor(apiKey?: string) {
        super('https://api.qhaigc.net/v1', apiKey || process.env.QIHANG_API_KEY)
    }
}

export class QiniuAiProvider extends OpenAIProvider {
    public override id = 'qiniu-ai'

    constructor(apiKey?: string) {
        super('https://api.qnaigc.com/v1', apiKey || process.env.QINIU_API_KEY)
    }
}

export class QvacProvider extends OpenAIProvider {
    public override id = 'qvac'

    constructor(apiKey?: string) {
        super('https://api.qvac.ai/v1', apiKey || process.env.QVAC_API_KEY)
    }
}

export class RegoloAiProvider extends OpenAIProvider {
    public override id = 'regolo-ai'

    constructor(apiKey?: string) {
        super('https://api.regolo.ai/v1', apiKey || process.env.REGOLO_API_KEY)
    }
}

export class RequestyProvider extends OpenAIProvider {
    public override id = 'requesty'

    constructor(apiKey?: string) {
        super('https://router.requesty.ai/v1', apiKey || process.env.REQUESTY_API_KEY)
    }
}

export class RoutingRunProvider extends OpenAIProvider {
    public override id = 'routing-run'

    constructor(apiKey?: string) {
        super('https://api.routing.run/v1', apiKey || process.env.ROUTING_RUN_API_KEY)
    }
}

export class RuninfraProvider extends OpenAIProvider {
    public override id = 'runinfra'

    constructor(apiKey?: string) {
        super('https://api.runinfra.ai/v1', apiKey || process.env.RUNINFRA_GATEWAY_KEY)
    }
}

export class SaladCloudProvider extends OpenAIProvider {
    public override id = 'salad-cloud'

    constructor(apiKey?: string) {
        super('https://matrix.salad.com/api/v1', apiKey || process.env.SALAD_CLOUD_API_KEY)
    }
}

export class ScalewayProvider extends OpenAIProvider {
    public override id = 'scaleway'

    constructor(apiKey?: string) {
        super('https://api.scaleway.ai/v1', apiKey || process.env.SCALEWAY_API_KEY)
    }
}

export class ScxAiProvider extends OpenAIProvider {
    public override id = 'scx-ai'

    constructor(apiKey?: string) {
        super('https://api.scx.ai/v1', apiKey || process.env.SCX_API_KEY)
    }
}

export class SensenovaProvider extends OpenAIProvider {
    public override id = 'sensenova'

    constructor(apiKey?: string) {
        super('https://token.sensenova.cn/v1', apiKey || process.env.SENSENOVA_API_KEY)
    }
}

export class StackitProvider extends OpenAIProvider {
    public override id = 'stackit'

    constructor(apiKey?: string) {
        super(
            'https://api.openai-compat.model-serving.eu01.onstackit.cloud/v1',
            apiKey || process.env.STACKIT_API_KEY
        )
    }
}

export class StandardcomputeProvider extends OpenAIProvider {
    public override id = 'standardcompute'

    constructor(apiKey?: string) {
        super('https://api.stdcmpt.com/v1', apiKey || process.env.STANDARDCOMPUTE_API_KEY)
    }
}

export class SubconsciousProvider extends AnthropicProvider {
    public override id = 'subconscious'

    constructor(apiKey?: string) {
        super('https://api.subconscious.dev/v1', apiKey || process.env.SUBCONSCIOUS_API_KEY)
    }
}

export class SubmodelProvider extends OpenAIProvider {
    public override id = 'submodel'

    constructor(apiKey?: string) {
        super('https://llm.submodel.ai/v1', apiKey || process.env.SUBMODEL_INSTAGEN_ACCESS_KEY)
    }
}

export class SyntheticProvider extends OpenAIProvider {
    public override id = 'synthetic'

    constructor(apiKey?: string) {
        super('https://api.synthetic.new/openai/v1', apiKey || process.env.SYNTHETIC_API_KEY)
    }
}

export class TemprProvider extends OpenAIProvider {
    public override id = 'tempr'

    constructor(apiKey?: string) {
        super('https://api.temprhq.io/v1', apiKey || process.env.TEMPR_API_KEY)
    }
}

export class TencentTokenhubProvider extends OpenAIProvider {
    public override id = 'tencent-tokenhub'

    constructor(apiKey?: string) {
        super('https://tokenhub.tencentmaas.com/v1', apiKey || process.env.TENCENT_TOKENHUB_API_KEY)
    }
}

export class TensorxProvider extends OpenAIProvider {
    public override id = 'tensorx'

    constructor(apiKey?: string) {
        super('https://api.tensorx.ai/v1', apiKey || process.env.TENSORX_API_KEY)
    }
}

export class TheGridAiProvider extends OpenAIProvider {
    public override id = 'the-grid-ai'

    constructor(apiKey?: string) {
        super('https://api.thegrid.ai/v1', apiKey || process.env.THEGRID_API_KEY)
    }
}

export class TinfoilProvider extends OpenAIProvider {
    public override id = 'tinfoil'

    constructor(apiKey?: string) {
        super('https://inference.tinfoil.sh/v1', apiKey || process.env.TINFOIL_API_KEY)
    }
}

export class TokengoProvider extends OpenAIProvider {
    public override id = 'tokengo'

    constructor(apiKey?: string) {
        super('https://api.tokengo.com/v1', apiKey || process.env.TOKENGO_API_KEY)
    }
}

export class TokenrouterProvider extends OpenAIProvider {
    public override id = 'tokenrouter'

    constructor(apiKey?: string) {
        super('https://api.tokenrouter.com/v1', apiKey || process.env.TOKENROUTER_API_KEY)
    }
}

export class TrustedrouterProvider extends OpenAIProvider {
    public override id = 'trustedrouter'

    constructor(apiKey?: string) {
        super('https://api.trustedrouter.com/v1', apiKey || process.env.TRUSTEDROUTER_API_KEY)
    }
}

export class UmansAiProvider extends OpenAIProvider {
    public override id = 'umans-ai'

    constructor(apiKey?: string) {
        super('https://api.code.umans.ai/v1', apiKey || process.env.UMANS_AI_API_KEY)
    }
}

export class UnorouterProvider extends OpenAIProvider {
    public override id = 'unorouter'

    constructor(apiKey?: string) {
        super('https://api.unorouter.com/v1', apiKey || process.env.UNOROUTER_API_KEY)
    }
}

export class V0Provider extends OpenAIProvider {
    public override id = 'v0'

    constructor(apiKey?: string) {
        super('https://api.v0.dev/v1', apiKey || process.env.V0_API_KEY)
    }
}

export class VancineProvider extends OpenAIProvider {
    public override id = 'vancine'

    constructor(apiKey?: string) {
        super('https://vancine.com/v1', apiKey || process.env.VANCINE_API_KEY)
    }
}

export class VeniceProvider extends OpenAIProvider {
    public override id = 'venice'

    constructor(apiKey?: string) {
        super('https://api.venice.ai/api/v1', apiKey || process.env.VENICE_API_KEY)
    }
}

export class VercelProvider extends OpenAIProvider {
    public override id = 'vercel'

    constructor(apiKey?: string) {
        super('https://ai.gateway.vercel.dev/v1', apiKey || process.env.AI_GATEWAY_API_KEY)
    }
}

export class VisparkProvider extends OpenAIProvider {
    public override id = 'vispark'

    constructor(apiKey?: string) {
        super('https://api.lab.vispark.in/v1', apiKey || process.env.VISPARK_LAB_API_KEY)
    }
}

export class VivgridProvider extends OpenAIProvider {
    public override id = 'vivgrid'

    constructor(apiKey?: string) {
        super('https://api.vivgrid.com/v1', apiKey || process.env.VIVGRID_API_KEY)
    }
}

export class VolcengineProvider extends OpenAIProvider {
    public override id = 'volcengine'

    constructor(apiKey?: string) {
        super('https://ark.cn-beijing.volces.com/api/v3', apiKey || process.env.ARK_API_KEY)
    }
}

export class VultrProvider extends OpenAIProvider {
    public override id = 'vultr'

    constructor(apiKey?: string) {
        super('https://api.vultrinference.com/v1', apiKey || process.env.VULTR_API_KEY)
    }
}

export class WaferAiProvider extends OpenAIProvider {
    public override id = 'wafer.ai'

    constructor(apiKey?: string) {
        super('https://pass.wafer.ai/v1', apiKey || process.env.WAFER_API_KEY)
    }
}

export class WallabyProvider extends OpenAIProvider {
    public override id = 'wallaby'

    constructor(apiKey?: string) {
        super('https://api.wallabytoken.com/v1', apiKey || process.env.WALLABY_API_KEY)
    }
}

export class WandbProvider extends OpenAIProvider {
    public override id = 'wandb'

    constructor(apiKey?: string) {
        super('https://api.inference.wandb.ai/v1', apiKey || process.env.WANDB_API_KEY)
    }
}

export class WatsonxProvider extends OpenAIProvider {
    public override id = 'watsonx'

    constructor(apiKey?: string) {
        super('https://us-south.ml.cloud.ibm.com/v1', apiKey || process.env.WATSONX_AI_APIKEY)
    }
}

export class XpersonaProvider extends OpenAIProvider {
    public override id = 'xpersona'

    constructor(apiKey?: string) {
        super('https://www.xpersona.co/v1', apiKey || process.env.XPERSONA_API_KEY)
    }
}

export class ZeldocProvider extends OpenAIProvider {
    public override id = 'zeldoc'

    constructor(apiKey?: string) {
        super('https://api.zeldoc.ai/v1', apiKey || process.env.ZELDOC_API_KEY)
    }
}

export class ZenifraProvider extends OpenAIProvider {
    public override id = 'zenifra'

    constructor(apiKey?: string) {
        super('https://ai.zenifra.com/v1', apiKey || process.env.ZENIFRA_AI_KEY)
    }
}

export class ZenmuxProvider extends OpenAIProvider {
    public override id = 'zenmux'

    constructor(apiKey?: string) {
        super('https://zenmux.ai/api/v1', apiKey || process.env.ZENMUX_API_KEY)
    }
}
