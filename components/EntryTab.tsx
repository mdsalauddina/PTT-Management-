

import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { Tour, CommonTabProps, BusConfig, DailyExpense } from '../types';
import { Plus, Edit2, DollarSign, Bus, Settings, MapPin, Save, ArrowLeft, Trash2, Clock, Utensils, UserPlus, User, Loader, Building, ChevronDown, PlusCircle, AlertTriangle } from 'lucide-react';
import { calculateBusFare } from '../utils/calculations';

// UI Helpers - Compact & Refined
const Card = ({ children, className = "" }: { children?: React.ReactNode, className?: string }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${className}`}>
      {children}
  </div>
);

const SectionHeader = ({ icon: Icon, title, color = "text-slate-800" }: any) => (
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-50">
        <div className={`p-1.5 rounded-lg ${color.replace('text-', 'bg-').replace('700', '50').replace('800', '50')} ${color}`}>
          <Icon size={14} />
        </div>
        <h3 className={`text-[10px] font-bold uppercase tracking-widest ${color}`}>{title}</h3>
    </div>
);

const InputGroup = ({ label, children }: any) => (
    <div className="space-y-1">
        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1 truncate">
            {label}
        </label>
        {children}
    </div>
);

const StyledInput = (props: any) => (
    <input 
      {...props}
      className={`w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all placeholder:text-slate-300 shadow-sm min-w-0 ${props.className || ''}`} 
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
    penaltyAmount: 500, // Default penalty
    fees: { regular: 1200, disc1: 1100, disc2: 1000 },
    busConfig: {
      totalRent: 0,
      totalSeats: 40,
      regularSeats: 40, // Default to all regular
      discount1Seats: 0,
      discount1Amount: 200,
      discount2Seats: 0,
      discount2Amount: 300
    },
    costs: {
      perHead: 1000,
      hostFee: 0,
      hotelCost: 0,
      otherFixedCosts: [],
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
              const existing = currentExpenses[i];
              // Ensure all fields exist properly to prevent uncontrolled inputs
              newExpenses.push({
                  day: i + 1,
                  breakfast: existing?.breakfast || 0,
                  lunch: existing?.lunch || 0,
                  dinner: existing?.dinner || 0,
                  transport: existing?.transport || 0,
                  other: existing?.other || 0
              });
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
          let updateData;
          if (user.role === 'host') {
             // Host can update Daily Expenses AND Extra Fixed Costs
             // IMPORTANT: Fallback to [] if undefined to prevent Firestore error
             updateData = {
                 'costs.dailyExpenses': tourData.costs?.dailyExpenses || [],
                 'costs.otherFixedCosts': tourData.costs?.otherFixedCosts || [],
                 updatedAt: Timestamp.now()
             };
          } else {
             const cleanData = sanitizeData(tourData, true);
             // Ensure bus seats are preserved if not explicitly editable
             // But here we are editing totalRent/totalSeats/amounts
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
      }
      
      if (!tourId) return;
      if (user.role !== 'admin') {
          alert("Only Admin can delete tours.");
          return;
      }
      if (!window.confirm('Are you sure you want to delete this tour?')) return;
      
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

  const addOtherFixedCost = () => {
      setTourData(prev => ({
          ...prev,
          costs: {
              ...prev.costs!,
              otherFixedCosts: [...(prev.costs?.otherFixedCosts || []), { id: Date.now().toString(), name: '', amount: 0 }]
          }
      }));
  };

  const updateOtherFixedCost = (id: string, field: string, value: any) => {
      setTourData(prev => ({
          ...prev,
          costs: {
              ...prev.costs!,
              otherFixedCosts: prev.costs?.otherFixedCosts?.map(item => 
                  item.id === id ? { ...item, [field]: value } : item
              ) || []
          }
      }));
  };

  const deleteOtherFixedCost = (id: string) => {
      setTourData(prev => ({
          ...prev,
          costs: {
              ...prev.costs!,
              otherFixedCosts: prev.costs?.otherFixedCosts?.filter(item => item.id !== id) || []
          }
      }));
  };

  const getHostEmailById = (uid?: string) => {
      if (!uid) return null;
      const host = allUsers.find(h => h.uid === uid);
      return host ? host.email : uid.substring(0, 8) + '...';
  };

  const isAdmin = user.role === 'admin';
  // Allow host to see Right Column for expense input
  const isHost = user.role === 'host'; 

  return (
    <div className="animate-fade-in font-sans text-slate-800">
      {!isCreating ? (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-black text-slate-800 tracking-tight lg:hidden">ট্যুর ইভেন্ট</h2>
            {isAdmin && (
              <button 
                type="button"
                onClick={() => { resetForm(); setIsCreating(true); }}
                className="bg-slate-900 text-white px-3 py-2 rounded-xl flex items-center shadow-md hover:bg-slate-800 transition-all active:scale-95 text-[10px] font-bold uppercase tracking-widest group border border-slate-900 ml-auto"
              >
                <Plus size={14} className="mr-1.5 group-hover:rotate-90 transition-transform duration-300" /> নতুন তৈরি
              </button>
            )}
          </div>

          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {tours.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">
                    <p className="text-xs font-bold">কোন ট্যুর পাওয়া যায়নি</p>
                </div>
            ) : tours.map((tour, index) => {
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
                  className="group relative bg-white rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 overflow-hidden flex flex-col"
                >
                    <div className={`h-24 bg-gradient-to-r ${gradientClass} relative p-4`}>
                         <div className="absolute top-0 right-0 p-4 opacity-20 text-white transform rotate-12">
                            <Bus size={60} />
                         </div>
                         <div className="relative z-10 flex flex-col h-full justify-between">
                             <div className="flex justify-between items-start">
                                <span className="bg-white/20 backdrop-blur-md border border-white/20 text-white px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm">
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
                                        className="p-1.5 bg-white/20 hover:bg-white text-white hover:text-slate-900 rounded-lg backdrop-blur-md transition-all"
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                    {isAdmin && (
                                        <button 
                                            onClick={(e) => handleDelete(e, tour.id)}
                                            className="p-1.5 bg-white/20 hover:bg-rose-500 text-white rounded-lg backdrop-blur-md transition-all"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                </div>
                             </div>
                             <h3 className="text-white font-black text-lg tracking-tight leading-tight line-clamp-1 pr-8 truncate">
                                {tour.name}
                             </h3>
                         </div>
                    </div>

                  <div 
                    className="p-4 flex-1 cursor-pointer flex flex-col gap-3"
                    onClick={() => { setActiveTour(tour); setTourData(tour); setIsCreating(true); }}
                  >
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-500">
                          <span className="flex items-center gap-1 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                              <Clock size={10} className="text-slate-400" /> {tour.duration} দিন
                          </span>
                          {assignedHostEmail && (
                              <span className="flex items-center gap-1 bg-violet-50 text-violet-600 px-2 py-1.5 rounded-lg border border-violet-100 truncate max-w-[150px]">
                                  <User size={10} /> {assignedHostEmail.split('@')[0]}
                              </span>
                          )}
                          {tour.penaltyAmount && tour.penaltyAmount > 0 && (
                             <span className="flex items-center gap-1 bg-rose-50 text-rose-600 px-2 py-1.5 rounded-lg border border-rose-100">
                                  <AlertTriangle size={10} /> জরিমানা: {tour.penaltyAmount}
                             </span>
                          )}
                      </div>

                      {isAdmin && (
                        <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                                <p className="text-[8px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">বাস ভাড়া</p>
                                <p className="font-black text-slate-700 text-xs">৳{Number(tour.busConfig?.totalRent || 0).toLocaleString()}</p>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                                <p className="text-[8px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">হোটেল</p>
                                <p className="font-black text-slate-700 text-xs">৳{Number(tour.costs?.hotelCost || 0).toLocaleString()}</p>
                            </div>
                        </div>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="animate-fade-in max-w-4xl mx-auto pb-10">
          <div className="flex justify-between items-center bg-white/90 backdrop-blur-xl p-3 rounded-2xl shadow-sm border border-slate-200 sticky top-14 sm:top-4 z-40 mb-4">
            <div className="flex items-center gap-3">
                <button type="button" onClick={() => { setIsCreating(false); setActiveTour(null); }} className="w-8 h-8 flex items-center justify-center bg-white rounded-xl text-slate-600 hover:bg-slate-50 border border-slate-200 transition-all">
                    <ArrowLeft size={16}/>
                </button>
                <div className="flex flex-col">
                    <h2 className="font-bold text-slate-800 text-xs tracking-tight">
                        {activeTour?.id || tourData.id ? 'আপডেট' : 'নতুন'}
                    </h2>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide hidden sm:block">
                        {isAdmin ? 'তথ্য পূরণ করুন' : 'খরচ আপডেট করুন'}
                    </p>
                </div>
            </div>
            <button 
                type="submit" 
                form="tour-form"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-xl font-bold shadow-md text-[10px] uppercase tracking-widest hover:bg-slate-800 hover:scale-105 transition-all disabled:opacity-70"
            >
                {isSubmitting ? <Loader size={12} className="animate-spin"/> : <Save size={12} />}
                {isSubmitting ? '...' : 'সেভ'}
            </button>
          </div>
          
          <form id="tour-form" onSubmit={activeTour?.id || tourData.id ? handleUpdate : handleSubmit} className="space-y-4">
            <div className={`grid gap-4 ${isAdmin ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                {/* LEFT COLUMN - ADMIN ONLY */}
                {isAdmin && (
                <div className="space-y-4">
                    <Card className="p-4">
                        <SectionHeader icon={MapPin} title="প্রাথমিক তথ্য" color="text-violet-700" />
                        <div className="space-y-3">
                            <InputGroup label="ট্যুর এর নাম">
                                <StyledInput required placeholder="নাম" value={tourData.name} onChange={(e: any) => setTourData({...tourData, name: e.target.value})} />
                            </InputGroup>
                            
                            <div className="p-3 bg-violet-50/50 rounded-xl border border-violet-100/50">
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1">
                                        <UserPlus size={10} /> হোস্ট
                                    </label>
                                    <button type="button" onClick={() => setUseManualHostId(!useManualHostId)} className="text-[9px] text-violet-600 font-bold hover:underline">
                                        {useManualHostId ? 'লিস্ট' : 'ম্যানুয়াল'}
                                    </button>
                                </div>
                                {useManualHostId ? (
                                    <StyledInput placeholder="UID..." value={tourData.assignedHostId || ''} onChange={(e: any) => setTourData({...tourData, assignedHostId: e.target.value})} className="font-mono text-[10px] py-2"/>
                                ) : (
                                    <div className="relative">
                                        <select 
                                            value={tourData.assignedHostId || ''} 
                                            onChange={e => setTourData({...tourData, assignedHostId: e.target.value})}
                                            className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-violet-500/20 appearance-none"
                                        >
                                            <option value="">-- নির্বাচন --</option>
                                            {availableHosts.map(host => (
                                                <option key={host.uid} value={host.uid}>
                                                    {host.email}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14}/>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <InputGroup label="তারিখ">
                                    <StyledInput required type="date" value={tourData.date} onChange={(e: any) => setTourData({...tourData, date: e.target.value})} />
                                </InputGroup>
                                <InputGroup label="দিন">
                                    <StyledInput required type="number" min="1" value={tourData.duration} onChange={(e: any) => setTourData({...tourData, duration: Math.max(1, safeNumInput(e))})} />
                                </InputGroup>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4">
                        <SectionHeader icon={DollarSign} title="আয় (প্রতি সিট)" color="text-emerald-700" />
                        <div className="grid grid-cols-3 gap-2">
                            <InputGroup label="রেগুলার">
                                <StyledInput type="number" className="text-center font-bold text-emerald-700 bg-emerald-50/50" value={tourData.fees?.regular} onChange={(e: any) => setTourData({...tourData, fees: {...tourData.fees!, regular: safeNumInput(e)}})} />
                            </InputGroup>
                            <InputGroup label="ডিস ১">
                                <StyledInput type="number" className="text-center font-bold text-amber-600 bg-amber-50/50" value={tourData.fees?.disc1} onChange={(e: any) => setTourData({...tourData, fees: {...tourData.fees!, disc1: safeNumInput(e)}})} />
                            </InputGroup>
                            <InputGroup label="ডিস ২">
                                <StyledInput type="number" className="text-center font-bold text-orange-600 bg-orange-50/50" value={tourData.fees?.disc2} onChange={(e: any) => setTourData({...tourData, fees: {...tourData.fees!, disc2: safeNumInput(e)}})} />
                            </InputGroup>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-100">
                           <InputGroup label="জরিমানা (অনুপস্থিত গেস্ট)">
                                <StyledInput type="number" className="text-center font-bold text-rose-600 bg-rose-50/50" value={tourData.penaltyAmount} onChange={(e: any) => setTourData({...tourData, penaltyAmount: safeNumInput(e)})} />
                           </InputGroup>
                        </div>
                    </Card>
                </div>
                )}

                {/* RIGHT COLUMN - ADMIN & HOST */}
                <div className="space-y-4">
                    {isAdmin && (
                    <Card className="p-4">
                        <SectionHeader icon={Building} title="ফিক্সড খরচ (মূল)" color="text-rose-700" />
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <InputGroup label="মোট বাস">
                                <StyledInput type="number" className="font-bold text-rose-600 bg-rose-50/30" value={tourData.busConfig?.totalRent} onChange={(e: any) => setTourData({...tourData, busConfig: {...tourData.busConfig!, totalRent: safeNumInput(e)}})} />
                            </InputGroup>
                            <InputGroup label="মোট হোটেল">
                                <StyledInput type="number" className="font-bold text-rose-600 bg-rose-50/30" value={tourData.costs?.hotelCost} onChange={(e: any) => setTourData({...tourData, costs: {...tourData.costs!, hotelCost: safeNumInput(e)}})} />
                            </InputGroup>
                            <div className="col-span-2">
                                <InputGroup label="হোস্ট স্যালারি">
                                    <StyledInput type="number" value={tourData.costs?.hostFee} onChange={(e: any) => setTourData({...tourData, costs: {...tourData.costs!, hostFee: safeNumInput(e)}})} />
                                </InputGroup>
                            </div>
                        </div>
                        
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <label className="text-[9px] font-bold text-slate-400 uppercase mb-2 block">বাস ও সিট ডিসকাউন্ট</label>
                            <div className="space-y-3">
                                <InputGroup label="মোট সিট (Total Seats)">
                                    <StyledInput type="number" className="font-bold text-slate-700 text-center" value={tourData.busConfig?.totalSeats} onChange={(e: any) => setTourData({...tourData, busConfig: {...tourData.busConfig!, totalSeats: safeNumInput(e)}})} />
                                </InputGroup>
                                
                                <div className="space-y-2 pt-2 border-t border-slate-200">
                                    {['discount1', 'discount2'].map((type, idx) => {
                                        const keyAmount = `${type}Amount` as keyof BusConfig;
                                        return (
                                            <div key={type} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                                                <span className="text-[9px] font-bold text-slate-500 block truncate">ডিস {idx+1} ছাড়ের পরিমাণ</span>
                                                <input type="number" value={tourData.busConfig?.[keyAmount] as number} onChange={e => setTourData({...tourData, busConfig: {...tourData.busConfig!, [keyAmount]: safeNumInput(e)}})} 
                                                className="w-24 font-bold text-rose-500 border-b border-slate-200 outline-none text-xs py-1 text-right" placeholder="Amount" />
                                            </div>
                                        )
                                    })}
                                </div>
                                <p className="text-[8px] text-slate-400 italic text-center mt-2">
                                    * ডিসকাউন্ট ও রেগুলার সিটের সংখ্যা গেস্ট এন্ট্রি থেকে অটোমেটিক আপডেট হবে।
                                </p>
                            </div>
                        </div>
                    </Card>
                    )}

                    {/* EXTRA FIXED EXPENSES - ADMIN & HOST */}
                    <Card className="p-4">
                        <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-50">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700">
                                    <DollarSign size={14} />
                                </div>
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-teal-700">অন্যান্য ফিক্সড খরচ</h3>
                            </div>
                            <button type="button" onClick={addOtherFixedCost} className="text-[9px] font-bold bg-teal-50 text-teal-600 px-2 py-1 rounded-lg border border-teal-100 flex items-center gap-1 hover:bg-teal-100">
                                <PlusCircle size={10} /> নতুন যোগ
                            </button>
                        </div>
                        
                        <div className="space-y-2">
                            {!tourData.costs?.otherFixedCosts?.length && (
                                <p className="text-[9px] text-slate-400 font-bold italic text-center py-2">কোন অতিরিক্ত খরচ নেই</p>
                            )}
                            {tourData.costs?.otherFixedCosts?.map((item) => (
                                <div key={item.id} className="flex gap-2 items-center">
                                    <input 
                                        type="text" 
                                        placeholder="খরচের নাম..."
                                        value={item.name}
                                        onChange={(e) => updateOtherFixedCost(item.id, 'name', e.target.value)}
                                        className="flex-[2] px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:bg-white focus:border-teal-400"
                                    />
                                    <div className="relative flex-1">
                                        <input 
                                            type="number" 
                                            placeholder="0"
                                            value={item.amount}
                                            onChange={(e) => updateOtherFixedCost(item.id, 'amount', safeNumInput(e))}
                                            className="w-full pl-2 pr-1 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-center outline-none focus:bg-white focus:border-teal-400"
                                        />
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => deleteOtherFixedCost(item.id)}
                                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={12}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card className="p-4">
                        <SectionHeader icon={Utensils} title="দৈনিক খরচ" color="text-orange-700" />
                        <div className="space-y-3">
                            {tourData.costs?.dailyExpenses?.map((day, index) => (
                                <div key={index} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-600">{day.day}</span>
                                        <h4 className="text-[9px] font-bold text-slate-400 uppercase">দিন {day.day}</h4>
                                    </div>
                                    <div className="grid grid-cols-5 gap-1.5">
                                        {[
                                            { key: 'breakfast', label: 'নাস্তা' },
                                            { key: 'lunch', label: 'দুপুর' },
                                            { key: 'dinner', label: 'রাত' },
                                            { key: 'transport', label: 'গাড়ি' },
                                            { key: 'other', label: 'অন্য' }
                                        ].map((item) => (
                                            <div key={item.key} className="space-y-0.5">
                                                <label className="text-[6px] font-bold text-slate-400 uppercase text-center block truncate">{item.label}</label>
                                                <input type="number" value={(day as any)[item.key]} onChange={e => handleDailyExpenseChange(index, item.key as keyof DailyExpense, safeNumInput(e))}
                                                className={`w-full p-1 border border-slate-200 rounded-lg text-[10px] text-center font-bold outline-none focus:bg-white transition-all ${item.key === 'other' ? 'focus:border-violet-400 bg-violet-50/20' : 'focus:border-orange-400'}`} placeholder="0"/>
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