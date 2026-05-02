import React from 'react'
import { CreditCard, ArrowUpRight } from 'lucide-react'

export const ProfileBillingSettings: React.FC = () => {
    return (
        <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9]">
            {/* Current Plan */}
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Current Plan</h1>
                <div className="flex flex-col gap-7 border-t border-[#242323] pt-6">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">
                                Free Plan <span className="text-[#7B7A79] ml-1">$0/mo</span>
                            </span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Includes $5 credits every month.
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors">
                                View Plans
                            </button>
                            <button className="px-4 py-1.5 rounded-lg bg-[#D6D5C9] text-[#171615] text-[13px] font-medium hover:bg-white transition-colors">
                                Upgrade
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Credit Balance */}
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Credit Balance</h1>
                <div className="flex flex-col gap-6 border-t border-[#242323] pt-6">
                    <div className="flex items-start justify-between">
                        <div className="flex flex-col gap-0.5 max-w-[85%]">
                            <span className="text-[13px] text-[#7B7A79] leading-relaxed">
                                Your monthly credits reset in 20 days. Monthly credits are used
                                first. Remaining credits are used based on the earliest expiration
                                date.
                            </span>
                        </div>
                        <button className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors mt-1">
                            Upgrade
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row gap-8 mt-2 items-center">
                        <div className="w-[220px] h-[130px] rounded-xl border border-[#383736] bg-gradient-to-br from-[#1E1D1B] to-[#171615] p-5 flex flex-col justify-between relative overflow-hidden shadow-lg">
                            <div className="absolute top-4 right-4 text-[#7B7A79] opacity-50">
                                <CreditCard className="w-6 h-6" strokeWidth={1.5} />
                            </div>
                            <div className="flex flex-col mt-auto">
                                <span className="text-[28px] font-medium text-[#D6D5C9] tracking-tight">
                                    $5.00
                                </span>
                                <span className="text-[12px] text-[#7B7A79] truncate mt-1">
                                    phasehumans User
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 w-full flex flex-col justify-center gap-3.5 text-[13px]">
                            <div className="flex justify-between items-center text-[#7B7A79]">
                                <span>Gifted Credits</span>
                                <span>$0.00</span>
                            </div>
                            <div className="flex justify-between items-center text-[#D6D5C9]">
                                <span>Monthly Credits</span>
                                <span>$5.00 / $5.00</span>
                            </div>
                            <div className="flex justify-between items-center text-[#7B7A79]">
                                <span>Purchased Credits</span>
                                <span>$0.00</span>
                            </div>
                            <div className="flex justify-between items-center text-[#D6D5C9] font-medium pt-3 border-t border-[#242323]">
                                <span>Total Available Credits</span>
                                <span>$5.00</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Credit Expiration Schedule */}
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Credit Expiration Schedule</h1>
                <div className="flex flex-col border-t border-[#242323]">
                    <div className="flex justify-between py-3 border-b border-[#242323] text-[12px] text-[#7B7A79]">
                        <span className="w-1/3">Type</span>
                        <span className="w-1/3">Credit Balance</span>
                        <span className="w-1/3 text-right">Expiration</span>
                    </div>
                    <div className="flex justify-between py-4 text-[13px] text-[#D6D5C9]">
                        <span className="w-1/3 font-medium">Monthly</span>
                        <span className="w-1/3">$5.00 / $5.00</span>
                        <span className="w-1/3 text-right">Jun 25, 2026</span>
                    </div>
                </div>
            </div>

            {/* Used and Expired Credits Over Past 3 Months */}
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">
                    Used and Expired Credits Over Past 3 Months
                </h1>
                <div className="flex flex-col border-t border-[#242323]">
                    <div className="flex justify-between py-3 border-b border-[#242323] text-[12px] text-[#7B7A79]">
                        <span className="w-1/3">Type</span>
                        <span className="w-1/3">Credit Balance</span>
                        <span className="w-1/3 text-right">Expiration</span>
                    </div>
                    <div className="flex flex-col">
                        <div className="flex justify-between py-3.5 text-[13px] text-[#D6D5C9] border-b border-[#242323]">
                            <span className="w-1/3 font-medium">Monthly</span>
                            <span className="w-1/3">$4.90 / $5.00</span>
                            <span className="w-1/3 text-right">May 26, 2026</span>
                        </div>
                        <div className="flex justify-between py-3.5 text-[13px] text-[#D6D5C9] border-b border-[#242323]">
                            <span className="w-1/3 font-medium">Monthly</span>
                            <span className="w-1/3">$4.30 / $5.00</span>
                            <span className="w-1/3 text-right">Apr 25, 2026</span>
                        </div>
                        <div className="flex justify-between py-3.5 text-[13px] text-[#D6D5C9]">
                            <span className="w-1/3 font-medium">Monthly</span>
                            <span className="w-1/3">$4.82 / $5.00</span>
                            <span className="w-1/3 text-right">Mar 28, 2026</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Payment & Invoices */}
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Payment & Verification</h1>
                <div className="flex flex-col gap-7 border-t border-[#242323] pt-6">
                    {/* Payment Method */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Payment Method</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                No payment method added. Add one to your account.
                            </span>
                        </div>
                        <button className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors">
                            Add Card
                        </button>
                    </div>

                    {/* Usage Code */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Redeem a Usage Code</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Redeem a usage code to claim your gifted credits.
                            </span>
                        </div>
                        <button className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors">
                            Redeem Code
                        </button>
                    </div>

                    {/* Student Verification */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Student Verification</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Verify your student email to unlock Premium benefits.
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="email"
                                placeholder="name@university.edu"
                                className="bg-[#100E12] border border-[#383736] rounded-lg px-3 py-1.5 text-[13px] text-[#D6D5C9] focus:outline-none focus:border-[#7B7A79] w-[180px] placeholder:text-[#4A4948]"
                            />
                            <button className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#7B7A79] opacity-50 cursor-not-allowed">
                                Verify Email
                            </button>
                        </div>
                    </div>

                    {/* Invoices */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Invoices</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Your invoices are managed on the dashboard.
                            </span>
                        </div>
                        <button className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors">
                            Dashboard
                            <ArrowUpRight className="w-3.5 h-3.5 text-[#7B7A79]" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
