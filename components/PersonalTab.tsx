
import React, { useState, useEffect } from 'react';
import { CommonTabProps, PersonalData, Guest } from '../types';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { calculatePersonalSettlement, safeNum, recalculateTourSeats } from '../utils/calculations';
import { Save, PlusCircle, Trash2, Receipt, UserCircle, ChevronDown, Wallet, Users, Phone, Armchair, Settings, Calculator, Tag, MessageCircle, MapPin, Heart, Loader } from 'lucide-react';

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
  const [isSaving, setIsSaving] = useState(false); 
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  
  // New Guest Form State
  const [newGuest, setNewGuest] = useState({
      name: '',
      phone: '',
      address: '',
      isCouple: false,
      seatNumbers: '',
      // Seat Usage (Cost)
      seatReg: '',
      seatD1: '',
      seatD2: '',
      // Package/Fee (Income)
      feeReg: '',
      feeD1: '',
      feeD2: '',
      couplePrice: '', // Added for Couple Package Price
      manualCollection: '' // Used for manual override
  });

  // Effect to reset/force fields when isCouple changes
  useEffect(() => {
      if (newGuest.isCouple) {
          setNewGuest(prev => ({
              ...prev,
              seatReg: '2', // Force 2 regular seats
              seatD1: '0',
              seatD2: '0',
              feeReg: '', 
              feeD1: '',
              feeD2: '',
              manualCollection: '' // Reset collection
          }));
      } else {
          // Reset if unchecked (optional, but good UX)
          if (newGuest.seatReg === '2' && !newGuest.seatD1 && !newGuest.seatD2) {
               setNewGuest(prev => ({ ...prev, seatReg: '' }));
          }
      }
  }, [newGuest.isCouple]);

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

  // Manual Save (Used for Expenses/Pricing changes)
  const handleSave = async () => {
    if (!activeTour) return;
    setIsSaving(true);
    try {
      const docRef = doc(db, 'personal', `${activeTour.id}_${user.uid}`);
      await setDoc(docRef, { ...personalData, updatedAt: Timestamp.now() });
      await recalculateTourSeats(activeTour.id);
      alert("সেভ হয়েছে!");
      setShowPricingEdit(false);
    } catch (err) {
      console.error(err);
      alert("সেভ ব্যর্থ।");
    } finally {
      setIsSaving(false);
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

  const calculateNewGuestPayable = () => {
      if (newGuest.isCouple) {
          return safeNum(newGuest.couplePrice);
      }
      const fReg = safeNum(newGuest.feeReg);
      const fD1 = safeNum(newGuest.feeD1);
      const fD2 = safeNum(newGuest.feeD2);
      
      const fees = settlement.fees;
      return (fReg * fees.regFee) + (fD1 * fees.d1Fee) + (fD2 * fees.d2Fee);
  };

  const handleAddGuest = async () => {
      if(!activeTour) return;
      if(!newGuest.name) return;
      
      const sReg = safeNum(newGuest.seatReg);
      const sD1 = safeNum(newGuest.seatD1);
      const sD2 = safeNum(newGuest.seatD2);
      
      const totalSeats = sReg + sD1 + sD2;
      
      if (totalSeats === 0) {
          alert("কমপক্ষে ১টি সিট উল্লেখ করুন");
          return;
      }
      
      if (newGuest.isCouple && totalSeats !== 2) {
           alert("কাপল প্যাকেজের জন্য ২ জন গেস্ট (২ সিট) হতে হবে।");
           return;
      }
      
      if (newGuest.isCouple && !newGuest.couplePrice) {
           alert("কাপল প্যাকেজের প্রাইস উল্লেখ করুন।");
           return;
      }

      const calculatedBill = calculateNewGuestPayable();
      
      // Collection: If manual is entered, use that. Else default to bill amount.
      const actualCollection = (newGuest.manualCollection !== '') 
            ? safeNum(newGuest.manualCollection) 
            : calculatedBill;
      
      // Auto-format phone
      let formattedPhone = newGuest.phone.trim();
      if (formattedPhone.startsWith('01')) {
          formattedPhone = '+88' + formattedPhone;
      }

      // Construct Guest Object carefully to avoid undefined values
      const g: Guest = {
          id: Date.now().toString(),
          name: newGuest.name,
          phone: formattedPhone,
          address: newGuest.address || '',
          isCouple: newGuest.isCouple,
          seatCount: totalSeats,
          seatNumbers: newGuest.seatNumbers || '',
          unitPrice: 0, // Calculated/Derived
          collection: actualCollection, // PAID AMOUNT
          totalBillAmount: calculatedBill, // TOTAL PACKAGE PRICE
          seatType: 'regular',
          paxBreakdown: { regular: sReg, disc1: sD1, disc2: sD2 },
      };

      // Only add feeBreakdown if NOT couple. Firestore dislikes 'undefined'.
      if (!newGuest.isCouple) {
          g.feeBreakdown = { 
              regular: safeNum(newGuest.feeReg), 
              disc1: safeNum(newGuest.feeD1), 
              disc2: safeNum(newGuest.feeD2) 
          };
      }
      
      // AUTO SAVE IMPLEMENTATION
      setIsAutoSaving(true);
      try {
          // 1. Prepare updated data
          const updatedGuests = [...(personalData.guests || []), g];
          const updatedPersonalData = { ...personalData, guests: updatedGuests, updatedAt: Timestamp.now() };

          // 2. Save to Server FIRST
          const docRef = doc(db, 'personal', `${activeTour.id}_${user.uid}`);
          await setDoc(docRef, updatedPersonalData);
          
          // 3. Recalculate seats
          await recalculateTourSeats(activeTour.id);

          // 4. Update Local State on success
          setPersonalData(updatedPersonalData);
          setNewGuest({ 
              name: '', phone: '', address: '', isCouple: false, seatNumbers: '', 
              seatReg: '', seatD1: '', seatD2: '', 
              feeReg: '', feeD1: '', feeD2: '', 
              couplePrice: '',
              manualCollection: '' 
          });
          setIsAddingGuest(false);
          // Success message optional for auto-save, but good for feedback
          // alert("Guest Added Successfully!"); 
      } catch (err) {
          console.error(err);
          alert("গেস্ট যোগ করা ব্যর্থ হয়েছে। দয়া করে আবার চেষ্টা করুন।");
      } finally {
          setIsAutoSaving(false);
      }
  };
  
  const removeGuest = async (id: string) => {
      if(!activeTour) return;
      if(!window.confirm("মুছে ফেলবেন?")) return;
      
      setIsAutoSaving(true);
      try {
          // 1. Prepare updated data
          const updatedGuests = personalData.guests?.filter(g => g.id !== id) || [];
          const updatedPersonalData = { ...personalData, guests: updatedGuests, updatedAt: Timestamp.now() };

          // 2. Save to Server FIRST
          const docRef = doc(db, 'personal', `${activeTour.id}_${user.uid}`);
          await setDoc(docRef, updatedPersonalData);
          
          // 3. Recalculate seats
          await recalculateTourSeats(activeTour.id);

          // 4. Update Local State
          setPersonalData(updatedPersonalData);
      } catch (err) {
          console.error(err);
          alert("ডিলিট ব্যর্থ হয়েছে।");
      } finally {
          setIsAutoSaving(false);
      }
  };

  const handleSeatChange = (field: 'seatReg'|'seatD1'|'seatD2', val: string) => {
      setNewGuest(prev => {
          const next = { ...prev, [field]: val };
          if (field === 'seatReg' && prev.feeReg === '') next.feeReg = val;
          if (field === 'seatD1' && prev.feeD1 === '') next.feeD1 = val;
          if (field === 'seatD2' && prev.feeD2 === '') next.feeD2 = val;
          return next;
      });
  };

  const getWhatsAppLink = (phone: string) => {
      let p = phone.replace(/[^0-9]/g, '');
      if (p.startsWith('01')) p = '88' + p;
      return `https://wa.me/${p}`;
  };

  if (!activeTour) return <div className="p-10 text-center text-xs text-slate-400">লোড হচ্ছে...</div>;

  return (
    <div className="p-4 pb-24 lg:pb-10 max-w-2xl mx-auto font-sans space-y-3">
      {/* Selector */}
      <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 relative z-20">
        <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
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
      <div className="flex justify-between items-center bg-white/90 backdrop-blur-md p-2.5 rounded-2xl shadow-sm border border-slate-200 sticky top-4 z-10">
         <div className="flex items-center gap-2">
            <button 
                onClick={() => setShowPricingEdit(!showPricingEdit)} 
                className={`p-2 rounded-xl transition-colors border ${showPricingEdit ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-white border-slate-100 text-slate-500'}`}
            >
                <Settings size={14}/>
            </button>
            <div className="text-[10px] font-bold text-slate-500 flex flex-col">
                <span className="text-[8px] uppercase text-slate-400">নেট প্রফিট / লস</span>
                <span className={settlement.netResult >= 0 ? "text-emerald-600 font-black text-xs" : "text-rose-600 font-black text-xs"}>{settlement.netResult}৳</span>
            </div>
         </div>
         {/* Only show manual save for settings/expenses changes */}
         {showPricingEdit && (
             <button 
                onClick={handleSave} 
                disabled={isSaving}
                className="flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-xl font-bold shadow-md hover:bg-slate-800 active:scale-95 text-[10px] uppercase tracking-wider transition-all disabled:opacity-70"
             >
                {isSaving ? <Loader size={12} className="animate-spin" /> : <Save size={12} />} সেভ (Settings)
             </button>
         )}
      </div>

      {/* PRICING CONFIG */}
      {showPricingEdit && (
          <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 animate-fade-in">
              <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">প্যাকেজ মূল্য (Fee)</h3>
              <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <label className="text-[8px] font-bold text-slate-400 block mb-0.5">রেগুলার</label>
                      <input type="number" value={personalData.customPricing?.baseFee} onChange={e => setPersonalData({...personalData, customPricing: { ...personalData.customPricing!, baseFee: safeNum(e.target.value) }})} className="w-full bg-transparent text-xs font-black text-slate-700 outline-none border-b border-slate-200" />
                  </div>
                  <div className="bg-amber-50 p-2 rounded-xl border border-amber-100">
                      <label className="text-[8px] font-bold text-amber-600 block mb-0.5">ডিস ১ (ছাড়)</label>
                      <input type="number" value={personalData.customPricing?.d1Amount} onChange={e => setPersonalData({...personalData, customPricing: { ...personalData.customPricing!, d1Amount: safeNum(e.target.value) }})} className="w-full bg-transparent text-xs font-black text-amber-700 outline-none border-b border-amber-200" />
                  </div>
                  <div className="bg-orange-50 p-2 rounded-xl border border-orange-100">
                      <label className="text-[8px] font-bold text-orange-600 block mb-0.5">ডিস ২ (ছাড়)</label>
                      <input type="number" value={personalData.customPricing?.d2Amount} onChange={e => setPersonalData({...personalData, customPricing: { ...personalData.customPricing!, d2Amount: safeNum(e.target.value) }})} className="w-full bg-transparent text-xs font-black text-orange-700 outline-none border-b border-orange-200" />
                  </div>
              </div>
          </div>
      )}

      {/* GUEST LIST */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-700 text-[10px] uppercase tracking-widest flex items-center gap-1.5">
                <Users size={12} className="text-slate-400"/> গেস্ট ({personalData.guests?.length || 0})
            </h3>
            <button onClick={() => setIsAddingGuest(!isAddingGuest)} className="text-[9px] font-bold bg-white text-indigo-600 px-2.5 py-1.5 rounded-lg border border-indigo-100 shadow-sm flex items-center gap-1 hover:bg-indigo-50">
                <PlusCircle size={10}/> নতুন
            </button>
        </div>
        
        {isAddingGuest && (
            <div className="p-4 bg-slate-50 border-b border-slate-100 animate-fade-in space-y-3">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-2">
                    <input className="col-span-1 p-2 rounded-lg border border-slate-200 text-xs font-bold outline-none focus:border-indigo-400" value={newGuest.name} onChange={e => setNewGuest({...newGuest, name: e.target.value})} placeholder="নাম"/>
                    <input className="col-span-1 p-2 rounded-lg border border-slate-200 text-xs font-bold outline-none focus:border-indigo-400" value={newGuest.phone} onChange={e => setNewGuest({...newGuest, phone: e.target.value})} placeholder="মোবাইল (01...)"/>
                    <input className="col-span-2 p-2 rounded-lg border border-slate-200 text-xs font-bold outline-none focus:border-indigo-400" value={newGuest.address} onChange={e => setNewGuest({...newGuest, address: e.target.value})} placeholder="ঠিকানা"/>
                    <div className="col-span-1 flex items-center gap-2 bg-white px-2 rounded-lg border border-slate-200">
                         <input type="checkbox" checked={newGuest.isCouple} onChange={e => setNewGuest({...newGuest, isCouple: e.target.checked})} className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"/>
                         <label className="text-[10px] font-bold text-pink-500 uppercase">কাপল?</label>
                    </div>
                    <input className="col-span-1 p-2 rounded-lg border border-slate-200 text-xs font-bold outline-none focus:border-indigo-400" value={newGuest.seatNumbers} onChange={e => setNewGuest({...newGuest, seatNumbers: e.target.value})} placeholder="সিট#"/>
                </div>
                
                {/* Seat Allocation (Cost) - Hidden if Couple */}
                {!newGuest.isCouple && (
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <label className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                            <Armchair size={10} /> সিট বরাদ্দ (খরচ)
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            <input type="number" placeholder="Regular Seats" className="p-1.5 bg-slate-50 border border-slate-100 rounded text-center text-xs font-bold outline-none focus:bg-white focus:border-indigo-400" 
                                value={newGuest.seatReg} onChange={e => handleSeatChange('seatReg', e.target.value)}/>
                            <input type="number" placeholder="Disc1 Seats" className="p-1.5 bg-amber-50 border border-amber-100 rounded text-center text-xs font-bold outline-none focus:bg-white focus:border-amber-400" 
                                value={newGuest.seatD1} onChange={e => handleSeatChange('seatD1', e.target.value)}/>
                            <input type="number" placeholder="Disc2 Seats" className="p-1.5 bg-orange-50 border border-orange-100 rounded text-center text-xs font-bold outline-none focus:bg-white focus:border-orange-400" 
                                value={newGuest.seatD2} onChange={e => handleSeatChange('seatD2', e.target.value)}/>
                        </div>
                    </div>
                )}
                
                {/* Couple Package Input or Normal Package Input */}
                {newGuest.isCouple ? (
                    <div className="bg-pink-50 p-2.5 rounded-xl border border-pink-100 space-y-2">
                        <div className="text-[10px] font-bold text-pink-500 text-center">
                            কাপল: অটোমেটিক ২ জন রেগুলার গেস্ট (সিট) হিসেবে গণ্য হবে।
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-pink-400 uppercase flex items-center gap-1 mb-1">
                                <Tag size={10} /> কাপল প্যাকেজ প্রাইস (Total Bill)
                            </label>
                            <input type="number" placeholder="Total Package Amount" className="w-full p-2 bg-white border border-pink-200 rounded-lg text-center text-sm font-bold text-pink-600 outline-none focus:ring-2 focus:ring-pink-300"
                                value={newGuest.couplePrice} onChange={e => setNewGuest({...newGuest, couplePrice: e.target.value})} />
                        </div>
                    </div>
                ) : (
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <label className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                            <Tag size={10} /> বিল প্যাকেজ (আয়)
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            <input type="number" placeholder="Reg Pkg" className="p-1.5 bg-slate-50 border border-slate-100 rounded text-center text-xs font-bold outline-none focus:bg-white focus:border-emerald-400" 
                                value={newGuest.feeReg} onChange={e => setNewGuest({...newGuest, feeReg: e.target.value})}/>
                            <input type="number" placeholder="Disc1 Pkg" className="p-1.5 bg-amber-50 border border-amber-100 rounded text-center text-xs font-bold outline-none focus:bg-white focus:border-amber-400" 
                                value={newGuest.feeD1} onChange={e => setNewGuest({...newGuest, feeD1: e.target.value})}/>
                            <input type="number" placeholder="Disc2 Pkg" className="p-1.5 bg-orange-50 border border-orange-100 rounded text-center text-xs font-bold outline-none focus:bg-white focus:border-orange-400" 
                                value={newGuest.feeD2} onChange={e => setNewGuest({...newGuest, feeD2: e.target.value})}/>
                        </div>
                    </div>
                )}

                {/* Total & Manual Override - Unified for both */}
                <div className="flex justify-between items-center px-1">
                    <div className="text-[10px] font-bold text-slate-500">
                        {newGuest.isCouple ? 'প্যাকেজ:' : 'বিল:'} <span className="text-emerald-600 text-xs">৳{calculateNewGuestPayable()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">
                                {newGuest.isCouple ? 'কালেকশন (জমা):' : 'ম্যানুয়াল (জমা):'}
                            </span>
                            <input 
                            type="number" 
                            placeholder="Amount" 
                            className="w-24 p-1.5 rounded-lg border border-slate-200 text-[10px] font-bold text-right outline-none focus:border-emerald-400"
                            value={newGuest.manualCollection}
                            onChange={e => setNewGuest({...newGuest, manualCollection: e.target.value})}
                            />
                    </div>
                </div>

                <div className="flex gap-2 pt-1">
                    <button onClick={() => setIsAddingGuest(false)} className="flex-1 py-2 rounded-xl text-[10px] font-bold bg-white border border-slate-200 text-slate-500 hover:bg-slate-50">বাতিল</button>
                    <button onClick={handleAddGuest} disabled={isAutoSaving} className="flex-1 py-2 rounded-xl text-[10px] font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-70 flex justify-center items-center gap-1">
                        {isAutoSaving && <Loader size={12} className="animate-spin"/>} যোগ করুন
                    </button>
                </div>
            </div>
        )}
        
        {(!personalData.guests || personalData.guests.length === 0) ? (
             <div className="p-6 text-center text-slate-300 text-[10px] font-bold italic">কোনো গেস্ট নেই</div>
        ) : (
            <div className="divide-y divide-slate-50">
                {personalData.guests.map((g, i) => (
                    <div key={g.id} className="p-2.5 hover:bg-slate-50 transition-colors flex justify-between items-start gap-2 group">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[9px] font-bold text-slate-300 w-3">{i+1}.</span>
                                <p className="font-bold text-slate-700 text-xs truncate">{g.name}</p>
                                {g.isCouple && (
                                    <span className="text-[8px] font-bold text-white bg-pink-500 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Heart size={8} fill="currentColor"/> Couple</span>
                                )}
                            </div>
                            <div className="flex flex-col ml-5 gap-1">
                                {g.phone && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-500">{g.phone}</span>
                                        <div className="flex gap-1.5">
                                            <a href={`tel:${g.phone}`} className="text-[10px] text-white font-bold bg-emerald-500 px-2 py-1 rounded shadow-sm hover:bg-emerald-600 transition-all flex items-center gap-1" title="Call">
                                                <Phone size={10}/> Call
                                            </a>
                                            <a href={getWhatsAppLink(g.phone)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-white font-bold bg-green-500 px-2 py-1 rounded shadow-sm hover:bg-green-600 transition-all flex items-center gap-1" title="WhatsApp">
                                                <MessageCircle size={10}/> WA
                                            </a>
                                        </div>
                                    </div>
                                )}
                                {g.seatNumbers && <span className="text-[9px] text-violet-500 font-bold bg-violet-50 px-1 rounded flex items-center gap-0.5 w-fit"><Armchair size={8}/> {g.seatNumbers}</span>}
                                {g.address && (
                                    <div className="flex items-center gap-1 text-[9px] text-slate-500 font-bold">
                                        <MapPin size={10} className="text-slate-400"/> {g.address}
                                    </div>
                                )}
                            </div>
                            
                            <div className="ml-5 flex gap-2 mt-1.5">
                                {/* Seat Usage Badge */}
                                {g.paxBreakdown && (
                                    <div className="flex gap-0.5">
                                        <span className="text-[8px] font-bold text-slate-400 uppercase mr-0.5">Seat:</span>
                                        {g.paxBreakdown.regular > 0 && <span className="text-[8px] font-bold bg-slate-100 text-slate-600 px-1 rounded">R:{g.paxBreakdown.regular}</span>}
                                        {g.paxBreakdown.disc1 > 0 && <span className="text-[8px] font-bold bg-slate-100 text-slate-600 px-1 rounded">D1:{g.paxBreakdown.disc1}</span>}
                                        {g.paxBreakdown.disc2 > 0 && <span className="text-[8px] font-bold bg-slate-100 text-slate-600 px-1 rounded">D2:{g.paxBreakdown.disc2}</span>}
                                    </div>
                                )}
                                {/* Fee Package Badge */}
                                {g.feeBreakdown && !g.isCouple && (
                                    <div className="flex gap-0.5">
                                        <span className="text-[8px] font-bold text-emerald-400 uppercase mr-0.5">Pkg:</span>
                                        {g.feeBreakdown.regular > 0 && <span className="text-[8px] font-bold bg-emerald-50 text-emerald-600 px-1 rounded">R:{g.feeBreakdown.regular}</span>}
                                        {g.feeBreakdown.disc1 > 0 && <span className="text-[8px] font-bold bg-emerald-50 text-emerald-600 px-1 rounded">D1:{g.feeBreakdown.disc1}</span>}
                                        {g.feeBreakdown.disc2 > 0 && <span className="text-[8px] font-bold bg-emerald-50 text-emerald-600 px-1 rounded">D2:{g.feeBreakdown.disc2}</span>}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                             {/* Show Total Bill if exists (Package Price) */}
                             {g.totalBillAmount && g.totalBillAmount !== g.collection && (
                                 <span className="text-[9px] font-bold text-slate-400">Bill: ৳{g.totalBillAmount}</span>
                             )}
                             <p className="font-black text-emerald-600 text-xs">Paid: ৳{g.collection}</p>
                             <button onClick={() => removeGuest(g.id)} disabled={isAutoSaving} className="mt-1 p-1 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded transition-all"><Trash2 size={12}/></button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Expenses */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
        <div className="flex justify-between items-center mb-2">
            <h3 className="text-[10px] font-bold text-orange-600 uppercase tracking-widest flex items-center gap-1.5">
                <Receipt size={12} /> ব্যক্তিগত খরচ
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
                    <input className="w-16 bg-slate-50 p-2 rounded-lg text-[10px] font-bold text-center outline-none border border-slate-100 focus:bg-white focus:border-slate-300" 
                        type="number" value={exp.amount} onChange={e => updateExpense(exp.id, 'amount', Number(e.target.value))} placeholder="0" />
                    <button onClick={() => setPersonalData({...personalData, customExpenses: personalData.customExpenses.filter(e => e.id !== exp.id)})} 
                        className="p-1.5 text-slate-300 hover:text-rose-500"><Trash2 size={12} /></button>
                </div>
            ))}
            <div className="pt-2 mt-2 border-t border-slate-50 flex justify-between items-center">
                 <label className="text-[9px] font-bold text-violet-600 uppercase flex items-center gap-1"><Wallet size={12}/> বুকিং মানি গ্রহণ</label>
                 <input className="w-20 bg-violet-50 p-1.5 rounded-lg text-xs font-black text-right text-violet-700 outline-none border-none" 
                    type="number" value={personalData.bookingFee} onChange={e => setPersonalData({...personalData, bookingFee: Number(e.target.value)})} placeholder="0"/>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalTab;
