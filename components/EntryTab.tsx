

import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { Tour, CommonTabProps, BusConfig, DailyExpense } from '../types';
import { Plus, Edit2, Calendar, DollarSign, Bus, Check, Settings, MapPin, Save, ArrowLeft, Trash2, Clock, Utensils, UserPlus, User, Key, Loader, AlertTriangle, MoreHorizontal, Building, Coffee } from 'lucide-react';
import { calculateBusFare } from '../utils/calculations';

// UI Helpers - Updated for modern look
const Card = ({ children, className = "" }: { children?: React.ReactNode, className?: string }) => (
  <div className={`bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-white/60 ${className}`}>
      {children}
  </div>
);

const SectionHeader = ({ icon: Icon, title, color = "text-slate-800" }: any) => (
    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
        <div className={`p-3 rounded-2xl ${color.replace('text-', 'bg-').replace('700', '50').replace('800', '50')} ${color} shadow-sm ring-4 ring-white`}>
          <Icon size={20} />
        </div>
        <h3 className={`text-sm font-bold uppercase tracking-widest ${color}`}>{title}</h3>
    </div>
);

const InputGroup = ({ label, children }: any) => (
    <div className="space-y-2.5">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1">
            {label}
        </label>
        {children}
    </div>
);

const StyledInput = (props: any) => (
    <input 
      {...props}
      className={`w-full px-5 py-4 bg-slate-50/80 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all placeholder:text-slate-300 shadow-sm ${props.className || ''}`} 
    />
);

const EntryTab: React.FC<CommonTabProps> = ({ user, allUsers, tours, refreshTours }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [useManualHostId, setUseManualHostId] = useState(false);
  const [activeTour, setActiveTour] = useState<Tour | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const availableHosts = allUsers ? allUsers.filter(u => u.email && u.email.includes('@')) : [];

  const initialTourData: Partial<Tour> = {
    name: '',
    date: '',
    duration: 1,
    assignedHostId: '',
    fees: { regular: 1200, disc1: 1100, disc2: 1000 },
    busConfig: {
      totalRent: 0,
      totalSeats: 40,
      regularSeats: 30,
      discount1Seats: 5,
      discount1Amount: 200,
      discount2Seats: 5,
      discount2Amount: 300
    },
    costs: {
      perHead: 1000,
      hostFee: 0,
      hotelCost: 0,
      dailyExpenses: []
    }
  };

  const [tourData, setTourData] = useState<Partial<Tour>>(initialTourData);

  useEffect(() => {
      if (!isCreating) return;
      const currentDuration = parseInt(String(tourData.duration)) || 1;
      setTourData(prev => {
          const currentExpenses = prev.costs?.dailyExpenses || [];
          let newExpenses: DailyExpense[] = [];
          for (let i = 0; i < currentDuration; i++) {
              newExpenses.push(currentExpenses[i] || { day: i + 1, breakfast: 0, lunch: 0, dinner: 0, transport: 0, other: 0 });
          }
          return { ...prev, costs: { ...prev.costs!, dailyExpenses: newExpenses } };
      });
  }, [tourData.duration, isCreating]);

  const sanitizeData = (data: any, forUpdate = false) => {
    const clean = JSON.parse(JSON.stringify(data));
    delete clean.id;
    delete clean.createdAt;
    delete clean.updatedAt;
    
    if (forUpdate) {
        delete clean.partnerAgencies;
        delete clean.createdBy; 
    }
    
    return clean;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const cleanData = sanitizeData(tourData, false);
      const newTour = {
        ...cleanData,
        partnerAgencies: [], 
        createdBy: user.email,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      await addDoc(collection(db, 'tours'), newTour);
      await refreshTours();
      setIsCreating(false);
      setActiveTour(null);
      setTourData(initialTourData);
    } catch (error) {
      console.error("Error creating tour:", error);
      alert("Error creating tour. Check internet.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (isSubmitting) return;

      const targetId = activeTour?.id || tourData.id;

      if (!targetId) {
          alert("Error: Tour ID not found. Cannot update.");
          return;
      }

      setIsSubmitting(true);
      try {
          const tourRef = doc(db, 'tours', targetId);
          // If User is Host, only update daily expenses
          let updateData;
          if (user.role === 'host') {
             updateData = {
                 'costs.dailyExpenses': tourData.costs?.dailyExpenses,
                 updatedAt: Timestamp.now()
             };
          } else {
             const cleanData = sanitizeData(tourData, true);
             updateData = { ...cleanData, updatedAt: Timestamp.now() };
          }
          
          await updateDoc(tourRef, updateData);
          await refreshTours();
          
          setIsCreating(false);
          setActiveTour(null);
          setTourData(initialTourData);
      } catch (err: any) {
          console.error("Error updating", err);
          alert("Update failed: " + err.message);
      } finally {
        setIsSubmitting(false);
      }
  };

  const handleDelete = async (e: React.MouseEvent | undefined, tourId: string) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
      }
      
      if (!tourId) return;

      if (user.role !== 'admin') {
          alert("Only Admin can delete tours.");
          return;
      }
      
      if (!window.confirm('Are you sure you want to delete this tour? This cannot be undone.')) return;
      
      try {
          await deleteDoc(doc(db, 'tours', tourId));
          await refreshTours();
          if (activeTour?.id === tourId) {
              setActiveTour(null);
              setIsCreating(false);
              setTourData(initialTourData);
          }
      } catch (err) {
          console.error("Error deleting", err);
          alert("Delete failed.");
      }
  };

  const busFarePreview = tourData.busConfig ? calculateBusFare(tourData.busConfig as BusConfig) : null;

  const resetForm = () => {
    setTourData(initialTourData);
    setUseManualHostId(false);
    setActiveTour(null);
  };

  const safeNumInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value);
      return isNaN(val) ? 0 : val;
  };

  const handleDailyExpenseChange = (index: number, field: keyof DailyExpense, value: number) => {
      setTourData(prev => {
          const newExpenses = [...(prev.costs?.dailyExpenses || [])];
          if(newExpenses[index]) {
              newExpenses[index] = { ...newExpenses[index], [field]: value };
          }
          return { ...prev, costs: { ...prev.costs!, dailyExpenses: newExpenses } };
      });
  };

  const getHostEmailById = (uid?: string) => {
      if (!uid) return null;
      const host = allUsers.find(h => h.uid === uid);
      return host ? host.email : uid.substring(0, 8) + '...';
  };

  const isAdmin = user.role === 'admin';

  return (
    <div className="animate-fade-in">
      {!isCreating ? (
        <>
          <div className="flex justify-between items-center mb-8">
            <div className="hidden lg:block">
                 {/* Desktop header is handled in App.tsx */}
            </div>
            <div className="lg:hidden">
                <h2 className="text-xl font-black text-slate-800 tracking-tight">ট্যুর এবং ইভেন্ট</h2>
            </div>
            {isAdmin && (
              <button 
                type="button"
                onClick={() => { resetForm(); setIsCreating(true); }}
                className="bg-slate-900 text-white pl-4 pr-5 py-3.5 rounded-2xl flex items-center shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 text-xs font-bold uppercase tracking-widest group border border-slate-900"
              >
                <Plus size={16} className="mr-2 group-hover:rotate-90 transition-transform duration-300" /> নতুন তৈরি করুন
              </button>
            )}
          </div>

          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {tours.map((tour, index) => {
              const assignedHostEmail = tour.assignedHostId ? getHostEmailById(tour.assignedHostId) : null;
              const gradients = [
                  "from-violet-500 to-indigo-500",
                  "from-emerald-400 to-teal-500",
                  "from-orange-400 to-rose-500",
                  "from-blue-400 to-cyan-500"
              ];
              const gradientClass = gradients[index % gradients.length];

              return (
                <div 
                  key={tour.id}
                  className="group relative bg-white rounded-[2.5rem] shadow-lg shadow-slate-100/50 hover:shadow-2xl hover:shadow-slate-200 hover:-translate-y-1 transition-all duration-300 border border-slate-100 overflow-hidden flex flex-col"
                >
                    {/* Header Image/Gradient */}
                    <div className={`h-40 bg-gradient-to-r ${gradientClass} relative p-7`}>
                         <div className="absolute top-0 right-0 p-8 opacity-20 text-white transform rotate-12 group-hover:scale-110 transition-transform duration-500">
                            <Bus size={120} />
                         </div>
                         <div className="relative z-10 flex flex-col h-full justify-between">
                             <div className="flex justify-between items-start">
                                <span className="bg-white/20 backdrop-blur-md border border-white/20 text-white px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm">
                                    {tour.date}
                                </span>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            setActiveTour(tour); 
                                            setTourData(tour); 
                                            setIsCreating(true); 
                                        }}
                                        className="p-2.5 bg-white/20 hover:bg-white text-white hover:text-slate-900 rounded-xl backdrop-blur-md transition-all shadow-sm"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    {isAdmin && (
                                        <button 
                                            onClick={(e) => handleDelete(e, tour.id)}
                                            className="p-2.5 bg-white/20 hover:bg-rose-500 text-white rounded-xl backdrop-blur-md transition-all shadow-sm"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                             </div>
                             <h3 className="text-white font-black text-2xl tracking-tight leading-tight line-clamp-2 drop-shadow-md pr-10">
                                {tour.name}
                             </h3>
                         </div>
                    </div>

                  {/* Body */}
                  <div 
                    className="p-7 flex-1 cursor-pointer flex flex-col gap-5"
                    onClick={() => { setActiveTour(tour); setTourData(tour); setIsCreating(true); }}
                  >
                      <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                          <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/50">
                              <Clock size={16} className="text-slate-400" /> {tour.duration} দিন
                          </span>
                          {assignedHostEmail && (
                              <span className="flex items-center gap-1.5 bg-violet-50 text-violet-600 px-3 py-2 rounded-xl border border-violet-100">
                                  <User size={16} /> {assignedHostEmail.split('@')[0]}
                              </span>
                          )}
                      </div>

                      {isAdmin && (
                        <div className="mt-auto grid grid-cols-2 gap-3 pt-2">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center group-hover:bg-slate-100 transition-colors">
                                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-1">বাস ভাড়া</p>
                                <p className="font-black text-slate-700 text-lg">৳{Number(tour.busConfig?.totalRent || 0).toLocaleString()}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center group-hover:bg-slate-100 transition-colors">
                                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-1">হোটেল খরচ</p>
                                <p className="font-black text-slate-700 text-lg">৳{Number(tour.costs?.hotelCost || 0).toLocaleString()}</p>
                            </div>
                        </div>
                      )}
                      {!isAdmin && (
                         <div className="mt-auto pt-2">
                             <div className="bg-violet-50 p-4 rounded-2xl border border-violet-100 text-center">
                                 <p className="text-[10px] text-violet-600 uppercase font-bold tracking-wider">হোস্ট প্যানেল</p>
                             </div>
                         </div>
                      )}
                  </div>
                </div>
              );
            })}
            
            {tours.length === 0 && (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-slate-50/30">
                    <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mb-6">
                        <Bus size={40} className="opacity-40" />
                    </div>
                    <p className="font-bold text-lg text-slate-500">কোন ট্যুর পাওয়া যায়নি</p>
                    <p className="text-xs mt-1 font-medium text-slate-400">শুরু করতে উপরে "নতুন তৈরি করুন" বাটনে ক্লিক করুন।</p>
                </div>
            )}
          </div>
        </>
      ) : (
        <div className="animate-fade-in max-w-5xl mx-auto pb-10">
          <div className="flex justify-between items-center bg-white/80 backdrop-blur-xl p-3 rounded-3xl shadow-glass border border-white/50 sticky top-4 z-40 mb-8 max-w-min mx-auto md:mx-0 md:w-full md:max-w-none md:p-4 transition-all">
            <div className="flex items-center gap-5">
                <button type="button" onClick={() => { setIsCreating(false); setActiveTour(null); }} className="w-12 h-12 flex items-center justify-center bg-white rounded-2xl text-slate-600 hover:bg-slate-50 hover:shadow-md transition-all border border-slate-200 shadow-sm">
                    <ArrowLeft size={20}/>
                </button>
                <div className="hidden md:block">
                    <h2 className="font-bold text-slate-800 text-xl tracking-tight">
                        {activeTour?.id || tourData.id ? 'ট্যুর আপডেট' : 'নতুন ট্যুর ইভেন্ট'}
                    </h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wide mt-1">
                        {isAdmin ? 'নিচের তথ্যগুলো পূরণ করুন' : 'শুধুমাত্র খরচ আপডেট করুন'}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button 
                    type="submit" 
                    form="tour-form"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-slate-200 text-xs uppercase tracking-widest hover:bg-slate-800 hover:scale-105 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:scale-100"
                >
                    {isSubmitting ? <Loader size={18} className="animate-spin"/> : <Save size={18} />}
                    {isSubmitting ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
                </button>
            </div>
          </div>
          
          <form id="tour-form" onSubmit={activeTour?.id || tourData.id ? handleUpdate : handleSubmit} className="space-y-8">
            <div className={`grid gap-8 ${isAdmin ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                {/* LEFT COLUMN - Hidden for Host */}
                {isAdmin && (
                <div className="space-y-8">
                    <Card className="p-8">
                        <SectionHeader icon={MapPin} title="প্রাথমিক তথ্য" color="text-violet-700" />
                        <div className="space-y-6">
                            <InputGroup label="ট্যুর এর নাম">
                                <StyledInput required placeholder="যেমন: কক্সবাজার ভ্রমণ" value={tourData.name} onChange={(e: any) => setTourData({...tourData, name: e.target.value})} />
                            </InputGroup>
                            
                            <div className="p-6 bg-violet-50/50 rounded-3xl border border-violet-100/50">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1">
                                        <UserPlus size={12} /> অ্যাসাইন করা হোস্ট
                                    </label>
                                    <button type="button" onClick={() => setUseManualHostId(!useManualHostId)} className="text-[9px] text-violet-600 font-bold hover:underline bg-white px-3 py-1.5 rounded-lg shadow-sm border border-violet-100 transition-all hover:bg-violet-50">
                                        {useManualHostId ? 'লিস্ট থেকে বাছাই করুন' : 'আইডি লিখুন'}
                                    </button>
                                </div>
                                
                                {useManualHostId ? (
                                    <StyledInput placeholder="হোস্টের UID পেস্ট করুন..." value={tourData.assignedHostId || ''} onChange={(e: any) => setTourData({...tourData, assignedHostId: e.target.value})} className="font-mono text-xs"/>
                                ) : (
                                    <div className="relative">
                                        <select 
                                            value={tourData.assignedHostId || ''} 
                                            onChange={e => setTourData({...tourData, assignedHostId: e.target.value})}
                                            className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 appearance-none cursor-pointer transition-all shadow-sm"
                                        >
                                            <option value="">-- হোস্ট নির্বাচন করুন --</option>
                                            {availableHosts.map(host => (
                                                <option key={host.uid} value={host.uid}>
                                                    {host.email} ({host.role})
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <Settings size={18} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-5">
                                <InputGroup label="শুরুর তারিখ">
                                    <StyledInput required type="date" value={tourData.date} onChange={(e: any) => setTourData({...tourData, date: e.target.value})} />
                                </InputGroup>
                                <InputGroup label="সময়কাল (দিন)">
                                    <StyledInput required type="number" min="1" value={tourData.duration} onChange={(e: any) => setTourData({...tourData, duration: Math.max(1, safeNumInput(e))})} />
                                </InputGroup>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-8">
                        <SectionHeader icon={DollarSign} title="আয় কনফিগারেশন (প্রতি সিট)" color="text-emerald-700" />
                        
                        <div className="grid grid-cols-3 gap-5">
                            <div className="space-y-2">
                                <InputGroup label="রেগুলার">
                                    <StyledInput type="number" className="text-center font-black text-emerald-700 bg-emerald-50/50 border-emerald-100 focus:border-emerald-500 focus:ring-emerald-200" value={tourData.fees?.regular} onChange={(e: any) => setTourData({...tourData, fees: {...tourData.fees!, regular: safeNumInput(e)}})} />
                                </InputGroup>
                            </div>
                            <InputGroup label="ডিসকাউন্ট ১">
                                <StyledInput type="number" className="text-center font-bold text-amber-600 bg-amber-50/50 border-amber-100 focus:border-amber-500 focus:ring-amber-200" value={tourData.fees?.disc1} onChange={(e: any) => setTourData({...tourData, fees: {...tourData.fees!, disc1: safeNumInput(e)}})} />
                            </InputGroup>
                            <InputGroup label="ডিসকাউন্ট ২">
                                <StyledInput type="number" className="text-center font-bold text-orange-600 bg-orange-50/50 border-orange-100 focus:border-orange-500 focus:ring-orange-200" value={tourData.fees?.disc2} onChange={(e: any) => setTourData({...tourData, fees: {...tourData.fees!, disc2: safeNumInput(e)}})} />
                            </InputGroup>
                        </div>
                    </Card>
                </div>
                )}

                {/* RIGHT COLUMN */}
                <div className="space-y-8">
                    {isAdmin && (
                    <Card className="p-8">
                        <SectionHeader icon={Building} title="ফিক্সড খরচ (বাস ও হোটেল)" color="text-rose-700" />
                        
                        <div className="grid grid-cols-2 gap-6 mb-8">
                            <InputGroup label="মোট বাস ভাড়া">
                                <StyledInput type="number" className="font-black text-rose-600 bg-rose-50/30 border-rose-100 focus:border-rose-500 focus:ring-rose-200" value={tourData.busConfig?.totalRent} onChange={(e: any) => setTourData({...tourData, busConfig: {...tourData.busConfig!, totalRent: safeNumInput(e)}})} />
                            </InputGroup>
                            <InputGroup label="মোট হোটেল ভাড়া">
                                <StyledInput type="number" className="font-black text-rose-600 bg-rose-50/30 border-rose-100 focus:border-rose-500 focus:ring-rose-200" value={tourData.costs?.hotelCost} onChange={(e: any) => setTourData({...tourData, costs: {...tourData.costs!, hotelCost: safeNumInput(e)}})} />
                            </InputGroup>
                            <div className="col-span-2">
                                <InputGroup label="হোস্ট ফি (স্যালারি)">
                                    <StyledInput type="number" className="font-bold text-slate-700" value={tourData.costs?.hostFee} onChange={(e: any) => setTourData({...tourData, costs: {...tourData.costs!, hostFee: safeNumInput(e)}})} />
                                </InputGroup>
                            </div>
                        </div>
                        
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                            <div className="flex items-center justify-between mb-5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                    <Settings size={14}/> সিট বণ্টন ও লস ক্যালকুলেশন
                                </label>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="w-28 shrink-0">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">রেগুলার সিট</label>
                                        <input type="number" value={tourData.busConfig?.regularSeats} onChange={e => setTourData({...tourData, busConfig: {...tourData.busConfig!, regularSeats: safeNumInput(e)}})} 
                                        className="w-full p-3 border border-slate-200 rounded-xl text-lg text-center font-black outline-none focus:ring-4 focus:ring-violet-100 transition-all" />
                                    </div>
                                    <div className="flex-1 text-[11px] text-slate-400 font-medium leading-relaxed border-l border-slate-100 pl-4">
                                        এই সিটগুলোর বাড়তি ভাড়া ডিসকাউন্ট সিটের লস কাভার করবে।
                                    </div>
                                </div>
                                
                                {['discount1', 'discount2'].map((type, idx) => {
                                    const keySeats = `${type}Seats` as keyof BusConfig;
                                    const keyAmount = `${type}Amount` as keyof BusConfig;
                                    return (
                                        <div key={type} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                            <div className="w-28 shrink-0">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">ডিস {idx+1} সিট</label>
                                                <input type="number" value={tourData.busConfig?.[keySeats] as number} onChange={e => setTourData({...tourData, busConfig: {...tourData.busConfig!, [keySeats]: safeNumInput(e)}})} 
                                                className="w-full p-3 border border-slate-200 rounded-xl text-sm text-center font-bold outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">জনপ্রতি ছাড়</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-rose-400 font-bold">-৳</span>
                                                    <input type="number" value={tourData.busConfig?.[keyAmount] as number} onChange={e => setTourData({...tourData, busConfig: {...tourData.busConfig!, [keyAmount]: safeNumInput(e)}})} 
                                                    className="w-full p-3 pl-9 border border-slate-200 rounded-xl text-sm font-bold text-rose-500 outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-100" />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        
                        {busFarePreview && (
                            <div className="mt-8 p-6 bg-slate-800 rounded-3xl shadow-xl text-white relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                                <div className="absolute -top-4 -right-4 p-4 opacity-10 text-white transform rotate-12 group-hover:rotate-45 transition-transform duration-500">
                                    <DollarSign size={100} />
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 mb-6 uppercase tracking-[0.2em]">অটো-ক্যালকুলেটেড বেস ফেয়ার</p>
                                <div className="grid grid-cols-3 gap-4 relative z-10 divide-x divide-slate-700">
                                    <div className="text-center px-2">
                                        <span className="block text-slate-400 text-[9px] mb-2 font-bold uppercase tracking-wider">বেস</span>
                                        <span className="font-mono font-bold text-white text-xl">৳{busFarePreview.baseFare}</span>
                                    </div>
                                    <div className="text-center px-2">
                                        <span className="block text-violet-400 font-bold text-[9px] mb-2 uppercase tracking-wider">রেগুলার</span>
                                        <span className="font-mono font-black text-white text-3xl drop-shadow-lg">৳{busFarePreview.regularFare}</span>
                                    </div>
                                    <div className="text-center px-2">
                                        <span className="block text-slate-400 text-[9px] mb-2 font-bold uppercase tracking-wider">D1</span>
                                        <span className="font-mono font-bold text-slate-300 text-xl">৳{busFarePreview.discount1Fare}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                    )}

                    <Card className="p-8">
                        <SectionHeader icon={Utensils} title={isAdmin ? "দৈনিক খরচ ও অন্যান্য" : "দৈনিক খরচ আপডেট করুন"} color="text-orange-700" />
                        <div className="space-y-4">
                            {tourData.costs?.dailyExpenses?.map((day, index) => (
                                <div key={index} className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100 hover:bg-white hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 group">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="w-6 h-6 rounded-full bg-slate-200 group-hover:bg-slate-900 group-hover:text-white transition-colors flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm">{day.day}</span>
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors">দিন {day.day} খরচ</h4>
                                    </div>
                                    <div className="grid grid-cols-5 gap-3">
                                        {[
                                            { key: 'breakfast', label: 'নাস্তা' },
                                            { key: 'lunch', label: 'দুপুর' },
                                            { key: 'dinner', label: 'রাত' },
                                            { key: 'transport', label: 'গাড়ি' },
                                            { key: 'other', label: 'অন্যান্য' }
                                        ].map((item) => (
                                            <div key={item.key} className="space-y-1.5">
                                                <label className="text-[8px] font-bold text-slate-400 uppercase text-center block truncate">{item.label}</label>
                                                <input type="number" value={(day as any)[item.key]} onChange={e => handleDailyExpenseChange(index, item.key as keyof DailyExpense, safeNumInput(e))}
                                                className={`w-full p-2.5 border border-slate-200 rounded-xl text-xs text-center font-bold outline-none focus:bg-white transition-all bg-white/50 shadow-sm ${item.key === 'other' ? 'focus:border-violet-400 focus:ring-2 focus:ring-violet-100' : 'focus:border-orange-400 focus:ring-2 focus:ring-orange-100'}`} placeholder="0"/>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default EntryTab;
