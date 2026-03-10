import { css as cssLanguage } from '@codemirror/lang-css'
import { html as htmlLanguage } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { indentWithTab } from '@codemirror/commands'
import { indentUnit, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import type { CodeFile, CodeFilePath } from '@/features/preview/types'

const IDE_BACKGROUND = '#1F1F1F'
const IDE_SURFACE = '#262626'
const IDE_BORDER = '#303030'
const IDE_TEXT = '#E6E6E6'
const IDE_MUTED = '#9B9B9B'

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
    const styleBlock = `<style>\n${styles}\n    </style>`

    if (STYLE_BLOCK_REGEX.test(html)) {
        return html.replace(STYLE_BLOCK_REGEX, styleBlock)
    }

    if (html.includes('</head>')) {
        return html.replace('</head>', `    ${styleBlock}\n</head>`)
    }

    return `${styleBlock}\n${html}`
}

export const applyScriptToHtml = (html: string, script: string) => {
    const scriptBlock = `<script>\n${script}\n    </script>`

    if (INLINE_SCRIPT_REGEX.test(html)) {
        return html.replace(INLINE_SCRIPT_REGEX, scriptBlock)
    }

    if (html.includes('</body>')) {
        return html.replace('</body>', `    ${scriptBlock}\n</body>`)
    }

    return `${html}\n${scriptBlock}`
}

const codeMirrorTheme = EditorView.theme(
    {
        '&': {
            height: '100%',
            backgroundColor: IDE_BACKGROUND,
            color: IDE_TEXT,
            fontSize: '13px',
        },
        '.cm-scroller': {
            fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", "Courier New", monospace',
            lineHeight: '20px',
            overflow: 'auto',
        },
        '.cm-content': {
            padding: '12px 0 16px',
            caretColor: '#F0F0F0',
        },
        '.cm-line': {
            paddingLeft: '2px',
        },
        '.cm-gutters': {
            backgroundColor: IDE_BACKGROUND,
            color: IDE_MUTED,
            borderRight: `1px solid ${IDE_BORDER}`,
            minWidth: '44px',
        },
        '.cm-gutterElement': {
            padding: '0 10px 0 8px',
        },
        '.cm-activeLine': {
            backgroundColor: IDE_SURFACE,
        },
        '.cm-activeLineGutter': {
            backgroundColor: IDE_SURFACE,
            color: IDE_TEXT,
        },
        '.cm-selectionBackground, .cm-content ::selection': {
            backgroundColor: '#3B3B3B !important',
        },
        '.cm-cursor, .cm-dropCursor': {
            borderLeftColor: '#F0F0F0',
        },
        '.cm-foldPlaceholder': {
            backgroundColor: IDE_SURFACE,
            borderColor: IDE_BORDER,
            color: IDE_MUTED,
        },
        '.cm-matchingBracket': {
            color: '#E6C07B !important',
            backgroundColor: '#363129',
            outline: '1px solid #4E473A',
        },
        '.cm-nonmatchingBracket': {
            color: '#FF6B6B !important',
        },
        '.cm-tooltip': {
            backgroundColor: '#242424',
            color: IDE_TEXT,
            border: `1px solid ${IDE_BORDER}`,
        },
        '.cm-tooltip-autocomplete > ul': {
            maxHeight: '220px',
        },
        '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
            backgroundColor: '#323232',
            color: IDE_TEXT,
        },
        '.cm-panels': {
            backgroundColor: '#242424',
            borderBottom: `1px solid ${IDE_BORDER}`,
            color: IDE_TEXT,
        },
        '.cm-searchMatch, .cm-selectionMatch': {
            backgroundColor: '#4A4132',
            outline: '1px solid #7D6A4A',
        },
    },
    { dark: true }
)

const codeMirrorHighlightStyle = HighlightStyle.define([
    { tag: [tags.comment, tags.meta], color: '#8C8C8C' },
    {
        tag: [tags.keyword, tags.operatorKeyword, tags.controlKeyword, tags.modifier],
        color: '#E4A95F',
    },
    { tag: [tags.string, tags.special(tags.string)], color: '#94C79C' },
    { tag: [tags.number, tags.bool, tags.null], color: '#D48AA6' },
    { tag: [tags.tagName, tags.className, tags.typeName], color: '#8DB5F2' },
    { tag: [tags.attributeName, tags.propertyName], color: '#E1BE8A' },
    { tag: [tags.function(tags.variableName), tags.labelName], color: '#8BC0F2' },
    { tag: [tags.variableName, tags.name], color: IDE_TEXT },
    { tag: [tags.operator, tags.punctuation, tags.bracket], color: '#CFCFCF' },
    { tag: tags.invalid, color: '#FF6B6B' },
])

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
    codeMirrorTheme,
    syntaxHighlighting(codeMirrorHighlightStyle),
]

export const getLanguageExtension = (language: CodeFile['language']): Extension => {
    if (language === 'html') {
        return htmlLanguage()
    }

    if (language === 'css') {
        return cssLanguage()
    }

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
