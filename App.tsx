
import React, { useState, useEffect } from 'react';
import { auth, db } from './services/firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { UserProfile, TabId, Tour } from './types';
import { LogOut, LayoutGrid, ShieldCheck, Sparkles, FolderPlus, BarChart3, UserCircle, Users, CheckSquare, Lock, Menu } from 'lucide-react';

// Components
import EntryTab from './components/EntryTab';
import AnalysisTab from './components/AnalysisTab';
import PersonalTab from './components/PersonalTab';
import ShareTourTab from './components/ShareTourTab';
import FinalTab from './components/FinalTab';
import BottomNav from './components/BottomNav';
import LoginScreen from './components/LoginScreen';
import AgencyDashboard from './components/AgencyDashboard';

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
                  setUser({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email || '',
                    ...userData
                  } as UserProfile);
                  setNoAccess(false);
              } else {
                  setNoAccess(true); // User exists but has no role
              }
            } else {
               setNoAccess(true); // User authenticated but no DB record
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

      // Filter tours based on role
      if (user.role === 'host') {
          // STRICT FILTER: Only show if created by host OR assigned explicitly
          fetchedTours = fetchedTours.filter(t => 
              (t.createdBy && t.createdBy === user.email) || 
              (t.assignedHostId && t.assignedHostId === user.uid)
          );
      } else if (user.role === 'agency') {
          // Agencies see tours if they are ALREADY a partner OR if the tour is UPCOMING (so they can book)
          const todayStr = getLocalDateString();
          fetchedTours = fetchedTours.filter(t => {
             const isPartner = t.partnerAgencies && t.partnerAgencies.some(a => a.email === user.email);
             // String comparison "YYYY-MM-DD" works correctly for dates
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
                <div className="w-16 h-16 relative">
                    <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-violet-600 rounded-full border-t-transparent animate-spin"></div>
                </div>
                <p className="mt-6 text-slate-500 font-bold text-xs uppercase tracking-[0.2em] animate-pulse">Initializing...</p>
            </div>
        </div>
    );
  }

  // Access Denied Screen
  if (noAccess) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
              <div className="glass-panel p-10 rounded-[2.5rem] max-w-sm w-full relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-400 to-rose-600"></div>
                  <div className="bg-rose-50 w-20 h-20 rounded-3xl rotate-3 flex items-center justify-center mx-auto mb-6 text-rose-500 shadow-lg shadow-rose-200">
                      <Lock size={32} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800 mb-2">Access Denied</h2>
                  <p className="text-slate-500 mb-8 font-medium text-sm leading-relaxed">Your account has been created but no specific role has been assigned yet. Please contact the administrator.</p>
                  <button onClick={() => signOut(auth)} className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-sm transition-all active:scale-[0.98]">Log Out</button>
              </div>
          </div>
      );
  }

  if (!user) {
    return <LoginScreen />;
  }

  // AGENCY DASHBOARD VIEW
  if (user.role === 'agency') {
      return (
          <div className="min-h-screen bg-slate-50 font-sans">
              <AgencyDashboard user={user} tours={tours} refreshTours={fetchTours} handleLogout={handleLogout} />
          </div>
      );
  }

  // NORMAL ADMIN/HOST VIEW
  const commonProps = {
      user,
      allUsers,
      tours,
      refreshTours: fetchTours
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'entry': return <EntryTab {...commonProps} />;
      case 'analysis': return <AnalysisTab {...commonProps} />;
      case 'personal': return <PersonalTab {...commonProps} />;
      case 'share': return <ShareTourTab {...commonProps} />;
      case 'final': return <FinalTab {...commonProps} />;
      default: return <EntryTab {...commonProps} />;
    }
  };

  const navItems = [
    { id: 'entry', label: 'Tours & Events', icon: FolderPlus, adminOnly: false },
    { id: 'analysis', label: 'Analysis', icon: BarChart3, adminOnly: true },
    { id: 'personal', label: 'My Bookings', icon: UserCircle, adminOnly: false },
    { id: 'share', label: 'Partners', icon: Users, adminOnly: true },
    { id: 'final', label: 'Final Report', icon: CheckSquare, adminOnly: true },
  ];
  
  const filteredNavItems = navItems.filter(item => 
    !item.adminOnly || user?.role === 'admin'
  );

  return (
      <div className="min-h-screen font-sans text-slate-900 flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-72 h-screen sticky top-0 p-4">
            <div className="flex-1 bg-white/80 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-white/50 flex flex-col overflow-hidden">
                <div className="p-8">
                    <div className="flex items-center gap-3 mb-10">
                        <div className="w-10 h-10 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30 text-white">
                            <LayoutGrid size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-800 leading-none tracking-tight">PTT<span className="text-violet-600">.</span></h1>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Manager</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {filteredNavItems.map(item => {
                            const Icon = item.icon;
                            const isActive = currentTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setCurrentTab(item.id as TabId)}
                                    className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-300 font-bold text-sm relative group overflow-hidden ${
                                        isActive 
                                        ? 'text-white shadow-xl shadow-violet-500/20' 
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                    }`}
                                >
                                    {isActive && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600"></div>
                                    )}
                                    <span className="relative z-10 flex items-center gap-3">
                                        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'animate-pulse' : ''} />
                                        {item.label}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className="mt-auto p-6 bg-slate-50/50 border-t border-slate-100">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400 font-bold text-xs uppercase">
                            {user.email.substring(0,2)}
                        </div>
                        <div className="overflow-hidden">
                            <p className="font-bold text-slate-800 text-sm truncate">{user.email.split('@')[0]}</p>
                            <div className="flex items-center gap-1">
                                {user.role === 'admin' ? <ShieldCheck size={10} className="text-violet-600"/> : <Sparkles size={10} className="text-emerald-600"/>}
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{user.role}</p>
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={handleLogout}
                        className="w-full py-3 border border-slate-200 rounded-xl text-slate-500 text-xs font-bold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all flex items-center justify-center gap-2"
                    >
                        <LogOut size={14} /> Sign Out
                    </button>
                </div>
            </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-screen">
            {/* Mobile Header */}
            <header className="lg:hidden sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/50">
                <div className="px-5 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-tr from-slate-900 to-slate-800 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-300">
                            <LayoutGrid size={18} />
                        </div>
                        <h1 className="text-lg font-black text-slate-800 tracking-tight">PTT Manager</h1>
                    </div>
                    <button 
                        onClick={handleLogout}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            {/* Desktop Header Content (Contextual) */}
            <header className="hidden lg:flex px-10 py-8 justify-between items-end">
                 <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-1 animate-slide-up">
                        {filteredNavItems.find(i => i.id === currentTab)?.label}
                    </h2>
                    <p className="text-slate-400 font-medium text-sm animate-fade-in delay-100">
                        Manage your travel agency operations seamlessly.
                    </p>
                 </div>
                 <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live System
                 </div>
            </header>

            {/* Main Scrollable Content */}
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 lg:px-10 pb-24 lg:pb-10">
                {renderContent()}
            </main>
        </div>

        {/* Bottom Navigation (Mobile Only) */}
        <BottomNav currentTab={currentTab} setTab={setCurrentTab} user={user} />
      </div>
  );
};

export default App;
