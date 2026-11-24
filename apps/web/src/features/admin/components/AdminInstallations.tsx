import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'

import { adminAPI, type AdminInstallation } from '../api/admin'

import {
    AdminButton,
    AdminList,
    AdminRow,
    AdminSection,
    ErrorLine,
    Muted,
    Tag,
    adminInputClass,
    shortDate,
    useAdminAction,
} from './AdminUi'

const KEY = ['admin', 'github-installations']

const InstallationRow: React.FC<{ installation: AdminInstallation }> = ({ installation }) => {
    const [userId, setUserId] = useState('')
    const assign = useAdminAction(
        (id: string, owner: string) => adminAPI.assignInstallation(id, owner),
        [KEY]
    )

    return (
        <AdminRow>
            <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] text-[#D6D5C9]">
                        {installation.accountLogin ?? installation.installationId}
                    </span>
                    {installation.accountType && (
                        <Tag>{installation.accountType.toLowerCase()}</Tag>
                    )}
                    {!installation.userId && <Tag tone="warn">unclaimed</Tag>}
                </div>
                <Muted className="break-all">
                    {installation.email ?? 'no user'} · {shortDate(installation.createdAt)}
                </Muted>
                <ErrorLine error={assign.error} />
            </div>
            <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                    e.preventDefault()
                    if (userId.trim()) assign.mutate([installation.id, userId.trim()])
                }}
            >
                <input
                    aria-label="User id"
                    placeholder="User id"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className={`${adminInputClass} font-mono w-[200px]`}
                />
                <AdminButton type="submit" disabled={!userId.trim() || assign.isPending}>
                    Assign
                </AdminButton>
            </form>
        </AdminRow>
    )
}

export const AdminInstallations: React.FC = () => {
    const { data, error, isLoading } = useQuery({
        queryKey: KEY,
        queryFn: adminAPI.listInstallations,
    })

    return (
        <AdminSection title="GitHub app installations">
            <ErrorLine error={error} />
            {!isLoading && (
                <AdminList empty="No installations">
                    {(data?.items ?? []).map((installation) => (
                        <InstallationRow key={installation.id} installation={installation} />
                    ))}
                </AdminList>
            )}
        </AdminSection>
    )
}
