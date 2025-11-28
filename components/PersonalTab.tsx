
import React, { useState, useEffect } from 'react';
import { CommonTabProps, PersonalData } from '../types';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { calculatePersonalSettlement } from '../utils/calculations';
import { Save, PlusCircle, Trash2, Receipt, Minus, Plus, UserCircle, ChevronDown, Wallet } from 'lucide-react';

const PersonalTab: React.FC<CommonTabProps> = ({ user, tours }) => {
  // 1. ALL HOOKS MUST BE AT THE TOP LEVEL (Before any return statement)
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  
  // Initial empty state to satisfy hook rules
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

  // Tour Selection Effect
  useEffect(() => {
    if (tours.length > 0 && !selectedTourId) {
        setSelectedTourId(tours[0].id);
    }
  }, [tours, selectedTourId]);

  const activeTour = tours.find(t => t.id === selectedTourId) || null;

  // Data Fetching Effect
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
             // Reset to default for this tour
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

  // 2. Logic & Event Handlers
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

  // 3. Conditional Rendering (After all hooks)
  if (!activeTour) return (
    <div className="h-full flex flex-col items-center justify-center p-10 text-center text-slate-400">
        <div className="bg-slate-100 p-6 rounded-full mb-4"><UserCircle size={32} /></div>
        <p className="font-bold text-sm">কোন ট্যুর ডাটা পাওয়া যায়নি</p>
    </div>
  );

  const CounterControl = ({ label, value, field }: { label: string, value: number, field: keyof PersonalData }) => (
    <div className="flex flex-col items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm">
        <span className="text-[10px] text-slate-400 font-bold uppercase mb-3 tracking-wide">{label}</span>
        <div className="flex items-center gap-4">
            <button onClick={() => updateCount(field, -1)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 shadow-sm transition-all active:scale-90">
                <Minus size={16} />
            </button>
            <span className="text-2xl font-black text-slate-800 w-8 text-center">{value || 0}</span>
            <button onClick={() => updateCount(field, 1)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 shadow-sm transition-all active:scale-90">
                <Plus size={16} />
            </button>
        </div>
    </div>
  );

  return (
    <div className="p-4 space-y-6 animate-fade-in pb-24 lg:pb-10 max-w-3xl mx-auto">
      {/* Selector */}
      <div className="mb-6">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Select Tour</label>
        <div className="relative">
            <select 
                value={selectedTourId}
                onChange={(e) => setSelectedTourId(e.target.value)}
                className="w-full appearance-none bg-white border-2 border-slate-200 text-slate-800 py-4 pl-5 pr-12 rounded-2xl text-lg font-black focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all shadow-sm"
            >
                {tours.map(t => <option key={t.id} value={t.id}>{t.name} ({t.date})</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={24} strokeWidth={2.5} />
        </div>
      </div>

      <div className="flex justify-between items-center bg-white/80 backdrop-blur p-4 rounded-2xl shadow-sm border border-slate-100">
        <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Personal Manager</p>
        </div>
        <button onClick={handleSave} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-slate-200 transition-all active:scale-95 text-sm uppercase tracking-wide">
            <Save size={16} /> সেভ
        </button>
      </div>

      <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100">
        <h3 className="text-xs font-bold text-violet-600 mb-6 uppercase tracking-widest flex items-center gap-2">
            <UserCircle size={14} /> আমার গেস্ট (Own Guests)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CounterControl label="রেগুলার গেস্ট" value={personalData.personalStandardCount} field="personalStandardCount" />
            <CounterControl label="ডিসকাউন্ট ১" value={personalData.personalDisc1Count} field="personalDisc1Count" />
            <CounterControl label="ডিসকাউন্ট ২" value={personalData.personalDisc2Count} field="personalDisc2Count" />
        </div>
      </div>

      <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-bold text-orange-600 uppercase tracking-widest flex items-center gap-2">
                <Receipt size={14} /> আমি খরচ করেছি
            </h3>
            <button onClick={addExpense} className="text-slate-600 text-xs flex items-center font-bold bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors">
                <PlusCircle size={14} className="mr-1.5"/> খরচ যোগ
            </button>
        </div>
        <div className="space-y-3">
            {(!personalData.customExpenses || personalData.customExpenses.length === 0) && (
                <p className="text-xs text-slate-400 text-center py-6 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200 font-medium">কোন অতিরিক্ত খরচ যোগ করা হয়নি</p>
            )}
            {personalData.customExpenses && personalData.customExpenses.map(exp => (
                <div key={exp.id} className="flex gap-2 items-center animate-fade-in group">
                    <input type="text" value={exp.name} onChange={e => updateExpense(exp.id, 'name', e.target.value)} 
                        className="flex-1 border border-slate-200 bg-slate-50 p-3 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-violet-500 outline-none transition-all font-medium placeholder-slate-400" placeholder="বিবরণ" />
                    <div className="relative w-28">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">৳</span>
                        <input type="number" value={exp.amount} onChange={e => updateExpense(exp.id, 'amount', Number(e.target.value))} 
                            className="w-full border border-slate-200 bg-slate-50 pl-6 pr-3 py-3 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-violet-500 outline-none transition-all font-bold text-slate-700" placeholder="0" />
                    </div>
                    <button onClick={() => setPersonalData({...personalData, customExpenses: personalData.customExpenses.filter(e => e.id !== exp.id)})} 
                        className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-100">
                        <Trash2 size={16} />
                    </button>
                </div>
            ))}
            <div className="border-t border-dashed border-slate-200 pt-5 mt-4">
                <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-500 uppercase">বুকিং মানি গ্রহণ</label>
                    <div className="relative w-36">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">৳</span>
                        <input type="number" value={personalData.bookingFee} onChange={e => setPersonalData({...personalData, bookingFee: Number(e.target.value)})} 
                            className="w-full border border-violet-100 bg-violet-50 pl-7 pr-4 py-3 rounded-xl text-sm text-right font-bold text-violet-700 focus:ring-2 focus:ring-violet-500 outline-none transition-all" />
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Final Settlement Card */}
      <div className="relative bg-white rounded-[1.5rem] shadow-xl overflow-hidden border border-slate-200 mt-4">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500"></div>
          <div className="p-6">
            <div className="flex justify-between items-end mb-6 border-b border-slate-100 pb-4">
                <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 font-bold">PROFIT / LOSS</p>
                    <h3 className="text-lg font-black text-slate-800">ব্যক্তিগত হিসাব</h3>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl text-slate-400 border border-slate-100">
                    <Wallet size={24} />
                </div>
            </div>

            <div className="space-y-3 text-sm">
                <div className="flex justify-between text-slate-600">
                    <span className="font-medium">মোট আয় (আমার কালেকশন)</span>
                    <span className="font-bold text-slate-800 font-mono">৳ {settlement.totalPersonalIncome.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                    <span className="font-medium">বাদ: আমার পকেট খরচ</span>
                    <span className="font-bold text-rose-500 font-mono">- ৳ {settlement.personalExpenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                    <span className="font-medium">বাদ: ট্যুরে আমার শেয়ার</span>
                    <span className="font-bold text-orange-500 font-mono">- ৳ {settlement.hostShareOfBusRent.toLocaleString()}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4 flex justify-between items-center">
                    <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">নেট লাভ / (লস)</span>
                    <span className={`text-xl font-black tracking-tight ${settlement.netResult >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {settlement.netResult >= 0 ? '+' : ''}{settlement.netResult.toLocaleString()} ৳
                    </span>
                </div>
            </div>
          </div>
      </div>
    </div>
  );
};

export default PersonalTab;
