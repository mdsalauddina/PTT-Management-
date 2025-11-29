

import React, { useState, useEffect } from 'react';
import { CommonTabProps, PersonalData, Guest } from '../types';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { calculatePersonalSettlement } from '../utils/calculations';
import { Save, PlusCircle, Trash2, Receipt, Minus, Plus, UserCircle, ChevronDown, Wallet, ArrowRight, UserPlus, Phone, Armchair } from 'lucide-react';

const PersonalTab: React.FC<CommonTabProps> = ({ user, tours }) => {
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  
  const [personalData, setPersonalData] = useState<PersonalData>({
    tourId: '',
    userId: user.uid,
    personalStandardCount: 0,
    personalDisc1Count: 0,
    personalDisc2Count: 0,
    personalBusRegCount: 0,
    personalBusD1Count: 0,
    personalBusD2Count: 0,
    bookingFee: 0,
    customExpenses: [],
    guests: [],
    updatedAt: null
  });

  const [isAddingGuest, setIsAddingGuest] = useState(false);
  const [newGuest, setNewGuest] = useState({ name: '', phone: '', seatCount: '', unitPrice: '', seatNumbers: '' });

  useEffect(() => {
    if (tours.length > 0 && !selectedTourId) {
        setSelectedTourId(tours[0].id);
    }
  }, [tours, selectedTourId]);

  const activeTour = tours.find(t => t.id === selectedTourId) || null;

  useEffect(() => {
    if (!activeTour) return;

    const fetchPersonalData = async () => {
      try {
        const docRef = doc(db, 'personal', `${activeTour.id}_${user.uid}`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as PersonalData;
          if (!data.customExpenses) data.customExpenses = [];
          if (!data.guests) data.guests = [];
          setPersonalData(data);
        } else {
             setPersonalData({
                tourId: activeTour.id,
                userId: user.uid,
                personalStandardCount: 0,
                personalDisc1Count: 0,
                personalDisc2Count: 0,
                personalBusRegCount: 0,
                personalBusD1Count: 0,
                personalBusD2Count: 0,
                bookingFee: 0,
                customExpenses: [],
                guests: [],
                updatedAt: null
             });
        }
      } catch (err) {
        console.error("Error fetching personal data", err);
      }
    };
    fetchPersonalData();
  }, [activeTour, user.uid]);

  const handleSave = async () => {
    if (!activeTour) return;
    try {
      const docRef = doc(db, 'personal', `${activeTour.id}_${user.uid}`);
      await setDoc(docRef, { ...personalData, updatedAt: Timestamp.now() });
      alert("তথ্য সেভ হয়েছে!");
    } catch (err) {
      console.error(err);
      alert("সেভ করা যায়নি।");
    }
  };

  const addExpense = () => {
    const newExp = { id: Date.now().toString(), name: '', amount: 0 };
    setPersonalData({ ...personalData, customExpenses: [...(personalData.customExpenses || []), newExp] });
  };

  const updateExpense = (id: string, field: string, value: string | number) => {
    const updated = personalData.customExpenses.map(e => e.id === id ? { ...e, [field]: value } : e);
    setPersonalData({ ...personalData, customExpenses: updated });
  };

  // Sync counters with guest list
  useEffect(() => {
      if(personalData.guests && personalData.guests.length > 0) {
          const totalSeats = personalData.guests.reduce((sum, g) => sum + (Number(g.seatCount)||1), 0);
          // Assuming most are standard for auto-counter, but user can still override counters if needed.
          // However, better to just update standard count to match guests if user hasn't manually set distribution?
          // For simplicity, let's keep counters manual OR allow counters to be just used for calculation. 
          // Let's UPDATE the main counter to reflect total guests for accurate cost calculation.
          
          // Logic: We update 'personalStandardCount' to match total guests from list minus d1/d2 manual counts.
          // This keeps the cost logic working.
          const currentD1 = personalData.personalDisc1Count || 0;
          const currentD2 = personalData.personalDisc2Count || 0;
          const remaining = Math.max(0, totalSeats - currentD1 - currentD2);
          
          if (remaining !== personalData.personalStandardCount) {
              setPersonalData(prev => ({...prev, personalStandardCount: remaining}));
          }
      }
  }, [personalData.guests, personalData.personalDisc1Count, personalData.personalDisc2Count]);


  const updateCount = (field: keyof PersonalData, delta: number) => {
      const current = Number(personalData[field]) || 0;
      const newVal = Math.max(0, current + delta);
      setPersonalData({...personalData, [field]: newVal});
  };
  
  const handleAddGuest = () => {
      if(!newGuest.name) return;
      const seatCount = parseInt(newGuest.seatCount) || 1;
      const unitPrice = parseInt(newGuest.unitPrice) || 0;
      
      const g: Guest = {
          id: Date.now().toString(),
          name: newGuest.name,
          phone: newGuest.phone,
          seatCount: seatCount,
          seatNumbers: newGuest.seatNumbers,
          unitPrice: unitPrice,
          collection: seatCount * unitPrice,
          seatType: 'regular'
      };
      
      setPersonalData({...personalData, guests: [...(personalData.guests || []), g]});
      setNewGuest({ name: '', phone: '', seatCount: '', unitPrice: '', seatNumbers: '' });
      setIsAddingGuest(false);
  };
  
  const removeGuest = (id: string) => {
      setPersonalData({...personalData, guests: personalData.guests?.filter(g => g.id !== id)});
  };

  const settlement = calculatePersonalSettlement(activeTour || {} as any, personalData);

  if (!activeTour) return (
    <div className="h-full flex flex-col items-center justify-center p-10 text-center text-slate-400">
        <div className="bg-slate-100 p-6 rounded-full mb-4"><UserCircle size={32} /></div>
        <p className="font-bold text-sm">কোন ট্যুর ডাটা পাওয়া যায়নি</p>
    </div>
  );
  
  const isAdmin = user.role === 'admin';

  return (
    <div className="p-4 space-y-6 animate-fade-in pb-24 lg:pb-10 max-w-3xl mx-auto">
      {/* Selector */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 relative z-20">
        <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <UserCircle size={20} />
        </div>
        <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">ব্যক্তিগত হিসাব</label>
            <div className="relative">
                <select 
                    value={selectedTourId}
                    onChange={(e) => setSelectedTourId(e.target.value)}
                    className="w-full appearance-none bg-transparent text-slate-800 text-lg font-black focus:outline-none cursor-pointer pr-8"
                >
                    {tours.map(t => <option key={t.id} value={t.id}>{t.name} ({t.date})</option>)}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} strokeWidth={2.5} />
            </div>
        </div>
      </div>

      <div className="flex justify-between items-center bg-white/60 backdrop-blur-md p-4 rounded-[1.5rem] shadow-sm border border-slate-100 sticky top-0 z-10">
        <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">একশন</p>
            <h2 className="font-bold text-slate-700 text-sm">আপডেট ও সেভ</h2>
        </div>
        <button 
            onClick={handleSave} 
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-slate-200 transition-all active:scale-95 text-xs uppercase tracking-wide hover:bg-slate-800"
        >
            <Save size={16} /> সেভ করুন
        </button>
      </div>
      
      {/* Guest List Card */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-700 text-xs uppercase tracking-widest flex items-center gap-2">
                <UserPlus size={16} className="text-indigo-500"/> আমার গেস্ট লিস্ট
            </h3>
            <button 
                onClick={() => setIsAddingGuest(!isAddingGuest)}
                className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-1 hover:bg-indigo-100 transition-colors uppercase"
            >
                <Plus size={12}/> নতুন গেস্ট
            </button>
        </div>
        
        {isAddingGuest && (
            <div className="p-6 bg-slate-50 border-b border-slate-100 animate-fade-in">
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="col-span-2">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">নাম</label>
                        <input className="w-full border border-slate-200 bg-white p-3 rounded-xl text-sm outline-none font-semibold focus:ring-2 focus:ring-indigo-500" value={newGuest.name} onChange={e => setNewGuest({...newGuest, name: e.target.value})} placeholder="নাম"/>
                    </div>
                    <div className="col-span-2">
                         <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">মোবাইল</label>
                         <input className="w-full border border-slate-200 bg-white p-3 rounded-xl text-sm outline-none font-semibold focus:ring-2 focus:ring-indigo-500" value={newGuest.phone} onChange={e => setNewGuest({...newGuest, phone: e.target.value})} placeholder="ফোন"/>
                    </div>
                    <div>
                         <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">সিট সংখ্যা</label>
                         <input type="number" className="w-full border border-slate-200 bg-white p-3 rounded-xl text-sm outline-none font-bold text-center focus:ring-2 focus:ring-indigo-500" value={newGuest.seatCount} onChange={e => setNewGuest({...newGuest, seatCount: e.target.value})} placeholder="1"/>
                    </div>
                    <div>
                         <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">কালেকশন</label>
                         <input type="number" className="w-full border border-emerald-200 bg-emerald-50 p-3 rounded-xl text-sm outline-none font-bold text-center text-emerald-700 focus:ring-2 focus:ring-emerald-500" value={newGuest.unitPrice} onChange={e => setNewGuest({...newGuest, unitPrice: e.target.value})} placeholder="0"/>
                    </div>
                    <div className="col-span-2">
                         <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">সিট নম্বর</label>
                         <input className="w-full border border-slate-200 bg-white p-3 rounded-xl text-sm outline-none font-semibold focus:ring-2 focus:ring-indigo-500" value={newGuest.seatNumbers} onChange={e => setNewGuest({...newGuest, seatNumbers: e.target.value})} placeholder="A1, B2..."/>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={() => setIsAddingGuest(false)} className="px-4 py-2 rounded-lg text-slate-500 text-xs font-bold hover:bg-slate-100">বাতিল</button>
                    <button onClick={handleAddGuest} className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md hover:bg-indigo-700">সেভ করুন</button>
                </div>
            </div>
        )}
        
        {(!personalData.guests || personalData.guests.length === 0) ? (
             <div className="p-8 text-center text-slate-400 text-xs italic">কোনো গেস্ট নেই</div>
        ) : (
            <div className="divide-y divide-slate-50">
                {personalData.guests.map((g, i) => (
                    <div key={g.id} className="p-4 hover:bg-slate-50 flex justify-between items-center group">
                        <div>
                            <p className="font-bold text-slate-700 text-sm">{g.name}</p>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1"><Phone size={10}/> {g.phone || 'N/A'}</span>
                                <span className="text-[10px] text-slate-500 font-bold">{g.seatCount} সিট</span>
                                {g.seatNumbers && (
                                    <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 rounded border border-indigo-100 font-bold flex items-center gap-1">
                                        <Armchair size={10}/> {g.seatNumbers}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                             <div className="text-right">
                                <p className="text-[9px] text-slate-400 font-bold uppercase">বাকি</p>
                                <p className="font-mono font-bold text-emerald-600 text-sm">৳{g.collection}</p>
                             </div>
                             <button onClick={() => removeGuest(g.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={16}/></button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Manual Counters (Kept for adjusting Discount counts) */}
      <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-200/50">
        <h3 className="text-xs font-bold text-slate-500 mb-6 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span> সিট টাইপ অ্যাডজাস্টমেন্ট
        </h3>
        <p className="text-[10px] text-slate-400 mb-4">মোট গেস্ট থেকে কতজন ডিসকাউন্ট পাবে তা এখানে নির্ধারণ করুন।</p>
        <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <span className="text-[9px] text-slate-400 font-bold uppercase mb-2">ডিসকাউন্ট ১</span>
                <div className="flex items-center gap-3 w-full justify-between">
                    <button onClick={() => updateCount('personalDisc1Count', -1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-500 border border-slate-200 hover:bg-rose-50 hover:text-rose-500"><Minus size={14}/></button>
                    <span className="text-xl font-black text-slate-700">{personalData.personalDisc1Count}</span>
                    <button onClick={() => updateCount('personalDisc1Count', 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Plus size={14}/></button>
                </div>
            </div>
            <div className="flex flex-col items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <span className="text-[9px] text-slate-400 font-bold uppercase mb-2">ডিসকাউন্ট ২</span>
                <div className="flex items-center gap-3 w-full justify-between">
                    <button onClick={() => updateCount('personalDisc2Count', -1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-500 border border-slate-200 hover:bg-rose-50 hover:text-rose-500"><Minus size={14}/></button>
                    <span className="text-xl font-black text-slate-700">{personalData.personalDisc2Count}</span>
                    <button onClick={() => updateCount('personalDisc2Count', 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Plus size={14}/></button>
                </div>
            </div>
        </div>
      </div>

      {/* Expenses */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-bold text-orange-600 uppercase tracking-widest flex items-center gap-2">
                <div className="p-1.5 bg-orange-100 rounded-lg"><Receipt size={14} /></div> আমার খরচ
            </h3>
            <button 
                onClick={addExpense} 
                className="text-slate-600 text-xs flex items-center font-bold bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition-colors shadow-sm"
            >
                <PlusCircle size={14} className="mr-2"/> খরচ যোগ
            </button>
        </div>
        
        <div className="space-y-3">
            {(!personalData.customExpenses || personalData.customExpenses.length === 0) && (
                <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <Receipt size={24} className="text-slate-300 mx-auto mb-2"/>
                    <p className="text-xs text-slate-400 font-medium">কোন অতিরিক্ত খরচ যোগ করা হয়নি</p>
                </div>
            )}
            
            {personalData.customExpenses && personalData.customExpenses.map(exp => (
                <div key={exp.id} className="flex gap-3 items-center animate-fade-in group">
                    <input type="text" value={exp.name} onChange={e => updateExpense(exp.id, 'name', e.target.value)} 
                        className="flex-1 border border-slate-200 bg-slate-50 p-4 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-violet-500 outline-none transition-all font-medium placeholder-slate-400" placeholder="খরচের বিবরণ..." />
                    <div className="relative w-32">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">৳</span>
                        <input type="number" value={exp.amount} onChange={e => updateExpense(exp.id, 'amount', Number(e.target.value))} 
                            className="w-full border border-slate-200 bg-slate-50 pl-8 pr-4 py-4 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-violet-500 outline-none transition-all font-bold text-slate-700" placeholder="0" />
                    </div>
                    <button onClick={() => setPersonalData({...personalData, customExpenses: personalData.customExpenses.filter(e => e.id !== exp.id)})} 
                        className="p-4 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100">
                        <Trash2 size={18} />
                    </button>
                </div>
            ))}
            
            <div className="border-t border-dashed border-slate-200 pt-6 mt-4">
                <div className="flex justify-between items-center bg-violet-50 p-4 rounded-2xl border border-violet-100">
                    <label className="text-xs font-bold text-violet-700 uppercase tracking-wide flex items-center gap-2">
                        <Wallet size={14}/> বুকিং মানি গ্রহণ (Host থেকে)
                    </label>
                    <div className="relative w-40">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-400 text-xs font-bold">৳</span>
                        <input type="number" value={personalData.bookingFee} onChange={e => setPersonalData({...personalData, bookingFee: Number(e.target.value)})} 
                            className="w-full border-0 bg-white pl-8 pr-4 py-3 rounded-xl text-sm text-right font-black text-violet-700 focus:ring-2 focus:ring-violet-500 outline-none transition-all shadow-sm" />
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Final Settlement Card - Hidden for Hosts if they shouldn't see calculations, but strictly prompt said "Host... unpaid amount... ar kono data dekhte parbe na". Assuming this refers to overall business data, but personal profit might be sensitive if calculated? 
      Actually, the prompt said "Host ekhon personal and share kora tab a booking deyar member Der nam, number,unpaid amount,seat number dekhte parbe AR kono data dekhte parbe na."
      This implies limiting visibility to just the list. So I will hide the Net Result card for Host role. */}
      {isAdmin && (
        <div className="relative rounded-[2rem] shadow-xl overflow-hidden mt-4 group">
            <div className="absolute inset-0 bg-slate-900"></div>
            <div className={`absolute inset-0 opacity-20 bg-gradient-to-br ${settlement.netResult >= 0 ? 'from-emerald-500 to-teal-500' : 'from-rose-500 to-orange-500'}`}></div>
            
            <div className="relative p-8 text-white">
                <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-6">
                    <div>
                        <p className="text-[10px] text-white/60 uppercase tracking-widest mb-1 font-bold">ব্যক্তিগত ব্যালেন্স</p>
                        <h3 className="text-xl font-black tracking-tight">হিসাব বিবরণী</h3>
                    </div>
                    <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/10">
                        <Wallet size={24} className="text-white" />
                    </div>
                </div>

                <div className="space-y-4 text-sm mb-6">
                    <div className="flex justify-between text-white/70">
                        <span className="font-medium">মোট আয় (আমার কালেকশন)</span>
                        <span className="font-bold text-white font-mono">৳ {settlement.totalPersonalIncome.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-white/70">
                        <span className="font-medium">বাদ: আমার পকেট খরচ</span>
                        <span className="font-bold text-rose-300 font-mono">- ৳ {settlement.personalExpenses.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-white/70">
                        <span className="font-medium">বাদ: ট্যুরে আমার শেয়ার</span>
                        <span className="font-bold text-orange-300 font-mono">- ৳ {settlement.hostShareOfBusRent.toLocaleString()}</span>
                    </div>
                </div>
                
                <div className="bg-white/10 p-5 rounded-2xl border border-white/10 flex justify-between items-center backdrop-blur-sm">
                    <span className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                        নেট লাভ / (লস) <ArrowRight size={14} className="opacity-50"/>
                    </span>
                    <span className={`text-3xl font-black tracking-tighter ${settlement.netResult >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                        {settlement.netResult >= 0 ? '+' : ''}{settlement.netResult.toLocaleString()} <span className="text-lg opacity-60 font-bold">৳</span>
                    </span>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default PersonalTab;