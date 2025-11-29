import React, { useState, useEffect } from 'react';
import { auth, db } from './services/firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { UserProfile, TabId, Tour } from './types';
import { LogOut, LayoutGrid, FolderPlus, BarChart3, UserCircle, Users, CheckSquare, Lock, List } from 'lucide-react';

// Components
import EntryTab from './components/EntryTab';
import AnalysisTab from './components/AnalysisTab';
import PersonalTab from './components/PersonalTab';
import ShareTourTab from './components/ShareTourTab';
import FinalTab from './components/FinalTab';
import BottomNav from './components/BottomNav';
import LoginScreen from './components/LoginScreen';
import AgencyDashboard from './components/AgencyDashboard';
import HostGuestList from './components/HostGuestList';

const App = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentTab, setCurrentTab] = useState<TabId>('entry');
  const [loading, setLoading] = useState(true);
  const [noAccess, setNoAccess] = useState(false);
  
  // Global Data
  const [tours, setTours] = useState<Tour[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              if (userData.role) {
                  const role = userData.role;
                  setUser({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email || '',
                    ...userData
                  } as UserProfile);
                  
                  // Set default tab based on role
                  if (role === 'host') {
                      setCurrentTab('guest_list');
                  } else {
                      setCurrentTab('entry');
                  }
                  
                  setNoAccess(false);
              } else {
                  setNoAccess(true);
              }
            } else {
               setNoAccess(true);
            }
        } catch (e) {
            console.error("Error fetching user profile", e);
            setNoAccess(true);
        }
      } else {
        setUser(null);
        setTours([]);
        setAllUsers([]);
        setNoAccess(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && !noAccess) {
        fetchTours();
        if (user.role === 'admin') {
            fetchAllUsers();
        }
    }
  }, [user, noAccess]);

  const fetchAllUsers = async () => {
      try {
          const snapshot = await getDocs(collection(db, 'users'));
          const usersList: UserProfile[] = [];
          snapshot.forEach(doc => {
              usersList.push({ uid: doc.id, ...doc.data() } as UserProfile);
          });
          setAllUsers(usersList);
      } catch (e) {
          console.error("Error fetching users:", e);
      }
  };

  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchTours = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'tours'), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      let fetchedTours: Tour[] = [];
      querySnapshot.forEach((doc) => {
        fetchedTours.push({ id: doc.id, ...doc.data() } as Tour);
      });

      // Strict filtering for Host
      if (user.role === 'host') {
          // Explicitly convert both IDs to string and trim to avoid mismatches
          const currentUserId = String(user.uid).trim();
          fetchedTours = fetchedTours.filter(t => 
              t.assignedHostId && String(t.assignedHostId).trim() === currentUserId
          );
      } else if (user.role === 'agency') {
          const todayStr = getLocalDateString();
          fetchedTours = fetchedTours.filter(t => {
             const isPartner = t.partnerAgencies && t.partnerAgencies.some(a => a.email === user.email);
             const isUpcoming = t.date >= todayStr;
             return isPartner || isUpcoming;
          });
      }
      
      setTours(fetchedTours);
    } catch (error) {
      console.error("Error fetching tours:", error);
    }
  };

  const handleLogout = () => {
      signOut(auth);
      setAllUsers([]);
      setCurrentTab('entry');
      setNoAccess(false);
  };

  if (loading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-slate-200 rounded-full border-t-violet-600 animate-spin"></div>
            </div>
        </div>
    );
  }

  if (noAccess) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
              <div className="bg-white p-8 rounded-2xl max-w-sm w-full shadow-lg border border-slate-100">
                  <div className="bg-rose-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-500">
                      <Lock size={24} />
                  </div>
                  <h2 className="text-xl font-black text-slate-800 mb-2">প্রবেশাধিকার নেই</h2>
                  <p className="text-slate-500 mb-6 text-xs font-bold">অ্যাকাউন্টে কোনো রোল নেই। অ্যাডমিনের সাথে যোগাযোগ করুন।</p>
                  <button onClick={() => signOut(auth)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-xs">লগ আউট</button>
              </div>
          </div>
      );
  }

  if (!user) return <LoginScreen />;

  if (user.role === 'agency') {
      return (
          <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
              <AgencyDashboard user={user} tours={tours} refreshTours={fetchTours} handleLogout={handleLogout} />
          </div>
      );
  }

  const commonProps = { user, allUsers, tours, refreshTours: fetchTours };

  const renderContent = () => {
    switch (currentTab) {
      case 'entry': return <EntryTab {...commonProps} />;
      case 'analysis': return <AnalysisTab {...commonProps} />;
      case 'personal': return <PersonalTab {...commonProps} />;
      case 'share': return <ShareTourTab {...commonProps} />;
      case 'final': return <FinalTab {...commonProps} />;
      case 'guest_list': return <HostGuestList {...commonProps} />;
      default: return <EntryTab {...commonProps} />;
    }
  };

  const navItems = [
    { id: 'entry', label: 'ট্যুর ইভেন্ট', icon: FolderPlus, role: ['admin', 'host'] },
    { id: 'analysis', label: 'এনালাইসিস', icon: BarChart3, role: ['admin'] },
    { id: 'personal', label: 'পার্সোনাল', icon: UserCircle, role: ['admin', 'host'] },
    { id: 'share', label: 'পার্টনার', icon: Users, role: ['admin', 'host'] },
    { id: 'guest_list', label: 'গেস্ট লিস্ট', icon: List, role: ['host', 'admin'] },
    { id: 'final', label: 'ফাইনাল', icon: CheckSquare, role: ['admin'] },
  ];
  
  const filteredNavItems = navItems.filter(item => item.role.includes(user.role));

  return (
      <div className="min-h-screen font-sans text-slate-900 flex bg-slate-50">
        {/* Compact Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 p-3">
            <div className="flex-1 bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-200/50 border border-white/50 flex flex-col overflow-hidden">
                <div className="p-6">
                    <div className="flex items-center gap-2 mb-8">
                        <div className="bg-slate-900 text-white p-2 rounded-lg">
                            <LayoutGrid size={16} />
                        </div>
                        <h1 className="text-sm font-black text-slate-800 tracking-tight">পিটিটি ম্যানেজার</h1>
                    </div>

                    <div className="space-y-1">
                        {filteredNavItems.map(item => {
                            const Icon = item.icon;
                            const isActive = currentTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setCurrentTab(item.id as TabId)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-xs font-bold ${
                                        isActive 
                                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-300' 
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                    }`}
                                >
                                    <Icon size={16} strokeWidth={2} />
                                    {item.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className="mt-auto p-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 text-[10px] font-bold">
                            {user.email.substring(0,2)}
                        </div>
                        <div className="overflow-hidden min-w-0">
                            <p className="font-bold text-slate-800 text-xs truncate">{user.email.split('@')[0]}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">{user.role}</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="w-full py-2 border border-slate-200 rounded-lg text-slate-500 text-[10px] font-bold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all flex items-center justify-center gap-1.5">
                        <LogOut size={12} /> সাইন আউট
                    </button>
                </div>
            </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-screen">
            {/* Mobile Header */}
            <header className="lg:hidden sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200">
                <div className="px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="bg-slate-900 text-white p-1.5 rounded-lg">
                            <LayoutGrid size={16} />
                        </div>
                        <h1 className="text-sm font-black text-slate-800">পিটিটি ম্যানেজার</h1>
                    </div>
                    <button onClick={handleLogout} className="p-2 bg-slate-50 rounded-lg text-slate-400">
                        <LogOut size={16} />
                    </button>
                </div>
            </header>

            {/* Main Content with padding for bottom nav */}
            <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 pb-24 lg:pb-8">
                {renderContent()}
            </main>
        </div>

        <BottomNav currentTab={currentTab} setTab={setCurrentTab} user={user} />
      </div>
  );
};

export default App;