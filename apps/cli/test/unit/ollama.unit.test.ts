import { describe, expect, it } from 'bun:test'

import { getDefaultModelForProvider, isValidModelForProvider } from '../../src/utils/models'
import {
    detectOllamaBinary,
    fetchOllamaTags,
    getOllamaInstallSpec,
    probeOllama,
} from '../../src/utils/ollama'
import { instantiateProvider } from '../../src/utils/provider-factory'

describe('Ollama CLI utilities (Unit)', () => {
    it('detects ollama binary from PATH or fallback locations', () => {
        expect(
            detectOllamaBinary(
                'linux',
                () => '/usr/local/bin/ollama',
                () => false
            )
        ).toBe('/usr/local/bin/ollama')
        expect(
            detectOllamaBinary(
                'darwin',
                () => undefined,
                (p) => p === '/opt/homebrew/bin/ollama'
            )
        ).toBe('/opt/homebrew/bin/ollama')
        expect(
            detectOllamaBinary(
                'linux',
                () => undefined,
                () => false
            )
        ).toBeUndefined()
    })

    it('resolves OS-specific install commands when available', () => {
        expect(
            getOllamaInstallSpec('darwin', (cmd) =>
                cmd === 'brew' ? '/opt/homebrew/bin/brew' : undefined
            )?.command
        ).toBe('brew install ollama')
        expect(getOllamaInstallSpec('darwin', () => undefined)).toBeUndefined()
        expect(
            getOllamaInstallSpec('linux', (cmd) => (cmd === 'curl' ? '/usr/bin/curl' : undefined))
                ?.command
        ).toBe('curl -fsSL https://ollama.com/install.sh | sh')
        expect(
            getOllamaInstallSpec('win32', (cmd) => (cmd === 'winget' ? 'winget.exe' : undefined))
                ?.command
        ).toBe('winget install --id Ollama.Ollama -e')
    })

    it('fetches chat models from /api/tags and enriches context window via /api/show', async () => {
        const mockFetch: any = async (url: string) => {
            if (url.endsWith('/api/tags')) {
                return new Response(
                    JSON.stringify({
                        models: [{ name: 'qwen3:8b' }, { name: 'nomic-embed-text:latest' }],
                    }),
                    { status: 200 }
                )
            }
            if (url.endsWith('/api/show')) {
                return new Response(
                    JSON.stringify({
                        model_info: { 'qwen3.context_length': 40960 },
                    }),
                    { status: 200 }
                )
            }
            return new Response('not found', { status: 404 })
        }

        const res = await fetchOllamaTags('http://localhost:11434/v1', mockFetch)
        expect(res.reachable).toBe(true)
        expect(res.models).toEqual([{ label: 'qwen3:8b', value: 'qwen3:8b', contextWindow: 40960 }])
    })

    it('probes ready, no_models, installed_not_running, and not_installed states', async () => {
        const ready = await probeOllama(undefined, {
            fetchFn: (async (url: string) => {
                if (url.endsWith('/api/tags')) {
                    return new Response(JSON.stringify({ models: [{ name: 'qwen3:8b' }] }), {
                        status: 200,
                    })
                }
                return new Response(JSON.stringify({}), { status: 200 })
            }) as any,
        })
        expect(ready.status).toBe('ready')
        expect(ready.models[0]?.value).toBe('qwen3:8b')

        const noModels = await probeOllama(undefined, {
            fetchFn: (async () =>
                new Response(JSON.stringify({ models: [] }), { status: 200 })) as any,
        })
        expect(noModels.status).toBe('no_models')

        const failingFetch: any = async () => {
            throw new Error('ECONNREFUSED')
        }
        const installed = await probeOllama(undefined, {
            fetchFn: failingFetch,
            binaryPath: '/usr/local/bin/ollama',
        })
        expect(installed.status).toBe('installed_not_running')

        const notInstalled = await probeOllama(undefined, {
            fetchFn: failingFetch,
            binaryPath: null,
        })
        expect(notInstalled.status).toBe('not_installed')
    })

    it('instantiates ollamaProvider and validates local model names', () => {
        const llm = instantiateProvider('ollama', 'ollama', {
            baseURL: 'http://localhost:11434/v1',
        })
        expect(llm.id).toBe('ollama')
        expect(isValidModelForProvider('ollama', 'qwen3:8b')).toBe(true)
        expect(getDefaultModelForProvider('ollama')).toBeTruthy()
    })
})
