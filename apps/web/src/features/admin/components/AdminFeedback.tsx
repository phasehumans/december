import { useQuery } from '@tanstack/react-query'
import React from 'react'

import { adminAPI } from '../api/admin'

import { AdminList, AdminRow, AdminSection, ErrorLine, Muted, Tag, shortDate } from './AdminUi'

export const AdminFeedback: React.FC = () => {
    const { data, error, isLoading } = useQuery({
        queryKey: ['admin', 'feedback'],
        queryFn: adminAPI.listFeedback,
    })

    return (
        <AdminSection title="Feedback">
            <ErrorLine error={error} />
            {!isLoading && (
                <AdminList empty="No feedback yet">
                    {(data?.items ?? []).map((item) => (
                        <AdminRow key={item.id}>
                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[14px] text-[#D6D5C9] break-all">
                                        {item.email}
                                    </span>
                                    {item.rating && <Tag>{item.rating}</Tag>}
                                    {item.creditRequestStatus === 'APPROVED' && (
                                        <Tag tone="ok">got $5</Tag>
                                    )}
                                </div>
                                <span className="text-[13px] text-[#B5B4AE] whitespace-pre-wrap">
                                    {item.feedback}
                                </span>
                                <Muted>{shortDate(item.createdAt)}</Muted>
                            </div>
                        </AdminRow>
                    ))}
                </AdminList>
            )}
        </AdminSection>
    )
}
