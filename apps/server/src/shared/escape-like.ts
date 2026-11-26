/**
 * Text for a Prisma `contains`, `startsWith`, `endsWith` or insensitive `equals`. Prisma
 * turns them into LIKE or ILIKE without escaping, so `_` and `%` match any character: a
 * search for "50%" found "500", the repository "my_repo" matched "myXrepo" and the email
 * "a_b@x.com" matched "aXb@x.com". The backslash is the escape character of LIKE in
 * Postgres.
 */
export const escapeLike = (text: string): string => text.replace(/[\\%_]/g, (char) => `\\${char}`)
