// one look for every settings subpage, taken from the Connections and Sessions pages:
// - the page heading is the Connections heading (20px on desktop) with one grey line under
//   it, like "Manage and view all your sessions." on the Sessions page. phones show the
//   same heading in the page, and the top bar has only "Back"
// - a section heading inside a page is smaller than the page heading and larger than the
//   row text (16px, rows are 14px)
// - no divider lines. each section is a heading with one grey line, above a rounded box
//   that holds its rows. the box is a step lighter than the page and kept compact
// - the content column is as wide as the Connections column, so the heading sits at the
//   same place on every subpage
export const pageTitleClass =
    'text-[20px] md:text-[18px] font-sans font-medium tracking-[-0.025em] text-[#D6D5C9] mb-1'
// one step brighter than the grey of row hints, so the lines under headings read easily
export const pageSubtitleClass = 'text-[13px] text-[#9A9998]'
export const sectionTitleClass = 'text-[16px] md:text-[15px] font-medium text-[#D6D5C9]'
export const sectionDescriptionClass = 'text-[13px] text-[#9A9998]'
/** the box around the rows of a section. the same surface as the list boxes */
export const sectionBoxClass =
    'flex flex-col gap-2.5 bg-[#1F1F1F] border border-[#2A2A2A] rounded-xl px-4 py-3'

/** the one grey line under each page heading */
export const PAGE_SUBTITLES = {
    account: 'Manage your profile, preferences and sign-in.',
    notifications: 'Choose what December tells you about, and where.',
    defaults: 'Set what a new session starts with.',
    pullRequests: 'Set how December opens, answers and reviews pull requests.',
    sandbox: 'See what runs now, and set when it stops.',
    yourKeys: 'Add your own API keys. Runs on them use no December credits.',
    billing: 'Manage your credits and payments.',
    usage: 'View what your sessions used and what it cost.',
    members: 'Manage the people in your team.',
    connections: 'Manage the apps and tools December can use.',
} as const
