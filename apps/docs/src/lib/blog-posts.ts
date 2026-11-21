interface BlogFrontmatter {
    title: string
    description: string
    publishDate: string
    currentSlug: string
}

export interface BlogPost {
    slug: string
    title: string
    desc: string
    date: string
    timestamp: number
}

// Frontmatter dates use "Sept", which Date.parse does not read
const parsePublishDate = (date: string) => Date.parse(date.replace('Sept', 'Sep'))

// Read title, date, and slug from each post's frontmatter so every list always matches the posts
const postModules = import.meta.glob<{ frontmatter: BlogFrontmatter }>('../pages/blog/*.mdx', {
    eager: true,
})

/** All blog posts, newest first. */
export const blogPosts: BlogPost[] = Object.values(postModules)
    .map(({ frontmatter }) => ({
        slug: frontmatter.currentSlug,
        title: frontmatter.title,
        desc: frontmatter.description,
        date: frontmatter.publishDate,
        timestamp: parsePublishDate(frontmatter.publishDate),
    }))
    .sort((a, b) => b.timestamp - a.timestamp)
