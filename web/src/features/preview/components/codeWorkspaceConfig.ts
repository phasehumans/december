import { css as cssLanguage } from '@codemirror/lang-css'
import { html as htmlLanguage } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { indentWithTab } from '@codemirror/commands'
import { indentUnit, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import type { CodeFile, CodeFilePath } from '@/features/preview/types'

const VSCODE_DARK_PLUS_BACKGROUND = '#1e1e1e'
const VSCODE_DARK_PLUS_TEXT = '#d4d4d4'
const VSCODE_DARK_PLUS_ACTIVE_LINE = '#2a2d2e'
const VSCODE_DARK_PLUS_SELECTION = '#264f78'
const VSCODE_DARK_PLUS_GUTTER_TEXT = '#858585'

export const FILES: CodeFile[] = [
    { path: 'index.html', label: 'index.html', language: 'html' },
    { path: 'styles.css', label: 'styles.css', language: 'css' },
    { path: 'script.js', label: 'script.js', language: 'javascript' },
]

const STYLE_BLOCK_REGEX = /<style\b[^>]*>([\s\S]*?)<\/style>/i
const INLINE_SCRIPT_REGEX = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/i

const normalizeBlock = (block: string) => block.replace(/^\n+|\n+$/g, '')

export const extractFilesFromHtml = (html: string): Record<CodeFilePath, string> => {
    const styleMatch = html.match(STYLE_BLOCK_REGEX)
    const scriptMatch = html.match(INLINE_SCRIPT_REGEX)

    return {
        'index.html': html,
        'styles.css': styleMatch?.[1] ? normalizeBlock(styleMatch[1]) : '',
        'script.js': scriptMatch?.[1] ? normalizeBlock(scriptMatch[1]) : '',
    }
}

export const applyStylesToHtml = (html: string, styles: string) => {
    const styleBlock = `<style>\n${styles}\n</style>`

    if (STYLE_BLOCK_REGEX.test(html)) {
        return html.replace(STYLE_BLOCK_REGEX, styleBlock)
    }

    if (html.includes('</head>')) {
        return html.replace('</head>', `    ${styleBlock}\n</head>`)
    }

    return `${styleBlock}\n${html}`
}

export const applyScriptToHtml = (html: string, script: string) => {
    const scriptBlock = `<script>\n${script}\n</script>`

    if (INLINE_SCRIPT_REGEX.test(html)) {
        return html.replace(INLINE_SCRIPT_REGEX, scriptBlock)
    }

    if (html.includes('</body>')) {
        return html.replace('</body>', `    ${scriptBlock}\n</body>`)
    }

    return `${html}\n${scriptBlock}`
}

export const vscodeDarkPlusTheme = EditorView.theme(
    {
        '&': {
            height: '100%',
            backgroundColor: VSCODE_DARK_PLUS_BACKGROUND,
            color: VSCODE_DARK_PLUS_TEXT,
            fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
            fontSize: '14px',
        },

        '.cm-scroller': {
            backgroundColor: VSCODE_DARK_PLUS_BACKGROUND,
            fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
            lineHeight: '1.5',
            overflow: 'auto',
        },

        '.cm-content': {
            backgroundColor: VSCODE_DARK_PLUS_BACKGROUND,
            padding: '8px 0',
            caretColor: '#ffffff',
        },

        '.cm-line': {
            paddingLeft: '4px',
        },

        '.cm-gutters': {
            backgroundColor: VSCODE_DARK_PLUS_BACKGROUND,
            color: VSCODE_DARK_PLUS_GUTTER_TEXT,
            border: 'none',
            minWidth: '42px',
        },

        '.cm-gutterElement': {
            padding: '0 10px 0 12px',
        },

        '.cm-lineNumbers .cm-gutterElement': {
            textAlign: 'right',
        },

        '.cm-activeLine': {
            backgroundColor: VSCODE_DARK_PLUS_ACTIVE_LINE,
        },

        '.cm-activeLineGutter': {
            backgroundColor: VSCODE_DARK_PLUS_ACTIVE_LINE,
            color: VSCODE_DARK_PLUS_TEXT,
        },

        '.cm-selectionBackground, .cm-content ::selection': {
            backgroundColor: `${VSCODE_DARK_PLUS_SELECTION} !important`,
        },

        '.cm-cursor, .cm-dropCursor': {
            borderLeftColor: '#ffffff',
        },
    },
    { dark: true }
)

export const vscodeDarkPlusHighlightStyle = HighlightStyle.define([
    {
        tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword, tags.modifier],
        color: '#569CD6',
    },
    { tag: [tags.string, tags.special(tags.string)], color: '#CE9178' },
    { tag: [tags.number, tags.bool, tags.null], color: '#B5CEA8' },
    { tag: tags.comment, color: '#6A9955', fontStyle: 'italic' },
    { tag: [tags.variableName, tags.propertyName, tags.attributeName], color: '#9CDCFE' },
    {
        tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.labelName],
        color: '#DCDCAA',
    },
    { tag: [tags.typeName, tags.className, tags.namespace], color: '#4EC9B0' },
    { tag: [tags.operator, tags.punctuation, tags.bracket, tags.separator], color: '#D4D4D4' },
])

export const vscodeDarkPlusExtensions: Extension[] = [
    vscodeDarkPlusTheme,
    syntaxHighlighting(vscodeDarkPlusHighlightStyle),
]

export const getSharedEditorExtensions = (): Extension[] => [
    EditorState.tabSize.of(2),
    EditorState.allowMultipleSelections.of(true),
    indentUnit.of('  '),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({
        spellcheck: 'false',
        'data-gramm': 'false',
    }),
    keymap.of([indentWithTab]),
    ...vscodeDarkPlusExtensions,
]

export const getLanguageExtension = (language: CodeFile['language']): Extension => {
    if (language === 'html') return htmlLanguage()
    if (language === 'css') return cssLanguage()
    return javascript()
}

export const codeMirrorBasicSetup = {
    autocompletion: true,
    bracketMatching: true,
    closeBrackets: true,
    defaultKeymap: true,
    drawSelection: true,
    foldGutter: true,
    foldKeymap: true,
    highlightActiveLine: true,
    highlightActiveLineGutter: true,
    highlightSelectionMatches: true,
    history: true,
    historyKeymap: true,
    indentOnInput: true,
    lineNumbers: true,
    rectangularSelection: true,
    searchKeymap: true,
    syntaxHighlighting: true,
}
