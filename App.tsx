
import React, { useState, useEffect } from 'react';
import { auth, db } from './services/firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { UserProfile, TabId, Tour } from './types';
import { LogOut, LayoutGrid, ShieldCheck, Sparkles, FolderPlus, BarChart3, UserCircle, Users, CheckSquare, Lock } from 'lucide-react';

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
                <div className="w-16 h-16 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mb-6"></div>
                <p className="text-violet-600 font-bold text-xs uppercase tracking-[0.2em] animate-pulse">লোড হচ্ছে...</p>
            </div>
        </div>
    );
  }

  // Access Denied Screen
  if (noAccess) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
              <div className="max-w-sm w-full bg-white p-8 rounded-[2rem] shadow-xl border border-rose-100">
                  <div className="bg-rose-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-500">
                      <Lock size={32} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800 mb-2">Access Denied</h2>
                  <p className="text-slate-500 mb-8 font-medium">আপনার প্রোফাইলে কোনো রোল (Role) সেট করা হয়নি। দয়া করে এডমিনের সাথে যোগাযোগ করুন।</p>
                  <button onClick={() => signOut(auth)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm">লগ আউট</button>
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
    { id: 'entry', label: 'এন্ট্রি', icon: FolderPlus, adminOnly: false },
    { id: 'analysis', label: 'এনালাইসিস', icon: BarChart3, adminOnly: true },
    { id: 'personal', label: 'পার্সোনাল', icon: UserCircle, adminOnly: false },
    { id: 'share', label: 'শেয়ার', icon: Users, adminOnly: true },
    { id: 'final', label: 'ফাইনাল', icon: CheckSquare, adminOnly: true },
  ];
  
  const filteredNavItems = navItems.filter(item => 
    !item.adminOnly || user?.role === 'admin'
  );

  return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 h-screen sticky top-0">
             <div className="p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-2 rounded-xl shadow-lg shadow-slate-300">
                        <LayoutGrid size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 leading-none tracking-tight">
                            পিটিটি <span className="text-slate-400 font-medium text-sm block">ম্যানেজার</span>
                        </h1>
                    </div>
                </div>
             </div>
             
             <div className="flex-1 py-6 px-4 space-y-1">
                 {filteredNavItems.map(item => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setCurrentTab(item.id as TabId)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold text-sm ${isActive ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Icon size={18} strokeWidth={2.5} />
                            {item.label}
                        </button>
                    )
                 })}
             </div>

             <div className="p-4 border-t border-slate-100">
                 <div className="bg-slate-50 rounded-xl p-4 mb-3">
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Logged in as</p>
                     <p className="font-bold text-slate-800 truncate">{user.email}</p>
                     <div className="flex items-center gap-1 mt-1">
                        {user.role === 'admin' ? <ShieldCheck size={12} className="text-violet-600"/> : <Sparkles size={12} className="text-emerald-600"/>}
                        <span className={`text-[10px] font-bold uppercase ${user.role === 'admin' ? 'text-violet-600' : 'text-emerald-600'}`}>{user.role}</span>
                     </div>
                 </div>
                 <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all duration-200 font-bold text-sm border border-transparent hover:border-rose-100"
                 >
                  <LogOut size={18} /> লগ আউট
                 </button>
             </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
            {/* Mobile Header */}
            <header className="lg:hidden sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all safe-area-pt">
            <div className="max-w-md mx-auto px-5 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-2 rounded-xl shadow-lg shadow-slate-300">
                    <LayoutGrid size={20} />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-800 leading-none tracking-tight flex items-center gap-1">
                            পিটিটি <span className="text-slate-400 font-medium">ম্যানেজার</span>
                        </h1>
                        <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest mt-1 flex items-center gap-1">
                        {user.role === 'admin' ? <ShieldCheck size={10}/> : <Sparkles size={10}/>}
                        {user.role === 'admin' ? 'এডমিন' : 'হোস্ট'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                    onClick={handleLogout}
                    className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-200 border border-transparent hover:border-rose-100"
                    title="লগ আউট"
                    >
                    <LogOut size={20} strokeWidth={2} />
                    </button>
                </div>
            </div>
            </header>

            {/* Desktop Header */}
            <header className="hidden lg:flex bg-white/50 backdrop-blur-sm border-b border-slate-200 px-8 py-4 justify-between items-center sticky top-0 z-30">
                 <h2 className="text-xl font-black text-slate-800 tracking-tight">{filteredNavItems.find(i => i.id === currentTab)?.label}</h2>
            </header>

            {/* Main Scrollable Content */}
            <main className="flex-1 overflow-y-auto relative w-full">
                <div className="w-full h-full p-0 lg:p-6">
                    <div className="absolute top-20 -left-20 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>
                    <div className="absolute bottom-20 -right-20 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>
                    {renderContent()}
                </div>
            </main>
        </div>

        {/* Bottom Navigation (Mobile Only) */}
        <BottomNav currentTab={currentTab} setTab={setCurrentTab} user={user} />
      </div>
  );
};

export default App;
