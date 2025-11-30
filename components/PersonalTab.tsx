

import React, { useState, useEffect } from 'react';
import { CommonTabProps, PersonalData, Guest } from '../types';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { calculatePersonalSettlement, safeNum } from '../utils/calculations';
import { Save, PlusCircle, Trash2, Receipt, UserCircle, ChevronDown, Wallet, ArrowRight, UserPlus, Phone, Armchair, Tag, Settings, Calculator, Users } from 'lucide-react';

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
    customPricing: { baseFee: 0, d1Amount: 0, d2Amount: 0 },
    updatedAt: null
  });

  const [isAddingGuest, setIsAddingGuest] = useState(false);
  const [showPricingEdit, setShowPricingEdit] = useState(false);
  
  // New Guest Form State
  const [newGuest, setNewGuest] = useState({
      name: '',
      phone: '',
      seatNumbers: '',
      regCount: '',
      d1Count: '',
      d2Count: '',
      manualCollection: '' // Optional override
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
          if (!data.guests) data.guests = [];
          
          if (!data.customPricing) {
              data.customPricing = {
                  baseFee: safeNum(activeTour.fees?.regular),
                  d1Amount: safeNum(activeTour.busConfig?.discount1Amount),
                  d2Amount: safeNum(activeTour.busConfig?.discount2Amount)
              };
          }
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
                customPricing: {
                    baseFee: safeNum(activeTour.fees?.regular),
                    d1Amount: safeNum(activeTour.busConfig?.discount1Amount),
                    d2Amount: safeNum(activeTour.busConfig?.discount2Amount)
                },
                updatedAt: null
             });
        }
      } catch (err) {
        console.error("Error fetching personal data", err);
      }
    };
    fetchPersonalData();
  }, [activeTour, user.uid]);

  const settlement = calculatePersonalSettlement(activeTour || {} as any, personalData);

  // Sync summary counters for display
  useEffect(() => {
      if(personalData.guests) {
          const currentD1 = personalData.guests.reduce((sum, g) => sum + (g.paxBreakdown?.disc1 || 0), 0);
          const currentD2 = personalData.guests.reduce((sum, g) => sum + (g.paxBreakdown?.disc2 || 0), 0);
          const currentReg = personalData.guests.reduce((sum, g) => sum + (g.paxBreakdown?.regular || 0), 0);
          
          if (currentReg !== personalData.personalStandardCount || currentD1 !== personalData.personalDisc1Count || currentD2 !== personalData.personalDisc2Count) {
             setPersonalData(prev => ({
                 ...prev, 
                 personalStandardCount: currentReg,
                 personalDisc1Count: currentD1,
                 personalDisc2Count: currentD2
             }));
          }
      }
  }, [personalData.guests]);


  const handleSave = async () => {
    if (!activeTour) return;
    try {
      const docRef = doc(db, 'personal', `${activeTour.id}_${user.uid}`);
      await setDoc(docRef, { ...personalData, updatedAt: Timestamp.now() });
      alert("সেভ হয়েছে!");
      setShowPricingEdit(false);
    } catch (err) {
      console.error(err);
      alert("সেভ ব্যর্থ।");
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

  // --- NEW GUEST LOGIC ---
  const calculateNewGuestPayable = () => {
      const reg = safeNum(newGuest.regCount);
      const d1 = safeNum(newGuest.d1Count);
      const d2 = safeNum(newGuest.d2Count);
      
      const fees = settlement.fees;
      return (reg * fees.regFee) + (d1 * fees.d1Fee) + (d2 * fees.d2Fee);
  };

  const handleAddGuest = () => {
      if(!newGuest.name) return;
      
      const reg = safeNum(newGuest.regCount);
      const d1 = safeNum(newGuest.d1Count);
      const d2 = safeNum(newGuest.d2Count);
      const totalSeats = reg + d1 + d2;
      
      if (totalSeats === 0) {
          alert("কমপক্ষে ১ জন গেস্ট দিন");
          return;
      }

      const calculatedCollection = calculateNewGuestPayable();
      const finalCollection = newGuest.manualCollection ? safeNum(newGuest.manualCollection) : calculatedCollection;
      
      const g: Guest = {
          id: Date.now().toString(),
          name: newGuest.name,
          phone: newGuest.phone,
          seatCount: totalSeats,
          seatNumbers: newGuest.seatNumbers,
          unitPrice: 0, // Not used in new logic, collection is primary
          collection: finalCollection,
          seatType: 'regular', // Legacy fallback
          paxBreakdown: { regular: reg, disc1: d1, disc2: d2 }
      };
      
      setPersonalData({...personalData, guests: [...(personalData.guests || []), g]});
      setNewGuest({ name: '', phone: '', seatNumbers: '', regCount: '', d1Count: '', d2Count: '', manualCollection: '' });
      setIsAddingGuest(false);
  };
  
  const removeGuest = (id: string) => {
      if(!window.confirm("মুছে ফেলবেন?")) return;
      setPersonalData({...personalData, guests: personalData.guests?.filter(g => g.id !== id)});
  };

  if (!activeTour) return <div className="p-10 text-center text-xs text-slate-400">লোড হচ্ছে...</div>;
  const isAdmin = user.role === 'admin';

  return (
    <div className="p-4 pb-24 lg:pb-10 max-w-2xl mx-auto font-sans space-y-4">
      {/* Selector */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 relative z-20">
        <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
            <UserCircle size={16} />
        </div>
        <div className="flex-1 min-w-0">
            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">পার্সোনাল হিসাব</label>
            <div className="relative">
                <select 
                    value={selectedTourId}
                    onChange={(e) => setSelectedTourId(e.target.value)}
                    className="w-full appearance-none bg-transparent text-slate-800 text-sm font-black focus:outline-none cursor-pointer pr-6 truncate"
                >
                    {tours.map(t => <option key={t.id} value={t.id}>{t.name} ({t.date})</option>)}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex justify-between items-center bg-white/80 backdrop-blur-md p-3 rounded-2xl shadow-sm border border-slate-200 sticky top-4 z-10">
         <div className="flex items-center gap-2">
            <button 
                onClick={() => setShowPricingEdit(!showPricingEdit)} 
                className={`p-2 rounded-xl transition-colors border ${showPricingEdit ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-white border-slate-100 text-slate-500'}`}
            >
                <Settings size={16}/>
            </button>
            <div className="text-[10px] font-bold text-slate-500">
                <span className="block text-[8px] uppercase text-slate-400">মোট লাভ/লস</span>
                <span className={settlement.netResult >= 0 ? "text-emerald-600" : "text-rose-600"}>{settlement.netResult}৳</span>
            </div>
         </div>
         <button 
            onClick={handleSave} 
            className="flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-xl font-bold shadow-md hover:bg-slate-800 active:scale-95 text-[10px] uppercase tracking-wider transition-all"
         >
            <Save size={14} /> সেভ
         </button>
      </div>

      {/* PRICING CONFIG */}
      {showPricingEdit && (
          <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 animate-fade-in">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">প্যাকেজ মূল্য নির্ধারণ</h3>
              <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <label className="text-[8px] font-bold text-slate-400 block mb-1">রেগুলার</label>
                      <input type="number" value={personalData.customPricing?.baseFee} onChange={e => setPersonalData({...personalData, customPricing: { ...personalData.customPricing!, baseFee: safeNum(e.target.value) }})} className="w-full bg-transparent text-sm font-black text-slate-700 outline-none border-b border-slate-200" />
                  </div>
                  <div className="bg-amber-50 p-2 rounded-xl border border-amber-100">
                      <label className="text-[8px] font-bold text-amber-600 block mb-1">ডিস ১ (ছাড়)</label>
                      <input type="number" value={personalData.customPricing?.d1Amount} onChange={e => setPersonalData({...personalData, customPricing: { ...personalData.customPricing!, d1Amount: safeNum(e.target.value) }})} className="w-full bg-transparent text-sm font-black text-amber-700 outline-none border-b border-amber-200" />
                  </div>
                  <div className="bg-orange-50 p-2 rounded-xl border border-orange-100">
                      <label className="text-[8px] font-bold text-orange-600 block mb-1">ডিস ২ (ছাড়)</label>
                      <input type="number" value={personalData.customPricing?.d2Amount} onChange={e => setPersonalData({...personalData, customPricing: { ...personalData.customPricing!, d2Amount: safeNum(e.target.value) }})} className="w-full bg-transparent text-sm font-black text-orange-700 outline-none border-b border-orange-200" />
                  </div>
              </div>
          </div>
      )}

      {/* GUEST LIST */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-700 text-[10px] uppercase tracking-widest flex items-center gap-1.5">
                <Users size={14} className="text-slate-400"/> গেস্ট ({personalData.guests?.length || 0})
            </h3>
            <button onClick={() => setIsAddingGuest(!isAddingGuest)} className="text-[9px] font-bold bg-white text-indigo-600 px-3 py-1.5 rounded-lg border border-indigo-100 shadow-sm flex items-center gap-1 hover:bg-indigo-50">
                <PlusCircle size={12}/> নতুন
            </button>
        </div>
        
        {isAddingGuest && (
            <div className="p-4 bg-slate-50 border-b border-slate-100 animate-fade-in">
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <input className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold outline-none" value={newGuest.name} onChange={e => setNewGuest({...newGuest, name: e.target.value})} placeholder="নাম"/>
                    <input className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold outline-none" value={newGuest.phone} onChange={e => setNewGuest({...newGuest, phone: e.target.value})} placeholder="মোবাইল"/>
                    <input className="col-span-2 w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold outline-none" value={newGuest.seatNumbers} onChange={e => setNewGuest({...newGuest, seatNumbers: e.target.value})} placeholder="সিট নম্বর (A1, B2)"/>
                </div>
                
                <div className="bg-white p-3 rounded-xl border border-slate-200 mb-3">
                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-2">প্যাকেজ ও সিট ব্রেকডাউন</label>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                            <span className="text-[8px] font-bold text-slate-500 block">রেগুলার</span>
                            <input type="number" placeholder="0" className="w-full bg-transparent text-center font-bold text-sm outline-none" value={newGuest.regCount} onChange={e => setNewGuest({...newGuest, regCount: e.target.value})}/>
                        </div>
                        <div className="bg-amber-50 p-2 rounded-lg border border-amber-100 text-center">
                            <span className="text-[8px] font-bold text-amber-600 block">ডিস ১</span>
                            <input type="number" placeholder="0" className="w-full bg-transparent text-center font-bold text-sm outline-none text-amber-700" value={newGuest.d1Count} onChange={e => setNewGuest({...newGuest, d1Count: e.target.value})}/>
                        </div>
                        <div className="bg-orange-50 p-2 rounded-lg border border-orange-100 text-center">
                            <span className="text-[8px] font-bold text-orange-600 block">ডিস ২</span>
                            <input type="number" placeholder="0" className="w-full bg-transparent text-center font-bold text-sm outline-none text-orange-700" value={newGuest.d2Count} onChange={e => setNewGuest({...newGuest, d2Count: e.target.value})}/>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center mb-4 px-1">
                    <div className="text-[10px] font-bold text-slate-500">
                        মোট পেয়েবল: <span className="text-emerald-600 text-xs">৳{calculateNewGuestPayable()}</span>
                    </div>
                    <div className="w-28">
                         <input 
                            type="number" 
                            placeholder="ম্যানুয়াল এমাউন্ট" 
                            className="w-full p-1.5 rounded-lg border border-slate-200 text-[10px] font-bold text-right outline-none focus:border-emerald-400"
                            value={newGuest.manualCollection}
                            onChange={e => setNewGuest({...newGuest, manualCollection: e.target.value})}
                         />
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={() => setIsAddingGuest(false)} className="flex-1 py-2 rounded-xl text-[10px] font-bold bg-white border border-slate-200 text-slate-500">বাতিল</button>
                    <button onClick={handleAddGuest} className="flex-1 py-2 rounded-xl text-[10px] font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-200">যোগ করুন</button>
                </div>
            </div>
        )}
        
        {(!personalData.guests || personalData.guests.length === 0) ? (
             <div className="p-8 text-center text-slate-300 text-[10px] font-bold italic">কোনো গেস্ট নেই</div>
        ) : (
            <div className="divide-y divide-slate-50">
                {personalData.guests.map((g, i) => (
                    <div key={g.id} className="p-3 hover:bg-slate-50 transition-colors flex justify-between items-center gap-2 group">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold text-slate-400 w-4">{i+1}.</span>
                                <p className="font-bold text-slate-700 text-xs truncate">{g.name}</p>
                            </div>
                            <div className="flex items-center gap-2 ml-6">
                                <span className="text-[9px] text-slate-400 font-bold bg-slate-50 px-1.5 rounded border border-slate-100 flex items-center gap-1"><Phone size={8}/> {g.phone}</span>
                                {g.seatNumbers && <span className="text-[9px] text-violet-500 font-bold bg-violet-50 px-1.5 rounded border border-violet-100">{g.seatNumbers}</span>}
                            </div>
                            {g.paxBreakdown && (
                                <div className="flex gap-1 ml-6 mt-1.5">
                                    {g.paxBreakdown.regular > 0 && <span className="text-[8px] font-bold bg-slate-100 text-slate-600 px-1 rounded">Reg:{g.paxBreakdown.regular}</span>}
                                    {g.paxBreakdown.disc1 > 0 && <span className="text-[8px] font-bold bg-amber-50 text-amber-600 px-1 rounded">D1:{g.paxBreakdown.disc1}</span>}
                                    {g.paxBreakdown.disc2 > 0 && <span className="text-[8px] font-bold bg-orange-50 text-orange-600 px-1 rounded">D2:{g.paxBreakdown.disc2}</span>}
                                </div>
                            )}
                        </div>
                        <div className="text-right">
                             <p className="font-black text-emerald-600 text-xs">৳{g.collection}</p>
                             <button onClick={() => removeGuest(g.id)} className="mt-1 p-1.5 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded transition-all"><Trash2 size={12}/></button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Expenses */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="flex justify-between items-center mb-3">
            <h3 className="text-[10px] font-bold text-orange-600 uppercase tracking-widest flex items-center gap-2">
                <Receipt size={14} /> ব্যক্তিগত খরচ
            </h3>
            <button onClick={addExpense} className="text-[9px] font-bold bg-slate-50 text-slate-600 px-2 py-1 rounded border border-slate-200 hover:bg-white flex items-center gap-1">
                <PlusCircle size={10}/> যোগ
            </button>
        </div>
        
        <div className="space-y-2">
            {personalData.customExpenses?.map(exp => (
                <div key={exp.id} className="flex items-center gap-2">
                    <input className="flex-1 bg-slate-50 p-2 rounded-lg text-[10px] font-bold outline-none border border-slate-100 focus:bg-white focus:border-slate-300" 
                        value={exp.name} onChange={e => updateExpense(exp.id, 'name', e.target.value)} placeholder="বিবরণ..." />
                    <input className="w-20 bg-slate-50 p-2 rounded-lg text-[10px] font-bold text-center outline-none border border-slate-100 focus:bg-white focus:border-slate-300" 
                        type="number" value={exp.amount} onChange={e => updateExpense(exp.id, 'amount', Number(e.target.value))} placeholder="0" />
                    <button onClick={() => setPersonalData({...personalData, customExpenses: personalData.customExpenses.filter(e => e.id !== exp.id)})} 
                        className="p-2 text-slate-300 hover:text-rose-500"><Trash2 size={12} /></button>
                </div>
            ))}
            <div className="pt-3 mt-2 border-t border-slate-50 flex justify-between items-center">
                 <label className="text-[9px] font-bold text-violet-600 uppercase flex items-center gap-1.5"><Wallet size={12}/> বুকিং মানি গ্রহণ</label>
                 <input className="w-24 bg-violet-50 p-2 rounded-lg text-xs font-black text-right text-violet-700 outline-none border-none" 
                    type="number" value={personalData.bookingFee} onChange={e => setPersonalData({...personalData, bookingFee: Number(e.target.value)})} placeholder="0"/>
            </div>
        </div>
      </div>

      {isAdmin && (
        <div className={`rounded-2xl p-5 text-white shadow-lg ${settlement.netResult >= 0 ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-rose-500 to-orange-600'}`}>
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-[8px] font-bold uppercase tracking-widest opacity-80 mb-1">নেট প্রফিট / লস</p>
                    <h3 className="text-3xl font-black tracking-tight">{settlement.netResult}৳</h3>
                </div>
                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm"><Calculator size={16}/></div>
            </div>
            <div className="space-y-1 text-[10px] font-medium opacity-90 border-t border-white/20 pt-2">
                <div className="flex justify-between"><span>মোট আয়</span> <span>৳ {settlement.totalPersonalIncome}</span></div>
                <div className="flex justify-between"><span>সিট খরচ (Buy Rate)</span> <span>- ৳ {settlement.totalPersonalCost}</span></div>
                <div className="flex justify-between"><span>অন্যান্য খরচ</span> <span>- ৳ {settlement.personalExpenses}</span></div>
            </div>
        </div>
      )}
    </div>
  );
};

export default PersonalTab;
