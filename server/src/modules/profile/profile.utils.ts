export const sanitizeMarkdown = (str: string): string => {
    return str
        .replace(/[\r\n]+/g, ' ') // replace newlines with spaces to prevent log/section breakout
        .replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1') // escape all markdown special characters
}
