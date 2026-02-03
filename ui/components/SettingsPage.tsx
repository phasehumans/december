import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    User, 
    Key, 
    CreditCard, 
    Bell, 
    Shield, 
    Users,
    Mail,
    Globe,
    LogOut,
    Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
    { id: 'general', label: 'General', icon: User },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
];

export const SettingsPage = () => {
    const [activeTab, setActiveTab] = useState('general');

    return (
        <div className="w-full h-full bg-[#050505] flex overflow-hidden">
            
            {/* Settings Sidebar */}
            <div className="w-64 shrink-0 border-r border-white/5 py-8 px-4 hidden md:block">
                <h2 className="text-xl font-display font-bold text-white px-4 mb-6 tracking-tight">Settings</h2>
                <div className="space-y-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                                activeTab === tab.id 
                                    ? "bg-white/10 text-white shadow-sm" 
                                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-8 py-10">
                    <AnimatePresence mode="wait">
                        
                        {/* General Tab */}
                        {activeTab === 'general' && (
                            <motion.div 
                                key="general"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-8"
                            >
                                <div>
                                    <h3 className="text-2xl font-display font-bold text-white mb-1">General Profile</h3>
                                    <p className="text-neutral-400 text-sm">Manage your personal information and preferences.</p>
                                </div>

                                {/* Avatar Section */}
                                <div className="p-6 rounded-2xl border border-white/5 bg-[#0A0A0A] flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-full bg-neutral-800 border-2 border-white/10 flex items-center justify-center text-xl font-medium text-neutral-400">
                                            AC
                                        </div>
                                        <div>
                                            <h4 className="text-white font-medium">Profile Picture</h4>
                                            <p className="text-xs text-neutral-500">JPG, GIF or PNG. Max 1MB.</p>
                                        </div>
                                    </div>
                                    <button className="px-4 py-2 bg-white text-black text-xs font-semibold rounded-lg hover:bg-neutral-200 transition-colors">
                                        Upload New
                                    </button>
                                </div>

                                {/* Form Fields */}
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-neutral-400 ml-1">First Name</label>
                                            <div className="relative">
                                                <input type="text" defaultValue="Alex" className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg py-2.5 px-4 text-sm text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all" />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-neutral-400 ml-1">Last Name</label>
                                            <div className="relative">
                                                <input type="text" defaultValue="Chen" className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg py-2.5 px-4 text-sm text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all" />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-neutral-400 ml-1">Email Address</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
                                            <input type="email" defaultValue="alex.chen@example.com" className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all" />
                                        </div>
                                    </div>
                                </div>

                                <div className="h-px bg-white/5 my-8" />

                                {/* Delete Account */}
                                <div className="p-6 rounded-2xl border border-red-500/10 bg-red-500/5 flex items-center justify-between">
                                    <div>
                                        <h4 className="text-red-400 font-medium text-sm mb-1">Delete Account</h4>
                                        <p className="text-xs text-red-400/60 max-w-sm">Permanently remove your account and all of its contents from the PhaseHumans platform. This action is not reversible.</p>
                                    </div>
                                    <button className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors underline decoration-red-400/30 underline-offset-4">
                                        Delete Account
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* Team Tab */}
                        {activeTab === 'team' && (
                             <motion.div 
                                key="team"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-8"
                            >
                                <div>
                                    <h3 className="text-2xl font-display font-bold text-white mb-1">Team Members</h3>
                                    <p className="text-neutral-400 text-sm">Manage access and roles for your workspace.</p>
                                </div>

                                <div className="rounded-xl border border-white/5 bg-[#0A0A0A] overflow-hidden">
                                    {[
                                        { name: 'Alex Chen', email: 'alex@example.com', role: 'Owner', img: 'AC' },
                                        { name: 'Sarah Miller', email: 'sarah@example.com', role: 'Editor', img: 'SM' },
                                        { name: 'Mike Ross', email: 'mike@example.com', role: 'Viewer', img: 'MR' },
                                    ].map((member, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-medium text-neutral-300">
                                                    {member.img}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-white">{member.name}</div>
                                                    <div className="text-xs text-neutral-500">{member.email}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-xs text-neutral-400 bg-white/5 px-2 py-1 rounded border border-white/5">{member.role}</span>
                                                <button className="text-neutral-500 hover:text-white transition-colors">
                                                    <LogOut size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button className="w-full py-2.5 border border-dashed border-white/20 rounded-xl text-sm text-neutral-400 hover:text-white hover:border-white/40 hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                                    <Users size={16} />
                                    Invite New Member
                                </button>
                            </motion.div>
                        )}

                         {/* Billing Tab */}
                         {activeTab === 'billing' && (
                             <motion.div 
                                key="billing"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-8"
                            >
                                <div>
                                    <h3 className="text-2xl font-display font-bold text-white mb-1">Billing & Plans</h3>
                                    <p className="text-neutral-400 text-sm">Manage your subscription and payment methods.</p>
                                </div>

                                <div className="p-6 rounded-2xl bg-gradient-to-br from-neutral-900 to-black border border-white/10 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-32 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
                                    
                                    <div className="relative z-10 flex justify-between items-start">
                                        <div>
                                            <div className="inline-flex items-center gap-2 px-2 py-1 bg-white/10 rounded-md border border-white/10 text-[10px] font-bold text-white uppercase tracking-wider mb-4">
                                                Current Plan
                                            </div>
                                            <h4 className="text-3xl font-bold text-white mb-1">Pro Plan</h4>
                                            <p className="text-neutral-400 text-sm mb-6">$29 / month per user</p>
                                            
                                            <ul className="space-y-2 mb-8">
                                                {['Unlimited generations', 'Priority processing', 'Team collaboration', 'API Access'].map((feat, i) => (
                                                    <li key={i} className="flex items-center gap-2 text-sm text-neutral-300">
                                                        <Check size={14} className="text-green-500" />
                                                        {feat}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="text-right">
                                            <button className="px-6 py-2.5 bg-white text-black text-sm font-bold rounded-lg hover:bg-neutral-200 transition-colors shadow-lg">
                                                Manage Subscription
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-lg font-bold text-white mb-4">Payment Methods</h4>
                                    <div className="p-4 rounded-xl border border-white/5 bg-[#0A0A0A] flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-8 bg-white rounded flex items-center justify-center">
                                                {/* Visa Icon Placeholder */}
                                                <div className="w-6 h-4 bg-blue-600 rounded-sm" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-white">Visa ending in 4242</div>
                                                <div className="text-xs text-neutral-500">Expires 12/28</div>
                                            </div>
                                        </div>
                                        <button className="text-xs text-neutral-400 hover:text-white">Edit</button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};