import React from 'react'

import {
    pageSubtitleClass,
    pageTitleClass,
    sectionDescriptionClass,
    sectionTitleClass,
} from './settingsStyles'

/**
 * The heading of a settings subpage: the page name and one grey line under it, in the
 * page itself on desktop and on phones, like the Sessions page.
 */
export const SettingsPageHeader: React.FC<{
    title: string
    subtitle: React.ReactNode
}> = ({ title, subtitle }) => (
    <div className="flex flex-col mb-5 md:mb-6">
        <h1 className={pageTitleClass}>{title}</h1>
        <p className={pageSubtitleClass}>{subtitle}</p>
    </div>
)

/**
 * The heading of one section inside a settings page: smaller than the page heading, with
 * one grey line under it and an optional action on the right.
 */
export const SettingsSectionHeading: React.FC<{
    title: string
    description?: React.ReactNode
    action?: React.ReactNode
}> = ({ title, description, action }) => (
    <div className="flex items-end justify-between gap-3 mb-2.5">
        <div className="flex flex-col gap-0.5 min-w-0">
            <h2 className={sectionTitleClass}>{title}</h2>
            {description && <p className={sectionDescriptionClass}>{description}</p>}
        </div>
        {action}
    </div>
)
