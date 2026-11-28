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
// - the Account page is the model. a list (secrets, keys, usage, history, apps) is a box
//   with the same surface as a section box, with a header band and a line between rows
export const pageTitleClass =
    'text-[20px] md:text-[18px] font-sans font-medium tracking-[-0.025em] text-[#D6D5C9] mb-1'
// one step brighter than the grey of row hints, so the lines under headings read easily
export const pageSubtitleClass = 'text-[13px] text-[#9A9998]'
export const sectionTitleClass = 'text-[16px] md:text-[15px] font-medium text-[#D6D5C9]'
export const sectionDescriptionClass = 'text-[13px] text-[#9A9998]'
/** the surface of every box on a settings page: a step lighter than the page */
export const boxSurfaceClass = 'bg-[#1F1F1F] border border-[#2A2A2A] rounded-xl'
/** the box around the rows of a section */
export const sectionBoxClass = `flex flex-col gap-2.5 ${boxSurfaceClass} px-4 py-3`
/** a list box: the same surface, with no padding, so rows and the header band reach the edge */
export const listBoxClass = `${boxSurfaceClass} overflow-hidden flex flex-col`
/** the header band of a list box, a step lighter than its rows */
export const listHeaderClass =
    'bg-[#252525] border-b border-[#2A2A2A] px-3.5 md:px-4 py-2.5 text-[12px] font-medium text-[#7B7A79]'
/** the rows of a list box, with one line between them */
export const listRowsClass = 'flex flex-col divide-y divide-[#2A2A2A]'
/** one row of a list box: a title with a grey note under it, and what the row can do */
export const listRowClass = 'flex items-center gap-3 px-3.5 md:px-4 py-3 text-[13px]'
export const listRowTitleClass = 'text-[#D6D5C9] font-medium truncate'
export const listRowNoteClass = 'text-[12px] text-[#7B7A79] truncate'
/** a blue text link inside a row (the "PDF" of a receipt) */
export const textLinkClass =
    'text-[#87B2F4] hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-default'
/** a quiet grey text button beside a value ("Change") */
export const quietLinkClass =
    'text-[12.5px] font-medium text-[#8F8E8D] hover:text-[#D6D5D4] transition-colors outline-none cursor-pointer'
/** the one grey line in an empty list box */
export const listEmptyClass = 'px-4 py-6 text-[13px] text-[#7B7A79]'
/** the two-part switch (1d 7d 30d, credits or keys): the look of ChoiceGroup on Account */
export const segmentGroupClass =
    'inline-flex items-center gap-1 bg-[#1a1a1a] p-0.5 rounded-lg border border-[#282828]'
export const segmentClass = (selected: boolean) =>
    `px-2.5 py-1 text-[12px] font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
        selected ? 'bg-[#282828] text-white shadow-sm' : 'text-[#8F8E8D] hover:text-[#D6D5C9]'
    }`
/** the outline button of a row (Edit, View, Sign out) and the one blue button of a page */
export const outlineButtonClass =
    'shrink-0 px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors cursor-pointer'
export const blueButtonClass =
    'shrink-0 px-4 py-1.5 rounded-lg bg-[#87B2F4] text-[#100E12] hover:bg-[#A3C7FF] text-[13px] font-medium transition-colors cursor-pointer'

/** the one grey line under each page heading */
export const PAGE_SUBTITLES = {
    account: 'Manage your profile, preferences and sign-in.',
    pullRequests: 'Set how December opens, answers and reviews pull requests.',
    sandbox: 'See what runs now, and set when it stops.',
    yourKeys: 'Add your own API keys. Runs on them use no December credits.',
    billing: 'Manage your credits and payments.',
    usage: 'View what your sessions used and what it cost.',
    members: 'Invite people to your team. Shared sessions and billing come later.',
    connections: 'Manage the apps and tools December can use.',
} as const
