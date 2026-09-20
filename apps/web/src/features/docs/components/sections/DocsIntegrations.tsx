import { Blocks, GitBranch, Database } from 'lucide-react'
import React from 'react'

import { CodeBlock, DocCallout, DocCard, DocPagination } from '../DocsUI'

import type { DocTab } from '../../types'

interface DocsSectionProps {
    onNavigate?: (tab: DocTab) => void
}

export const DocsIntegrations: React.FC<DocsSectionProps> = ({ onNavigate }) => {
    return (
        <div className="flex flex-col w-full max-w-[820px] text-[#D6D5C9]">
            {/* Header */}
            <div className="flex flex-col mb-8">
                <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Blocks className="w-3 h-3" />
                        Ecosystem &amp; Extensibility
                    </span>
                    <span className="text-[12px] text-[#71717A]">Open Protocol</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-[#EDEDEF] tracking-tight mb-2">
                    Integrations &amp; MCP Protocol
                </h1>
                <p className="text-[14.5px] sm:text-[15px] text-[#9A9998] leading-relaxed">
                    Connect your GitHub repositories, external cloud databases, deployment
                    pipelines, and custom Model Context Protocol (MCP) tool servers.
                </p>
            </div>

            <div className="flex flex-col gap-8 border-t border-[#242323] pt-6">
                {/* 1. Core Integrations */}
                <section className="flex flex-col gap-4">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Built-In Integrations
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <DocCard
                            icon={GitBranch}
                            title="GitHub"
                            description="Two-way synchronization: clone private repos, checkout branches, and publish pull requests with automated summaries."
                        />
                        <DocCard
                            icon={Database}
                            title="Supabase & Postgres"
                            description="Connect live database instances for schema introspection, SQL query planning, and Prisma/Drizzle migration generation."
                        />
                        <DocCard
                            icon={Blocks}
                            title="Vercel & Cloudflare"
                            description="Deploy live previews, trigger webhooks, and sync edge environment variables automatically."
                        />
                    </div>
                </section>

                {/* 2. Model Context Protocol (MCP) */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Model Context Protocol (MCP)
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        December natively implements the{' '}
                        <strong className="text-[#EDEDEF]">Model Context Protocol (MCP)</strong>, an
                        open specification that allows AI assistants to securely communicate with
                        external tools, databases, internal knowledge bases, and API servers.
                    </p>

                    <div className="p-4 rounded-xl border border-[#242323] bg-[#141414] space-y-3">
                        <h3 className="text-[14px] font-medium text-[#EDEDEF]">
                            Configuring MCP Servers in December
                        </h3>
                        <p className="text-[13px] text-[#9A9998] leading-relaxed">
                            Create a{' '}
                            <code className="text-[#EDEDEF] font-mono text-[12px]">
                                december.mcp.json
                            </code>{' '}
                            file in your repository root or define global servers in your settings
                            dashboard:
                        </p>

                        <CodeBlock
                            language="json"
                            filename="december.mcp.json"
                            code={`{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://user:pass@localhost:5432/mydb"]
    },
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-..."
      }
    }
  }
}`}
                        />
                    </div>
                </section>

                {/* 3. Secrets & Environment Variables */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-[16px] font-semibold text-[#EDEDEF] tracking-tight">
                        Secrets &amp; API Key Management
                    </h2>
                    <p className="text-[13.5px] text-[#9A9998] leading-relaxed">
                        Never commit plaintext secrets into Git or prompt text. December encrypts
                        sensitive environment keys with AES-256 and injects them securely into the
                        micro-VM sandbox at execution time:
                    </p>

                    <div className="space-y-2 text-[13px] text-[#9A9998]">
                        <p>
                            • Configure secrets via the{' '}
                            <span className="text-[#EDEDEF] font-medium">
                                Settings &gt; Secrets
                            </span>{' '}
                            dashboard.
                        </p>
                        <p>
                            • Reference stored keys in your prompts with{' '}
                            <code className="text-[#EDEDEF] font-mono text-[12px] bg-[#1E1E1E] px-1.5 py-0.5 rounded">
                                @secret:STRIPE_SECRET_KEY
                            </code>
                            .
                        </p>
                        <p>
                            • December automatically masks and redacts sensitive strings from
                            terminal transcripts and logs.
                        </p>
                    </div>

                    <DocCallout type="info" title="Custom Tool Permissions">
                        Whenever an MCP tool performs a write or mutating operation (such as
                        dropping a database table or sending a message), December asks for user
                        confirmation by default.
                    </DocCallout>
                </section>

                {/* Pagination */}
                {onNavigate && (
                    <DocPagination currentTab="Integrations & MCP" onNavigate={onNavigate} />
                )}
            </div>
        </div>
    )
}
