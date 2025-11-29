import React, { useState, useEffect } from 'react';
import { CommonTabProps, PersonalData } from '../types';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { calculatePersonalSettlement } from '../utils/calculations';
import { Save, PlusCircle, Trash2, Receipt, Minus, Plus, UserCircle, ChevronDown, Wallet, ArrowRight } from 'lucide-react';

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
    updatedAt: null
  });

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

  const updateCount = (field: keyof PersonalData, delta: number) => {
      const current = Number(personalData[field]) || 0;
      const newVal = Math.max(0, current + delta);
      setPersonalData({...personalData, [field]: newVal});
  };

  const settlement = calculatePersonalSettlement(activeTour || {} as any, personalData);

  if (!activeTour) return (
    <div className="h-full flex flex-col items-center justify-center p-10 text-center text-slate-400">
        <div className="bg-slate-100 p-6 rounded-full mb-4"><UserCircle size={32} /></div>
        <p className="font-bold text-sm">কোন ট্যুর ডাটা পাওয়া যায়নি</p>
    </div>
  );

  const CounterControl = ({ label, value, field }: { label: string, value: number, field: keyof PersonalData }) => (
    <div className="flex flex-col items-center bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-violet-100">
        <span className="text-[10px] text-slate-400 font-bold uppercase mb-4 tracking-widest">{label}</span>
        <div className="flex items-center gap-3 w-full justify-between bg-slate-50 p-1 rounded-xl border border-slate-100">
            <button 
                onClick={() => updateCount(field, -1)} 
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm border border-slate-200 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-all active:scale-95"
            >
                <Minus size={18} />
            </button>
            <span className="text-2xl font-black text-slate-800 w-8 text-center">{value || 0}</span>
            <button 
                onClick={() => updateCount(field, 1)} 
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-900 text-white shadow-md hover:bg-slate-800 transition-all active:scale-95"
            >
                <Plus size={18} />
            </button>
        </div>
    </div>
  );

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

      {/* Guest Counters */}
      <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-200/50">
        <h3 className="text-xs font-bold text-slate-500 mb-6 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span> আমার গেস্ট
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CounterControl label="রেগুলার গেস্ট" value={personalData.personalStandardCount} field="personalStandardCount" />
            <CounterControl label="ডিসকাউন্ট ১" value={personalData.personalDisc1Count} field="personalDisc1Count" />
            <CounterControl label="ডিসকাউন্ট ২" value={personalData.personalDisc2Count} field="personalDisc2Count" />
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
                        <Wallet size={14}/> বুকিং মানি গ্রহণ
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

      {/* Final Settlement Card */}
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
    </div>
  );
};

export default PersonalTab;