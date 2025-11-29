import React from 'react';
import { FolderPlus, BarChart3, UserCircle, Users, CheckSquare, List } from 'lucide-react';
import { TabId, UserProfile } from '../types';

interface BottomNavProps {
  currentTab: TabId;
  setTab: (tab: TabId) => void;
  user: UserProfile | null;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentTab, setTab, user }) => {
  const navItems = [
    { id: 'entry', label: 'এন্ট্রি', icon: FolderPlus, role: ['admin', 'host'] },
    { id: 'analysis', label: 'এনালাইসিস', icon: BarChart3, role: ['admin'] },
    { id: 'personal', label: 'পার্সোনাল', icon: UserCircle, role: ['admin', 'host'] },
    { id: 'share', label: 'শেয়ার', icon: Users, role: ['admin', 'host'] },
    { id: 'guest_list', label: 'গেস্ট', icon: List, role: ['admin', 'host'] },
    { id: 'final', label: 'ফাইনাল', icon: CheckSquare, role: ['admin'] },
  ];

  const filteredItems = navItems.filter(item => 
    item.role.includes(user?.role || '')
  );

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-slate-200 z-[100] pb-safe pt-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center px-1 pb-1">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id as TabId)}
              className="flex flex-col items-center justify-center p-1 flex-1 group"
            >
              <div className={`p-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-slate-900 text-white shadow-lg shadow-slate-300 -translate-y-1' : 'text-slate-400'}`}>
                 <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[9px] font-bold mt-1 transition-all duration-300 ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;