/**
 * The full name of a repository on a git host: `owner/name`. A GitLab path can have more
 * parts (`group/team/name`): the name is the last part and the owner is all before it.
 * One validator and one split for the server and the worker (review B5).
 */

/**
 * `owner/name` or a GitLab group path. A part of dots only (`.`, `..`) is refused: it
 * would point a request at another path of the git host.
 */
export const isRepoFullName = (value: string): boolean => {
    if (value.length > 200) return false
    if (!/^[\w.-]+(\/[\w.-]+)+$/.test(value)) return false
    return value.split('/').every((part) => !/^\.+$/.test(part))
}

/** the owner (all parts before the last) and the name (the last part), or null */
export const splitRepoFullName = (value: string): { owner: string; name: string } | null => {
    if (!isRepoFullName(value)) return null
    const cut = value.lastIndexOf('/')
    return { owner: value.slice(0, cut), name: value.slice(cut + 1) }
}

/** `owner/name` from the two saved parts, or null when one of them is not known */
export const joinRepoFullName = (
    owner: string | null | undefined,
    name: string | null | undefined
): string | null => (owner && name ? `${owner}/${name}` : null)
