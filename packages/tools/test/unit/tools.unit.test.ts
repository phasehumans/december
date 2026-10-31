import { describe, expect, test } from 'bun:test'

import { AskQuestionTool } from '../../src/ask_question'
import { BashTool } from '../../src/bash'
import { CodeIntelligenceTool } from '../../src/code_intelligence'
import { EditFileTool, EditTool } from '../../src/edit'
import { EditDiffTool } from '../../src/edit_diff'
import { FindFilesTool } from '../../src/find'
import { GrepSearchTool } from '../../src/grep'
import { FOUNDATIONAL_TOOLS } from '../../src/index'
import { LsTool } from '../../src/ls'
import { ManageMemoryTool } from '../../src/manage_memory'
import { ManageTaskTool } from '../../src/manage_task'
import { ReadFileTool, ReadTool } from '../../src/read'
import { WebSearchTool } from '../../src/web_search'
import { WriteFileTool, WriteTool } from '../../src/write'

describe('Tools Schema & Registration (Unit)', () => {
    test('FOUNDATIONAL_TOOLS contains strictly the 4 primitives', () => {
        expect(FOUNDATIONAL_TOOLS).toBeDefined()
        expect(FOUNDATIONAL_TOOLS.length).toBe(4)
        const names = FOUNDATIONAL_TOOLS.map((t) => t.name)
        expect(names).toContain('read_file')
        expect(names).toContain('write_file')
        expect(names).toContain('edit_file')
        expect(names).toContain('bash')
    })

    test('ReadTool and ReadFileTool are configured with aliases', () => {
        expect(ReadFileTool.name).toBe('read_file')
        expect(ReadTool.name).toBe('read')
        expect(ReadTool.execute).toBe(ReadFileTool.execute)
    })

    test('WriteTool and WriteFileTool are configured with aliases', () => {
        expect(WriteFileTool.name).toBe('write_file')
        expect(WriteTool.name).toBe('write')
        expect(WriteTool.execute).toBe(WriteFileTool.execute)
    })

    test('EditTool and EditFileTool are configured with aliases', () => {
        expect(EditFileTool.name).toBe('edit_file')
        expect(EditTool.name).toBe('edit')
        expect(EditTool.execute).toBe(EditFileTool.execute)
    })

    test('AskQuestionTool has correct metadata', () => {
        expect(AskQuestionTool.name).toBe('ask_question')
        expect(AskQuestionTool.description).toBeDefined()
        expect(AskQuestionTool.inputSchema).toBeDefined()
    })

    test('ReadFileTool has correct metadata', () => {
        expect(ReadFileTool.name).toBe('read_file')
        expect(ReadFileTool.description).toBeDefined()
        expect(ReadFileTool.inputSchema).toBeDefined()
    })

    test('WriteFileTool has correct metadata', () => {
        expect(WriteFileTool.name).toBe('write_file')
        expect(WriteFileTool.description).toBeDefined()
    })

    test('EditFileTool and EditDiffTool have correct metadata', () => {
        expect(EditFileTool.name).toBe('edit_file')
        expect(EditDiffTool.name).toBe('edit_diff')
    })

    test('Search tools (find, grep, ls) have correct names', () => {
        expect(FindFilesTool.name).toBe('find_files')
        expect(GrepSearchTool.name).toBe('grep_search')
        expect(LsTool.name).toBe('list_dir')
    })

    test('Process tools (bash, manage_task) have correct names', () => {
        expect(BashTool.name).toBe('bash')
        expect(ManageTaskTool.name).toBe('manage_task')
    })

    test('Web tools (web_search) have correct names', () => {
        expect(WebSearchTool.name).toBe('web_search')
    })

    test('CodeIntelligenceTool has correct metadata', () => {
        expect(CodeIntelligenceTool.name).toBe('code_intelligence')
        expect(CodeIntelligenceTool.description).toBeDefined()
        expect(CodeIntelligenceTool.inputSchema).toBeDefined()
    })

    test('ManageMemoryTool has correct metadata', () => {
        expect(ManageMemoryTool.name).toBe('manage_memory')
        expect(ManageMemoryTool.description).toBeDefined()
        expect(ManageMemoryTool.inputSchema).toBeDefined()
    })
})
