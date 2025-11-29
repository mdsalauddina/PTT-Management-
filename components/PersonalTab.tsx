import React, { useState, useEffect } from 'react';
import { CommonTabProps, PersonalData, Guest } from '../types';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { calculatePersonalSettlement } from '../utils/calculations';
import { Save, PlusCircle, Trash2, Receipt, Minus, Plus, UserCircle, ChevronDown, Wallet, ArrowRight, UserPlus, Phone, Armchair, Tag } from 'lucide-react';

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
  const [newGuest, setNewGuest] = useState({ name: '', phone: '', seatCount: '', unitPrice: '', seatNumbers: '', seatType: 'regular' });

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
          
          const currentD1 = personalData.guests.filter(g => g.seatType === 'disc1').reduce((sum, g) => sum + (Number(g.seatCount)||1), 0);
          const currentD2 = personalData.guests.filter(g => g.seatType === 'disc2').reduce((sum, g) => sum + (Number(g.seatCount)||1), 0);
          const currentReg = personalData.guests.filter(g => g.seatType === 'regular').reduce((sum, g) => sum + (Number(g.seatCount)||1), 0);
          
          // Update the counters automatically based on guest list types
          setPersonalData(prev => ({
              ...prev, 
              personalStandardCount: currentReg,
              personalDisc1Count: currentD1,
              personalDisc2Count: currentD2
          }));
      }
  }, [personalData.guests]);

  const handlePackageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const type = e.target.value as 'regular' | 'disc1' | 'disc2';
      let price = 0;
      if (activeTour?.fees) {
          if (type === 'regular') price = Number(activeTour.fees.regular);
          if (type === 'disc1') price = Number(activeTour.fees.disc1);
          if (type === 'disc2') price = Number(activeTour.fees.disc2);
      }
      setNewGuest({ ...newGuest, seatType: type, unitPrice: price.toString() });
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
          seatType: newGuest.seatType as 'regular' | 'disc1' | 'disc2'
      };
      
      setPersonalData({...personalData, guests: [...(personalData.guests || []), g]});
      setNewGuest({ name: '', phone: '', seatCount: '', unitPrice: '', seatNumbers: '', seatType: 'regular' });
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
    <div className="p-4 space-y-8 animate-fade-in pb-24 lg:pb-10 max-w-3xl mx-auto font-sans">
      {/* Selector */}
      <div className="bg-white p-2.5 rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-100 flex items-center gap-4 relative z-20">
        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 ring-4 ring-indigo-50/50 shrink-0">
            <UserCircle size={20} />
        </div>
        <div className="flex-1 min-w-0">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">ব্যক্তিগত হিসাব</label>
            <div className="relative">
                <select 
                    value={selectedTourId}
                    onChange={(e) => setSelectedTourId(e.target.value)}
                    className="w-full appearance-none bg-transparent text-slate-800 text-lg font-black focus:outline-none cursor-pointer pr-8 truncate"
                >
                    {tours.map(t => <option key={t.id} value={t.id}>{t.name} ({t.date})</option>)}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} strokeWidth={2.5} />
            </div>
        </div>
      </div>

      <div className="flex justify-between items-center bg-white/70 backdrop-blur-md p-4 rounded-3xl shadow-lg border border-white/50 sticky top-4 z-10 transition-all">
        <div className="pl-2">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">একশন</p>
            <h2 className="font-bold text-slate-700 text-sm">আপডেট ও সেভ</h2>
        </div>
        <button 
            onClick={handleSave} 
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3.5 rounded-2xl font-bold shadow-xl shadow-slate-300 transition-all active:scale-95 text-xs uppercase tracking-wide hover:bg-slate-800 hover:scale-105"
        >
            <Save size={16} /> <span className="hidden sm:inline">সেভ করুন</span>
        </button>
      </div>
      
      {/* Guest List Card */}
      <div className="bg-white rounded-[2.5rem] shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-50 flex justify-between items-center bg-white">
            <h3 className="font-bold text-slate-700 text-xs uppercase tracking-widest flex items-center gap-2">
                <div className="p-2 bg-indigo-50 rounded-xl"><UserPlus size={16} className="text-indigo-500"/></div>
                গেস্ট লিস্ট
            </h3>
            <button 
                onClick={() => setIsAddingGuest(!isAddingGuest)}
                className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl border border-indigo-100 flex items-center gap-2 hover:bg-indigo-100 transition-colors uppercase tracking-wide"
            >
                <Plus size={12}/> নতুন
            </button>
        </div>
        
        {isAddingGuest && (
            <div className="p-4 sm:p-6 bg-slate-50/50 border-b border-slate-100 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">নাম</label>
                        <input className="w-full border border-slate-200 bg-white p-3.5 rounded-xl text-sm outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" value={newGuest.name} onChange={e => setNewGuest({...newGuest, name: e.target.value})} placeholder="নাম"/>
                    </div>
                    <div className="col-span-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">মোবাইল</label>
                         <input className="w-full border border-slate-200 bg-white p-3.5 rounded-xl text-sm outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" value={newGuest.phone} onChange={e => setNewGuest({...newGuest, phone: e.target.value})} placeholder="ফোন"/>
                    </div>
                    <div className="col-span-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">প্যাকেজ টাইপ</label>
                         <div className="relative">
                            <select 
                                value={newGuest.seatType}
                                onChange={handlePackageChange}
                                className="w-full border border-slate-200 bg-white p-3.5 rounded-xl text-xs outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none"
                            >
                                <option value="regular">রেগুলার (৳{activeTour.fees.regular})</option>
                                <option value="disc1">ডিসকাউন্ট ১ (৳{activeTour.fees.disc1})</option>
                                <option value="disc2">ডিসকাউন্ট ২ (৳{activeTour.fees.disc2})</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14}/>
                         </div>
                    </div>
                    <div>
                         <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">সিট সংখ্যা</label>
                         <input type="number" className="w-full border border-slate-200 bg-white p-3.5 rounded-xl text-sm outline-none font-bold text-center focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" value={newGuest.seatCount} onChange={e => setNewGuest({...newGuest, seatCount: e.target.value})} placeholder="1"/>
                    </div>
                    <div>
                         <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">জনপ্রতি ফি</label>
                         <input type="number" className="w-full border border-emerald-200 bg-emerald-50/50 p-3.5 rounded-xl text-sm outline-none font-bold text-center text-emerald-700 focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" value={newGuest.unitPrice} onChange={e => setNewGuest({...newGuest, unitPrice: e.target.value})} placeholder="0"/>
                    </div>
                    <div className="sm:col-span-2 bg-white p-2 rounded-xl border border-slate-200/50">
                         <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">সিট নম্বর (A1, B2...)</label>
                         <input className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-xl text-sm outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" value={newGuest.seatNumbers} onChange={e => setNewGuest({...newGuest, seatNumbers: e.target.value})} placeholder="সিট নম্বর লিখুন"/>
                    </div>
                </div>
                <div className="flex justify-end gap-3">
                    <button onClick={() => setIsAddingGuest(false)} className="px-5 py-3 rounded-xl text-slate-500 text-xs font-bold hover:bg-slate-200 transition-colors">বাতিল</button>
                    <button onClick={handleAddGuest} className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-xs font-bold shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all">যোগ করুন</button>
                </div>
            </div>
        )}
        
        {(!personalData.guests || personalData.guests.length === 0) ? (
             <div className="p-12 text-center text-slate-400 text-xs font-bold italic border-dashed border-2 border-slate-100 m-8 rounded-3xl bg-slate-50/50">কোনো গেস্ট নেই</div>
        ) : (
            <div className="space-y-3 p-4 sm:p-6 bg-slate-50/30">
                {personalData.guests.map((g, i) => (
                    <div key={g.id} className="p-4 sm:p-5 bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:shadow-md transition-shadow">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold shrink-0">
                                    {i + 1}
                                </div>
                                <p className="font-bold text-slate-700 text-sm">{g.name}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 mt-2 ml-11">
                                <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1 whitespace-nowrap"><Phone size={10}/> {g.phone || 'N/A'}</span>
                                <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 whitespace-nowrap">{g.seatCount} সিট</span>
                                {g.seatNumbers && (
                                    <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100 font-bold flex items-center gap-1 whitespace-nowrap">
                                        <Armchair size={10}/> {g.seatNumbers}
                                    </span>
                                )}
                                <span className={`text-[10px] px-2 py-0.5 rounded-lg border font-bold flex items-center gap-1 whitespace-nowrap ${
                                    g.seatType === 'disc1' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                    g.seatType === 'disc2' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                    'bg-violet-50 text-violet-600 border-violet-100'
                                }`}>
                                    <Tag size={10} /> 
                                    {g.seatType === 'disc1' ? 'ডিসকাউন্ট ১' : g.seatType === 'disc2' ? 'ডিসকাউন্ট ২' : 'রেগুলার'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-5 w-full sm:w-auto justify-between sm:justify-end ml-11 sm:ml-0 border-t sm:border-t-0 border-slate-50 pt-3 sm:pt-0 mt-2 sm:mt-0">
                             <div className="text-right">
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">টোটাল</p>
                                <p className="font-mono font-black text-emerald-600 text-sm">৳{g.collection}</p>
                             </div>
                             <button onClick={() => removeGuest(g.id)} className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Expenses */}
      <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-lg shadow-slate-200/50 border border-slate-100">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-bold text-orange-600 uppercase tracking-widest flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-xl"><Receipt size={16} /></div> ব্যক্তিগত খরচ
            </h3>
            <button 
                onClick={addExpense} 
                className="text-slate-600 text-xs flex items-center font-bold bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-white hover:shadow-md transition-all shadow-sm"
            >
                <PlusCircle size={14} className="mr-1.5"/> যোগ
            </button>
        </div>
        
        <div className="space-y-4">
            {(!personalData.customExpenses || personalData.customExpenses.length === 0) && (
                <div className="text-center py-12 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-100">
                    <Receipt size={32} className="text-slate-300 mx-auto mb-3"/>
                    <p className="text-xs text-slate-400 font-bold">কোন অতিরিক্ত খরচ যোগ করা হয়নি</p>
                </div>
            )}
            
            {personalData.customExpenses && personalData.customExpenses.map(exp => (
                <div key={exp.id} className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-stretch sm:items-center animate-fade-in group bg-white p-2 rounded-2xl hover:shadow-sm border border-transparent hover:border-slate-100 transition-all">
                    <input type="text" value={exp.name} onChange={e => updateExpense(exp.id, 'name', e.target.value)} 
                        className="flex-1 border border-slate-200 bg-slate-50/50 p-3 sm:p-4 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-violet-500/10 outline-none transition-all font-bold placeholder-slate-400" placeholder="খরচের বিবরণ..." />
                    <div className="flex gap-2">
                        <div className="relative flex-1 sm:w-36">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">৳</span>
                            <input type="number" value={exp.amount} onChange={e => updateExpense(exp.id, 'amount', Number(e.target.value))} 
                                className="w-full border border-slate-200 bg-slate-50/50 pl-8 pr-4 py-3 sm:py-4 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-violet-500/10 outline-none transition-all font-bold text-slate-700" placeholder="0" />
                        </div>
                        <button onClick={() => setPersonalData({...personalData, customExpenses: personalData.customExpenses.filter(e => e.id !== exp.id)})} 
                            className="p-3 sm:p-4 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100">
                            <Trash2 size={20} />
                        </button>
                    </div>
                </div>
            ))}
            
            <div className="border-t border-dashed border-slate-200 pt-6 mt-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-violet-50/50 p-5 rounded-3xl border border-violet-100 hover:bg-violet-50 transition-colors gap-3">
                    <label className="text-xs font-bold text-violet-700 uppercase tracking-wide flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg shadow-sm"><Wallet size={16}/></div> বুকিং মানি গ্রহণ (Host)
                    </label>
                    <div className="relative w-full sm:w-48">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-violet-400 text-sm font-bold">৳</span>
                        <input type="number" value={personalData.bookingFee} onChange={e => setPersonalData({...personalData, bookingFee: Number(e.target.value)})} 
                            className="w-full border-0 bg-white pl-10 pr-5 py-3 rounded-2xl text-lg text-right font-black text-violet-700 focus:ring-4 focus:ring-violet-200 outline-none transition-all shadow-sm" />
                    </div>
                </div>
            </div>
        </div>
      </div>

      {isAdmin && (
        <div className="relative rounded-[2.5rem] shadow-2xl shadow-slate-300/50 overflow-hidden mt-8 group transition-transform hover:scale-[1.01]">
            <div className="absolute inset-0 bg-slate-900"></div>
            <div className={`absolute inset-0 opacity-20 bg-gradient-to-br ${settlement.netResult >= 0 ? 'from-emerald-500 to-teal-500' : 'from-rose-500 to-orange-500'} transition-colors duration-500`}></div>
            
            <div className="relative p-8 sm:p-10 text-white">
                <div className="flex justify-between items-center mb-8 sm:mb-10 border-b border-white/10 pb-6">
                    <div>
                        <p className="text-[10px] text-white/60 uppercase tracking-[0.2em] mb-2 font-bold">ব্যক্তিগত ব্যালেন্স</p>
                        <h3 className="text-xl sm:text-2xl font-black tracking-tight">হিসাব বিবরণী</h3>
                    </div>
                    <div className="bg-white/10 p-3 sm:p-4 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg">
                        <Wallet size={32} className="text-white" />
                    </div>
                </div>

                <div className="space-y-4 sm:space-y-5 text-sm mb-8">
                    <div className="flex justify-between text-white/70">
                        <span className="font-bold">মোট আয় (প্যাকেজ + বুকিং)</span>
                        <span className="font-bold text-white font-mono text-base sm:text-lg">৳ {settlement.totalPersonalIncome.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-white/70">
                        <span className="font-bold">বাদ: শেয়ার খরচ</span>
                        <span className="font-bold text-orange-300 font-mono text-base sm:text-lg">- ৳ {settlement.hostShareOfBusRent.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-white/70">
                        <span className="font-bold">বাদ: ব্যক্তিগত খরচ</span>
                        <span className="font-bold text-rose-300 font-mono text-base sm:text-lg">- ৳ {settlement.personalExpenses.toLocaleString()}</span>
                    </div>
                </div>
                
                <div className="bg-white/10 p-5 sm:p-6 rounded-3xl border border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center backdrop-blur-md shadow-inner gap-2">
                    <span className="font-bold text-white text-xs uppercase tracking-widest flex items-center gap-2 opacity-80">
                        নেট লাভ / (লস) <ArrowRight size={16} className="opacity-50 hidden sm:block"/>
                    </span>
                    <span className={`text-3xl sm:text-4xl font-black tracking-tighter ${settlement.netResult >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                        {settlement.netResult >= 0 ? '+' : ''}{settlement.netResult.toLocaleString()} <span className="text-xl opacity-60 font-bold">৳</span>
                    </span>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default PersonalTab;