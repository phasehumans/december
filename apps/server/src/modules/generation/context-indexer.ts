/**
 * Extracts TypeScript interfaces, type definitions, and component function declarations
 * from a source code string.
 */
export function extractDeclarations(code: string): string {
    const lines = code.split('\n')
    const declarations: string[] = []

    let inInterface = false
    let inType = false
    let braceCount = 0
    let currentDeclaration = ''

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        const trimmed = line.trim()

        if (!inInterface && !inType) {
            // Match "export interface Name {", "export interface Name<...>"
            const interfaceMatch = trimmed.match(/^export\s+interface\s+(\w+)/)
            if (interfaceMatch) {
                inInterface = true
                currentDeclaration = line
                braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
                if (braceCount === 0 && line.includes('{')) {
                    inInterface = false
                    declarations.push(currentDeclaration)
                }
                continue
            }

            // Match "export type Name = {", "export type Name ="
            const typeMatch = trimmed.match(/^export\s+type\s+(\w+)/)
            if (typeMatch) {
                inType = true
                currentDeclaration = line
                braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
                if (braceCount === 0 && (line.includes(';') || trimmed.endsWith('}'))) {
                    inType = false
                    declarations.push(currentDeclaration)
                }
                continue
            }

            // Match component function and arrow function declarations
            const funcMatch = trimmed.match(/^export\s+(?:default\s+)?(function|const|let)\s+(\w+)/)
            if (funcMatch) {
                if (
                    trimmed.includes('function') ||
                    trimmed.includes('=>') ||
                    trimmed.includes(': React.FC') ||
                    trimmed.includes(': FC')
                ) {
                    // Check if it has an opening brace '{' at all
                    let hasBrace = false
                    for (let x = i; x < lines.length; x++) {
                        if (lines[x]!.includes('{')) {
                            hasBrace = true
                            break
                        }
                    }

                    if (!hasBrace) {
                        declarations.push(line.trim())
                        continue
                    }

                    let signature = ''
                    let localBraceCount = 0
                    let parenCount = 0
                    let foundEnd = false
                    let j = i

                    while (j < lines.length && !foundEnd) {
                        const currentLine = lines[j]!
                        for (let k = 0; k < currentLine.length; k++) {
                            const char = currentLine[k]!
                            if (char === '(') {
                                parenCount++
                            } else if (char === ')') {
                                parenCount--
                            } else if (char === '{') {
                                if (parenCount === 0 && localBraceCount === 0) {
                                    signature += currentLine.slice(0, k)
                                    foundEnd = true
                                    break
                                }
                                localBraceCount++
                            } else if (char === '}') {
                                localBraceCount--
                            }
                        }
                        if (!foundEnd) {
                            signature += (signature ? '\n' : '') + currentLine
                            j++
                        }
                    }

                    if (foundEnd) {
                        declarations.push(signature.trim())
                        i = j
                        continue
                    }
                }
            }
        } else {
            currentDeclaration += '\n' + line
            braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
            if (braceCount <= 0) {
                inInterface = false
                inType = false
                declarations.push(currentDeclaration)
            }
        }
    }

    return declarations.join('\n\n')
}

/**
 * Iterates through a map of project files and builds a dictionary mapping
 * file paths to their extracted TypeScript signatures.
 */
export function buildDeclarationMap(files: Record<string, string>): Record<string, string> {
    const map: Record<string, string> = {}
    for (const [path, content] of Object.entries(files)) {
        if ((path.endsWith('.ts') || path.endsWith('.tsx')) && path.startsWith('src/')) {
            const decls = extractDeclarations(content)
            if (decls.trim()) {
                map[path] = decls
            }
        }
    }
    return map
}
