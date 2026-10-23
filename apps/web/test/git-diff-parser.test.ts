import { describe, it, expect } from 'bun:test'

import { parseUnifiedGitDiff } from '../src/features/preview/utils/diffParser'

describe('Native Git Diff Parser (Ticket #586)', () => {
    it('returns empty array when raw diff is empty or whitespace', () => {
        expect(parseUnifiedGitDiff('')).toEqual([])
        expect(parseUnifiedGitDiff('   \n  ')).toEqual([])
    })

    it('parses a single modified file unified git diff accurately', () => {
        const rawDiff = `diff --git a/src/App.tsx b/src/App.tsx
index 1234567..89abcdef 100644
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -1,4 +1,5 @@
 import React from 'react'
-const oldTitle = 'old'
+const newTitle = 'new'
+console.log('updated')
 export default App`

        const result = parseUnifiedGitDiff(rawDiff)
        expect(result).toHaveLength(1)
        expect(result[0].filePath).toBe('src/App.tsx')
        expect(result[0].fileName).toBe('App.tsx')
        expect(result[0].directory).toBe('src')
        expect(result[0].action).toBe('modified')
        expect(result[0].additions).toBe(2)
        expect(result[0].deletions).toBe(1)
        expect(result[0].lines.length).toBeGreaterThan(0)

        const addedLines = result[0].lines.filter((l) => l.type === 'added')
        const deletedLines = result[0].lines.filter((l) => l.type === 'deleted')
        expect(addedLines).toHaveLength(2)
        expect(deletedLines).toHaveLength(1)
        expect(addedLines[0].content).toBe("const newTitle = 'new'")
    })

    it('parses newly created file with action created', () => {
        const rawDiff = `diff --git a/src/utils/math.ts b/src/utils/math.ts
new file mode 100644
index 0000000..abcdef1
--- /dev/null
+++ b/src/utils/math.ts
@@ -0,0 +1,3 @@
+export function add(a: number, b: number) {
+  return a + b
+}
`
        const result = parseUnifiedGitDiff(rawDiff)
        expect(result).toHaveLength(1)
        expect(result[0].filePath).toBe('src/utils/math.ts')
        expect(result[0].action).toBe('created')
        expect(result[0].additions).toBe(3)
        expect(result[0].deletions).toBe(0)
    })

    it('parses deleted file with action deleted', () => {
        const rawDiff = `diff --git a/src/legacy.ts b/src/legacy.ts
deleted file mode 100644
index abcdef1..0000000
--- a/src/legacy.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-export function deadCode() {
-  return null
-}
`
        const result = parseUnifiedGitDiff(rawDiff)
        expect(result).toHaveLength(1)
        expect(result[0].filePath).toBe('src/legacy.ts')
        expect(result[0].action).toBe('deleted')
        expect(result[0].additions).toBe(0)
        expect(result[0].deletions).toBe(3)
    })

    it('parses multi-file git diff accurately, including bash/terminal edits', () => {
        const rawDiff = `diff --git a/package.json b/package.json
index 111..222 100644
--- a/package.json
+++ b/package.json
@@ -5,2 +5,3 @@
   "version": "1.0.0",
+  "scripts": { "build": "vite build" },
   "dependencies": {}
diff --git a/scripts/setup.sh b/scripts/setup.sh
new file mode 100755
index 0000000..333
--- /dev/null
+++ b/scripts/setup.sh
@@ -0,0 +1,2 @@
+#!/bin/bash
+echo "setup ready"
`
        const result = parseUnifiedGitDiff(rawDiff)
        expect(result).toHaveLength(2)
        expect(result[0].filePath).toBe('package.json')
        expect(result[0].action).toBe('modified')
        expect(result[1].filePath).toBe('scripts/setup.sh')
        expect(result[1].action).toBe('created')
    })
})
