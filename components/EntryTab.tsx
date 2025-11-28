
import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { Tour, CommonTabProps, BusConfig, DailyExpense } from '../types';
import { Plus, Edit2, Calendar, DollarSign, Bus, Check, Settings, MapPin, Save, ArrowLeft, Trash2, Clock, Utensils, UserPlus, User, Key, Loader, AlertTriangle } from 'lucide-react';
import { calculateBusFare } from '../utils/calculations';

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
              newExpenses.push(currentExpenses[i] || { day: i + 1, breakfast: 0, lunch: 0, dinner: 0, transport: 0 });
          }
          return { ...prev, costs: { ...prev.costs!, dailyExpenses: newExpenses } };
      });
  }, [tourData.duration, isCreating]);

  // Robust data sanitization
  const sanitizeData = (data: any, forUpdate = false) => {
    // Clone data to avoid mutating state
    const clean = JSON.parse(JSON.stringify(data));
    
    // Remove system fields that shouldn't be written directly
    delete clean.id;
    delete clean.createdAt;
    delete clean.updatedAt;
    
    // For updates, remove partnerAgencies so we don't overwrite them with empty/stale data
    if (forUpdate) {
        delete clean.partnerAgencies;
        delete clean.createdBy; // Usually don't change creator on edit
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
        partnerAgencies: [], // Initialize empty
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

      // Identify ID: either from the currently active tour OR from the form data
      const targetId = activeTour?.id || tourData.id;

      if (!targetId) {
          console.error("Update failed: No ID found in activeTour or tourData");
          alert("Error: Tour ID not found. Cannot update.");
          return;
      }

      setIsSubmitting(true);
      try {
          const tourRef = doc(db, 'tours', targetId);
          // Sanitize strictly for update
          const cleanData = sanitizeData(tourData, true);
          const updateData = { ...cleanData, updatedAt: Timestamp.now() };
          
          await updateDoc(tourRef, updateData);
          await refreshTours();
          
          setIsCreating(false);
          setActiveTour(null);
          setTourData(initialTourData);
          alert("Tour updated successfully!");
      } catch (err: any) {
          console.error("Error updating", err);
          alert("আপডেট ব্যর্থ হয়েছে: " + err.message);
      } finally {
        setIsSubmitting(false);
      }
  };

  const handleDelete = async (e: React.MouseEvent | undefined, tourId: string) => {
      // Critical: Stop all propagation to prevent opening the edit form
      if (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
      }
      
      console.log("Attempting to delete tour with ID:", tourId);

      if (!tourId) {
          console.error("Delete failed: Invalid Tour ID");
          alert("Error: Invalid Tour ID (Document not found).");
          return;
      }

      if (user.role !== 'admin') {
          alert("Only Admin can delete tours.");
          return;
      }
      
      if (!window.confirm('Are you sure you want to delete this tour? This cannot be undone.')) return;
      
      try {
          await deleteDoc(doc(db, 'tours', tourId));
          console.log("Delete successful for ID:", tourId);
          await refreshTours(); // Force refresh list
          
          // Reset states if the deleted tour was active
          if (activeTour?.id === tourId) {
              setActiveTour(null);
              setIsCreating(false);
              setTourData(initialTourData);
          }
      } catch (err) {
          console.error("Error deleting", err);
          alert("Delete failed. Please check console/internet.");
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

  return (
    <div className="p-4 space-y-6 pb-24 lg:pb-10">
      {!isCreating ? (
        <>
          <div className="flex justify-between items-center mb-4">
            <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">ট্যুর তালিকা</h2>
                <p className="text-xs text-slate-500 font-medium">সব ট্যুর এবং ইভেন্ট</p>
            </div>
            {user.role === 'admin' && (
              <button 
                type="button"
                onClick={() => { resetForm(); setIsCreating(true); }}
                className="bg-slate-900 text-white pl-4 pr-5 py-3 rounded-2xl flex items-center shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 text-sm font-bold uppercase tracking-wide"
              >
                <Plus size={18} className="mr-2" /> নতুন ট্যুর
              </button>
            )}
          </div>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {tours.map(tour => {
              const assignedHostEmail = tour.assignedHostId ? getHostEmailById(tour.assignedHostId) : null;
              
              return (
                <div 
                  key={tour.id}
                  className={`group relative rounded-[1.5rem] border transition-all overflow-hidden flex flex-col justify-between ${
                    activeTour?.id === tour.id 
                      ? 'border-violet-500 bg-white ring-2 ring-violet-100 shadow-xl shadow-violet-500/10' 
                      : 'border-slate-100 bg-white hover:border-violet-200 hover:shadow-lg'
                  }`}
                >
                  {/* Action Buttons Wrapper - Absolute Positioned to ensure clicking here NEVER triggers card click */}
                   {user.role === 'admin' && (
                        <div 
                          className="absolute top-4 right-4 z-20 flex gap-2"
                          onClick={(e) => {
                             e.stopPropagation();
                             e.preventDefault();
                          }}
                        >
                            <button 
                              type="button"
                              onClick={(e) => { 
                                  e.stopPropagation(); 
                                  e.nativeEvent.stopImmediatePropagation();
                                  setActiveTour(tour); 
                                  setTourData(tour); 
                                  setIsCreating(true); 
                              }}
                              className="p-3 bg-white/90 backdrop-blur-sm text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-all border border-slate-200 shadow-sm"
                              title="Edit Tour"
                            >
                                <Edit2 size={18} />
                            </button>
                            <button 
                                type="button"
                                onClick={(e) => handleDelete(e, tour.id)}
                                className="p-3 bg-white/90 backdrop-blur-sm text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-rose-100 shadow-sm"
                                title="Delete Tour"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    )}

                  {/* Main Card Content - Clickable Area */}
                  <div 
                    className="p-6 flex-1 cursor-pointer"
                    onClick={() => { setActiveTour(tour); setTourData(tour); setIsCreating(true); }}
                  >
                      <div className="flex justify-between items-start mb-4 pr-24"> {/* Right padding to avoid button overlap */}
                        <div className="flex-1">
                          {user.role === 'admin' && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                 <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-md text-[10px] font-bold border border-slate-200">
                                    {tour.createdBy === user.email ? 'You' : tour.createdBy}
                                 </span>
                                 {assignedHostEmail && (
                                    <span className="bg-violet-50 text-violet-600 px-2 py-1 rounded-md text-[10px] font-bold border border-violet-100 flex items-center gap-1">
                                        <User size={10} /> {assignedHostEmail}
                                    </span>
                                 )}
                              </div>
                          )}
                          
                          <h3 className="font-bold text-xl text-slate-800 group-hover:text-violet-700 transition-colors flex items-center gap-2 mb-2 line-clamp-1" title={tour.name}>
                            {tour.name}
                          </h3>
                          <div className="flex items-center text-slate-500 text-xs font-medium gap-3">
                            <span className="flex items-center"><Calendar size={14} className="mr-1.5 text-violet-400" /> {tour.date}</span>
                            <span className="flex items-center"><Clock size={14} className="mr-1.5 text-violet-400" /> {tour.duration} দিন</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-auto flex gap-3 text-xs font-bold">
                          <div className="bg-indigo-50 px-3 py-2 rounded-xl border border-indigo-100 text-indigo-700 flex items-center flex-1 justify-center whitespace-nowrap">
                              ভাড়া: ৳{tour.busConfig?.totalRent?.toLocaleString() || 0}
                          </div>
                          <div className="bg-orange-50 px-3 py-2 rounded-xl border border-orange-100 text-orange-700 flex items-center flex-1 justify-center whitespace-nowrap">
                              হোস্ট ফি: ৳{tour.costs?.hostFee?.toLocaleString() || 0}
                          </div>
                      </div>
                  </div>
                </div>
              );
            })}
            
            {tours.length === 0 && (
                <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200 col-span-full">
                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Bus className="text-slate-400" size={24} />
                    </div>
                    <p className="text-slate-500 font-bold text-sm">কোন ট্যুর পাওয়া যায়নি</p>
                </div>
            )}
          </div>
        </>
      ) : (
        <div className="animate-fade-in space-y-5 max-w-4xl mx-auto">
          <div className="flex justify-between items-center bg-white/80 backdrop-blur p-4 rounded-2xl shadow-sm sticky top-0 z-30 border border-slate-100">
            <div className="flex items-center gap-3">
                <button type="button" onClick={() => { setIsCreating(false); setActiveTour(null); }} className="p-2.5 bg-slate-50 rounded-xl text-slate-600 hover:bg-slate-100"><ArrowLeft size={20}/></button>
                <h2 className="font-bold text-slate-800">
                {activeTour?.id || tourData.id ? 'ট্যুর আপডেট' : 'নতুন ট্যুর'}
                </h2>
            </div>
            <div className="flex items-center gap-2">
                <button 
                    type="submit" 
                    form="tour-form"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-slate-200 text-sm uppercase tracking-wide hover:bg-slate-800 transition disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? <Loader size={16} className="animate-spin"/> : <Save size={16} />}
                    {isSubmitting ? 'সেভ হচ্ছে...' : 'সেভ'}
                </button>
            </div>
          </div>
          
          <form id="tour-form" onSubmit={activeTour?.id || tourData.id ? handleUpdate : handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 space-y-4">
                        <h3 className="text-xs font-bold text-violet-600 uppercase tracking-widest flex items-center gap-2">
                            <MapPin size={14}/> বেসিক তথ্য
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">ট্যুরের নাম</label>
                                <input required type="text" value={tourData.name} onChange={e => setTourData({...tourData, name: e.target.value})} 
                                className="w-full px-4 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all text-sm font-semibold bg-slate-50/50 focus:bg-white" 
                                placeholder="যেমন: কক্সবাজার ট্রিপ" />
                            </div>
                            
                            {/* Host Assignment Section (Admin Only) */}
                            {user.role === 'admin' && (
                                <div className="space-y-2 p-4 bg-violet-50 rounded-2xl border border-violet-100">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                            <UserPlus size={10} /> নির্ধারিত হোস্ট (By Email)
                                        </label>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => setUseManualHostId(!useManualHostId)} className="text-[9px] text-violet-600 flex items-center gap-1 font-bold hover:underline bg-white px-2 py-1 rounded border border-violet-200">
                                                <Key size={10} /> {useManualHostId ? 'লিস্ট দেখুন' : 'ম্যানুয়াল আইডি'}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {useManualHostId ? (
                                        <input 
                                            type="text" 
                                            placeholder="Paste Host User UID here..." 
                                            value={tourData.assignedHostId || ''}
                                            onChange={e => setTourData({...tourData, assignedHostId: e.target.value})}
                                            className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-mono"
                                        />
                                    ) : (
                                        <div className="relative">
                                            <select 
                                                value={tourData.assignedHostId || ''} 
                                                onChange={e => setTourData({...tourData, assignedHostId: e.target.value})}
                                                className="w-full px-4 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all text-sm font-semibold bg-white appearance-none cursor-pointer"
                                            >
                                                <option value="">-- হোস্ট সিলেক্ট করুন --</option>
                                                {availableHosts.map(host => (
                                                    <option key={host.uid} value={host.uid}>
                                                        {host.email} ({host.role})
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="absolute right-3 top-3.5 pointer-events-none text-slate-400">
                                                <Settings size={16} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">তারিখ</label>
                                    <input required type="date" value={tourData.date} onChange={e => setTourData({...tourData, date: e.target.value})} 
                                    className="w-full px-4 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all text-sm font-semibold bg-slate-50/50 focus:bg-white" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">সময়কাল (দিন)</label>
                                    <input required type="number" min="1" value={tourData.duration} onChange={e => setTourData({...tourData, duration: Math.max(1, safeNumInput(e))})} 
                                    className="w-full px-4 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all text-sm font-semibold bg-slate-50/50 focus:bg-white" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700"><DollarSign size={14}/></div>
                        <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-widest">
                            গেস্ট প্যাকেজ মূল্য (Income Config)
                        </h3>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">রেগুলার</label>
                                <input type="number" value={tourData.fees?.regular} onChange={e => setTourData({...tourData, fees: {...tourData.fees!, regular: safeNumInput(e)}})} 
                                className="w-full p-3 border border-emerald-100 bg-emerald-50/30 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-center font-bold text-emerald-800" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">ডিসকাউন্ট ১</label>
                                <input type="number" value={tourData.fees?.disc1} onChange={e => setTourData({...tourData, fees: {...tourData.fees!, disc1: safeNumInput(e)}})} 
                                className="w-full p-3 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none text-center font-bold" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">ডিসকাউন্ট ২</label>
                                <input type="number" value={tourData.fees?.disc2} onChange={e => setTourData({...tourData, fees: {...tourData.fees!, disc2: safeNumInput(e)}})} 
                                className="w-full p-3 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none text-center font-bold" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 bg-rose-100 rounded-lg text-rose-700"><Bus size={14}/></div>
                        <h3 className="text-xs font-bold text-rose-700 uppercase tracking-widest">
                            বাস এবং খরচ কনফিগারেশন (Fixed Cost)
                        </h3>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block ml-1">মোট বাস ভাড়া</label>
                                <input type="number" value={tourData.busConfig?.totalRent} onChange={e => setTourData({...tourData, busConfig: {...tourData.busConfig!, totalRent: safeNumInput(e)}})} 
                                className="w-full p-3.5 border border-rose-100 bg-rose-50/30 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none font-bold text-rose-800" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block ml-1">হোস্ট ফি</label>
                                <input type="number" value={tourData.costs?.hostFee} onChange={e => setTourData({...tourData, costs: {...tourData.costs!, hostFee: safeNumInput(e)}})} 
                                className="w-full p-3.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none font-bold" />
                            </div>
                        </div>
                        
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div className="flex items-center mb-2">
                            <Settings size={14} className="mr-2 text-slate-400"/>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">বাসের সিট ডিস্ট্রিবিউশন</span>
                            </div>
                            <p className="text-[9px] text-slate-400 mb-3 leading-relaxed">
                                বিঃদ্রঃ: ডিসকাউন্ট সিটের খরচ রেগুলার সিটের যাত্রীরা বহন করবে।
                            </p>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-20">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase">রেগুলার সিট</label>
                                        <input type="number" placeholder="Qty" value={tourData.busConfig?.regularSeats} onChange={e => setTourData({...tourData, busConfig: {...tourData.busConfig!, regularSeats: safeNumInput(e)}})} 
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm text-center font-bold" />
                                    </div>
                                    <div className="flex-1 pt-4 text-[10px] text-slate-400 italic">
                                        বাকি খরচের চাপ এই সিটগুলোতে পরবে
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-100">
                                    <div className="w-20">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase">ডিস ১ সিট</label>
                                        <input type="number" placeholder="Qty" value={tourData.busConfig?.discount1Seats} onChange={e => setTourData({...tourData, busConfig: {...tourData.busConfig!, discount1Seats: safeNumInput(e)}})} 
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm text-center font-bold" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase">ভাড়া ছাড় (টাকা)</label>
                                        <input type="number" placeholder="Amount" value={tourData.busConfig?.discount1Amount} onChange={e => setTourData({...tourData, busConfig: {...tourData.busConfig!, discount1Amount: safeNumInput(e)}})} 
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold text-rose-500" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-100">
                                    <div className="w-20">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase">ডিস ২ সিট</label>
                                        <input type="number" placeholder="Qty" value={tourData.busConfig?.discount2Seats} onChange={e => setTourData({...tourData, busConfig: {...tourData.busConfig!, discount2Seats: safeNumInput(e)}})} 
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm text-center font-bold" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase">ভাড়া ছাড় (টাকা)</label>
                                        <input type="number" placeholder="Amount" value={tourData.busConfig?.discount2Amount} onChange={e => setTourData({...tourData, busConfig: {...tourData.busConfig!, discount2Amount: safeNumInput(e)}})} 
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold text-rose-500" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {busFarePreview && (
                            <div className="mt-4 p-4 bg-slate-800 rounded-2xl border border-slate-700 shadow-xl text-white">
                                <p className="text-[10px] font-bold text-slate-400 mb-3 border-b border-slate-700 pb-2 uppercase tracking-widest">অটো ক্যালকুলেটেড বাস ভাড়া (প্রতি সিট)</p>
                                <div className="flex justify-between text-xs">
                                    <div className="text-center">
                                        <span className="block text-slate-400 text-[9px] mb-1">বেস ফেয়ার</span>
                                        <span className="font-mono font-bold text-white">৳{busFarePreview.baseFare}</span>
                                    </div>
                                    <div className="text-center border-l border-slate-600 pl-4">
                                        <span className="block text-violet-400 font-bold text-[9px] mb-1">রেগুলার</span>
                                        <span className="font-mono font-bold text-white text-lg">৳{busFarePreview.regularFare}</span>
                                    </div>
                                    <div className="text-center border-l border-slate-600 pl-4">
                                        <span className="block text-slate-400 text-[9px] mb-1">D1</span>
                                        <span className="font-mono font-bold text-slate-200">৳{busFarePreview.discount1Fare}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 bg-orange-100 rounded-lg text-orange-700"><Utensils size={14}/></div>
                        <h3 className="text-xs font-bold text-orange-700 uppercase tracking-widest">
                            প্রতিদিনের খরচ (হোস্ট)
                        </h3>
                        </div>
                        <p className="text-[10px] text-slate-400 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            প্রতিটি দিনের জন্য খাবার এবং লোকাল ট্রান্সপোর্ট খরচ এখানে যোগ করুন।
                        </p>

                        <div className="space-y-3">
                            {tourData.costs?.dailyExpenses?.map((day, index) => (
                                <div key={index} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <h4 className="text-[10px] font-bold text-slate-500 mb-2 uppercase">দিন {day.day}</h4>
                                    <div className="grid grid-cols-4 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase">সকাল</label>
                                            <input type="number" value={day.breakfast} onChange={e => handleDailyExpenseChange(index, 'breakfast', safeNumInput(e))}
                                            className="w-full p-2 border border-slate-200 rounded-lg text-sm text-center font-bold" placeholder="0"/>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase">দুপুর</label>
                                            <input type="number" value={day.lunch} onChange={e => handleDailyExpenseChange(index, 'lunch', safeNumInput(e))}
                                            className="w-full p-2 border border-slate-200 rounded-lg text-sm text-center font-bold" placeholder="0"/>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase">রাত</label>
                                            <input type="number" value={day.dinner} onChange={e => handleDailyExpenseChange(index, 'dinner', safeNumInput(e))}
                                            className="w-full p-2 border border-slate-200 rounded-lg text-sm text-center font-bold" placeholder="0"/>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase">ট্রান্সপোর্ট</label>
                                            <input type="number" value={day.transport} onChange={e => handleDailyExpenseChange(index, 'transport', safeNumInput(e))}
                                            className="w-full p-2 border border-slate-200 rounded-lg text-sm text-center font-bold" placeholder="0"/>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default EntryTab;
