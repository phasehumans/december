import { Box, useApp } from 'ink'
import { useState, useCallback } from 'react'

import { Header } from '../components/header'
import { InputBar } from '../components/input-bar'
import { BotMessage, ErrorMessage, UserMessage } from '../components/messages'

import type { MessageBlock } from '../components/messages/bot-message'

type Message = {
    id: number
    role: 'user' | 'assistant' | 'error'
    text?: string
    blocks?: MessageBlock[]
}

let msgId = 0

export function Chat() {
    const [messages, setMessages] = useState<Message[]>([])
    const [isStreaming, setIsStreaming] = useState(false)
    const { exit } = useApp()

    const handleSubmit = useCallback(
        (text: string) => {
            if (text.trim() === '/exit') {
                exit()
                return
            }

            // Disable typing during streaming
            setIsStreaming(true)

            setMessages((prev) => [...prev, { id: ++msgId, role: 'user', text }])

            const assistantMsgId = ++msgId
            setMessages((prev) => [
                ...prev,
                {
                    id: assistantMsgId,
                    role: 'assistant',
                    blocks: [
                        {
                            type: 'text',
                            content: 'Initializing workspace context...',
                        },
                        {
                            type: 'command',
                            command: 'bun install --dry-run',
                            status: 'running',
                        },
                    ],
                },
            ])

            // Step 1: Complete bun install, start codebase search (1200ms)
            setTimeout(() => {
                setMessages((prev) =>
                    prev.map((msg) => {
                        if (msg.id !== assistantMsgId) return msg
                        return {
                            ...msg,
                            blocks: [
                                {
                                    type: 'text',
                                    content: 'Initializing workspace context...',
                                },
                                {
                                    type: 'command',
                                    command: 'bun install --dry-run',
                                    status: 'success',
                                    output: 'Done in 0.4s. All workspaces are up to date.',
                                },
                                {
                                    type: 'status',
                                    label: 'Workspace checked. Searching codebase for files...',
                                    success: true,
                                },
                                {
                                    type: 'command',
                                    command: `grep -rn "${text.slice(0, 10)}" packages/api/src/`,
                                    status: 'running',
                                },
                            ],
                        }
                    })
                )
            }, 1200)

            // Step 2: Complete codebase search, view auth file (2600ms)
            setTimeout(() => {
                setMessages((prev) =>
                    prev.map((msg) => {
                        if (msg.id !== assistantMsgId) return msg
                        return {
                            ...msg,
                            blocks: [
                                {
                                    type: 'text',
                                    content: 'Initializing workspace context...',
                                },
                                {
                                    type: 'command',
                                    command: 'bun install --dry-run',
                                    status: 'success',
                                    output: 'Done in 0.4s. All workspaces are up to date.',
                                },
                                {
                                    type: 'status',
                                    label: 'Workspace checked. Searching codebase for files...',
                                    success: true,
                                },
                                {
                                    type: 'command',
                                    command: `grep -rn "${text.slice(0, 10)}" packages/api/src/`,
                                    status: 'success',
                                    output: `packages/api/src/auth.ts:18:router.post("/login", ...)\npackages/api/src/routes.ts:4:import authRouter from "./auth"`,
                                },
                                {
                                    type: 'status',
                                    label: 'Located authentication controller in packages/api/src/auth.ts',
                                    success: true,
                                },
                                {
                                    type: 'text',
                                    content: `I will update packages/api/src/auth.ts to fully implement the request: "${text}". Let's check the current content:`,
                                },
                                {
                                    type: 'command',
                                    command: 'cat packages/api/src/auth.ts',
                                    status: 'running',
                                },
                            ],
                        }
                    })
                )
            }, 2600)

            // Step 3: Complete file view, apply modifications and diff (4000ms)
            setTimeout(() => {
                setMessages((prev) =>
                    prev.map((msg) => {
                        if (msg.id !== assistantMsgId) return msg
                        return {
                            ...msg,
                            blocks: [
                                {
                                    type: 'text',
                                    content: 'Initializing workspace context...',
                                },
                                {
                                    type: 'command',
                                    command: 'bun install --dry-run',
                                    status: 'success',
                                    output: 'Done in 0.4s. All workspaces are up to date.',
                                },
                                {
                                    type: 'status',
                                    label: 'Workspace checked. Searching codebase for files...',
                                    success: true,
                                },
                                {
                                    type: 'command',
                                    command: `grep -rn "${text.slice(0, 10)}" packages/api/src/`,
                                    status: 'success',
                                    output: `packages/api/src/auth.ts:18:router.post("/login", ...)\npackages/api/src/routes.ts:4:import authRouter from "./auth"`,
                                },
                                {
                                    type: 'status',
                                    label: 'Located authentication controller in packages/api/src/auth.ts',
                                    success: true,
                                },
                                {
                                    type: 'text',
                                    content: `I will update packages/api/src/auth.ts to fully implement the request: "${text}". Let's check the current content:`,
                                },
                                {
                                    type: 'command',
                                    command: 'cat packages/api/src/auth.ts',
                                    status: 'success',
                                    output: '// Auth controller file initialized\nconst router = express.Router();',
                                },
                                {
                                    type: 'file_change',
                                    filePath: 'packages/api/src/auth.ts',
                                    action: 'modified',
                                    diff: `@@ -15,5 +15,10 @@\n-router.post("/login", (req, res) => {\n-    res.send("login placeholder")\n-})\n+router.post("/login", async (req, res) => {\n+    const { email, password } = req.body;\n+    const user = await db.user.findUnique({ where: { email } });\n+    if (!user) return res.status(401).json({ error: "Invalid credentials" });\n+    const matches = await bcrypt.compare(password, user.passwordHash);\n+    if (!matches) return res.status(401).json({ error: "Invalid credentials" });\n+    const token = jwt.sign({ userId: user.id }, JWT_SECRET);\n+    return res.json({ token });\n+})`,
                                },
                            ],
                        }
                    })
                )
            }, 4000)

            // Step 4: Create middleware helper file and display code block (5800ms)
            setTimeout(() => {
                setMessages((prev) =>
                    prev.map((msg) => {
                        if (msg.id !== assistantMsgId) return msg
                        return {
                            ...msg,
                            blocks: [
                                ...(msg.blocks ?? []),
                                {
                                    type: 'text',
                                    content:
                                        'Next, I will create a authentication verification middleware in a separate file:',
                                },
                                {
                                    type: 'file_change',
                                    filePath: 'packages/api/src/middleware/auth.ts',
                                    action: 'created',
                                },
                                {
                                    type: 'code',
                                    language: 'typescript',
                                    filename: 'packages/api/src/middleware/auth.ts',
                                    code: `import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required" });
    }
    const token = authHeader.split(" ")[1];
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = payload;
        next();
    } catch {
        return res.status(401).json({ error: "Invalid token" });
    }
}`,
                                },
                            ],
                        }
                    })
                )
            }, 5800)

            // Step 5: Start test suite (7800ms)
            setTimeout(() => {
                setMessages((prev) =>
                    prev.map((msg) => {
                        if (msg.id !== assistantMsgId) return msg
                        return {
                            ...msg,
                            blocks: [
                                ...(msg.blocks ?? []),
                                {
                                    type: 'status',
                                    label: 'Auth middleware registered successfully.',
                                    success: true,
                                },
                                {
                                    type: 'command',
                                    command: 'bun test packages/api/src/auth.test.ts',
                                    status: 'running',
                                },
                            ],
                        }
                    })
                )
            }, 7800)

            // Step 6: Complete tests and finish streaming (9500ms)
            setTimeout(() => {
                setMessages((prev) =>
                    prev.map((msg) => {
                        if (msg.id !== assistantMsgId) return msg
                        const blocks = [...(msg.blocks ?? [])]
                        // Update the running test command to success
                        const testCmdIdx = blocks.findIndex(
                            (b) =>
                                b.type === 'command' &&
                                b.command === 'bun test packages/api/src/auth.test.ts'
                        )
                        if (testCmdIdx !== -1) {
                            blocks[testCmdIdx] = {
                                type: 'command',
                                command: 'bun test packages/api/src/auth.test.ts',
                                status: 'success',
                                output: 'bun test v1.3.14\n\n  auth.test.ts:\n    ✓ POST /login - should return JWT token on correct credentials (42ms)\n    ✓ POST /login - should return 401 on invalid password (15ms)\n    ✓ POST /login - should return 401 on non-existent user (8ms)\n\n  3 tests passed (1.2s)',
                            }
                        }
                        return {
                            ...msg,
                            blocks: [
                                ...blocks,
                                {
                                    type: 'status',
                                    label: 'Tests verified. Build clean.',
                                    success: true,
                                },
                                {
                                    type: 'text',
                                    content: `Done! The authentication endpoints and helper middlewares have been fully built, updated, and verified.`,
                                },
                            ],
                        }
                    })
                )
                setIsStreaming(false)
            }, 9500)
        },
        [exit]
    )

    return (
        <Box flexDirection="column" width="100%">
            {/* Header — always at top */}
            <Header />

            {/* Message thread */}
            {messages.map((msg) => {
                if (msg.role === 'user') {
                    return <UserMessage key={msg.id} message={msg.text ?? ''} />
                }
                if (msg.role === 'error') {
                    return <ErrorMessage key={msg.id} message={msg.text ?? ''} />
                }
                return <BotMessage key={msg.id} blocks={msg.blocks ?? []} />
            })}

            {/* Input bar (with inline dialog rendered beside it when open) */}
            <InputBar onSubmit={handleSubmit} disabled={isStreaming} />
        </Box>
    )
}
