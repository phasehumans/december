interface BlogFrontmatter {
    title: string
    description: string
    publishDate: string
    currentSlug: string
    /** Place in the list on /me: 1 is the top. Posts without it go last, newest first */
    order?: number
}

export interface BlogPost {
    slug: string
    title: string
    desc: string
    date: string
    timestamp: number
    order?: number
}

// Frontmatter dates use "Sept", which Date.parse does not read
const parsePublishDate = (date: string) => Date.parse(date.replace('Sept', 'Sep'))

// Read title, date, and slug from each post's frontmatter so every list always matches the posts.
// Lazy (not eager) on purpose: BlogLayout reads this list and every post imports BlogLayout,
// so an eager import here would be circular.
const postModules = import.meta.glob<{ frontmatter: BlogFrontmatter }>('../pages/blog/*.mdx')

/** All blog posts, by their order field, then newest first. */
export const loadBlogPosts = async (): Promise<BlogPost[]> => {
    const modules = await Promise.all(Object.values(postModules).map((load) => load()))
    return modules
        .map(({ frontmatter }) => ({
            slug: frontmatter.currentSlug,
            title: frontmatter.title,
            desc: frontmatter.description,
            date: frontmatter.publishDate,
            timestamp: parsePublishDate(frontmatter.publishDate),
            order: frontmatter.order,
        }))
        .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || b.timestamp - a.timestamp)
}
