import React from 'react';
import { FolderPlus, BarChart3, UserCircle, Users, CheckSquare, List, Wallet } from 'lucide-react';
import { TabId, UserProfile } from '../types';

interface BottomNavProps {
  currentTab: TabId;
  setTab: (tab: TabId) => void;
  user: UserProfile | null;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentTab, setTab, user }) => {
  if (!user || !user.role) return null;

  // Ensure role is trimmed and normalized
  const userRole = String(user.role).trim().toLowerCase();

  const navItems = [
    { id: 'entry', label: 'এন্ট্রি', icon: FolderPlus, role: ['admin', 'host'] },
    { id: 'analysis', label: 'এনালাইসিস', icon: BarChart3, role: ['admin'] },
    { id: 'personal', label: 'পার্সোনাল', icon: UserCircle, role: ['admin'] },
    { id: 'share', label: 'পার্টনার', icon: Users, role: ['admin'] },
    { id: 'guest_list', label: 'গেস্ট', icon: List, role: ['admin', 'host'] },
    { id: 'settlement', label: 'সেটেলমেন্ট', icon: Wallet, role: ['host'] },
    { id: 'final', label: 'ফাইনাল', icon: CheckSquare, role: ['admin'] },
  ];

  // Robust filtering
  const filteredItems = navItems.filter(item => 
    item.role && item.role.includes(userRole)
  );

  if (filteredItems.length === 0) return null;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-[10000] pb-safe shadow-[0_-10px_30px_-5px_rgba(0,0,0,0.15)] h-[70px] flex items-end">
      <div className="flex justify-around items-end w-full px-1 pt-2 pb-2">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id as TabId)}
              className="flex flex-col items-center justify-center p-1 flex-1 group focus:outline-none touch-manipulation active:scale-95 transition-transform"
            >
              <div className={`p-2 rounded-xl transition-all duration-300 transform ${isActive ? 'bg-slate-900 text-white shadow-lg shadow-slate-300 -translate-y-1' : 'text-slate-400 bg-transparent hover:bg-slate-50'}`}>
                 <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[9px] font-bold mt-1 transition-all duration-300 ${isActive ? 'text-slate-900 opacity-100' : 'text-slate-400 opacity-80'}`}>
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