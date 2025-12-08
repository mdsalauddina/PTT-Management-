

import React, { useState, useEffect } from 'react';
import { CommonTabProps, PersonalData, SettlementStatus } from '../types';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { Wallet, ChevronDown, TrendingUp, TrendingDown, Receipt, DollarSign, Building, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { calculateTotalDailyExpenses, calculateTotalOtherFixedCosts, safeNum } from '../utils/calculations';

const HostSettlement: React.FC<CommonTabProps> = ({ user, tours, refreshTours }) => {
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  const [personalCollection, setPersonalCollection] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (tours.length > 0 && !selectedTourId) {
        setSelectedTourId(tours[0].id);
    }
  }, [tours, selectedTourId]);

  const activeTour = tours.find(t => t.id === selectedTourId) || null;

  useEffect(() => {
    if (!activeTour) return;
    const fetchAggregatedPersonalData = async () => {
      try {
        const q = query(collection(db, 'personal'), where('tourId', '==', activeTour.id));
        const snapshot = await getDocs(q);
        
        let totalCollection = 0;
        
        snapshot.forEach((doc) => {
            const data = doc.data() as PersonalData;
            totalCollection += safeNum(data.bookingFee);
            if (data.guests && data.guests.length > 0) {
                data.guests.forEach(g => {
                   // Host Settlement Logic: 
                   // Only count collection if guest is RECEIVED. 
                   // Ignore absent guests (Penalty is not handled by Host in this settlement).
                   if (g.isReceived) {
                       totalCollection += safeNum(g.collection);
                   }
                });
            } else {
                // Legacy data assumption (all received)
                const reg = safeNum(data.personalStandardCount) * safeNum(activeTour.fees?.regular);
                const d1 = safeNum(data.personalDisc1Count) * safeNum(activeTour.fees?.disc1);
                const d2 = safeNum(data.personalDisc2Count) * safeNum(activeTour.fees?.disc2);
                totalCollection += (reg + d1 + d2);
            }
        });
        
        setPersonalCollection(totalCollection);

      } catch (err) {
        console.error("Error fetching personal data for settlement", err);
        setPersonalCollection(0);
      }
    };
    fetchAggregatedPersonalData();
  }, [activeTour]);

  if (!activeTour) return (
      <div className="h-full flex flex-col items-center justify-center p-10 text-center text-slate-400">
        <Wallet size={32} className="mb-2 opacity-50"/>
        <p className="font-bold text-xs">কোন ট্যুর ডাটা পাওয়া যায়নি</p>
      </div>
  );

  let agencyCollection = 0;
  if (activeTour.partnerAgencies) {
      agencyCollection = activeTour.partnerAgencies.reduce((sum, agency) => {
          const agencyTotal = agency.guests ? agency.guests.reduce((gSum, g) => {
              // Only count received guests for Host Collection
              return g.isReceived ? gSum + safeNum(g.collection) : gSum;
          }, 0) : 0;
          return sum + agencyTotal;
      }, 0);
  }

  const totalHostCollection = personalCollection + agencyCollection;
  const dailyExpensesTotal = calculateTotalDailyExpenses(activeTour);
  const otherFixedCostsTotal = calculateTotalOtherFixedCosts(activeTour);
  const hostSpending = dailyExpensesTotal + otherFixedCostsTotal;
  const netBalance = totalHostCollection - hostSpending;
  const status = activeTour.hostSettlementStatus || 'unpaid';

  // --- ACTIONS ---
  const updateStatus = async (newStatus: SettlementStatus) => {
      if (!activeTour) return;
      if (newStatus === 'paid' && !window.confirm("আপনি কি নিশ্চিত যে পেমেন্ট কমপ্লিট করেছেন?")) return;
      if (newStatus === 'settled' && !window.confirm("পেমেন্ট গ্রহণ নিশ্চিত করছেন?")) return;
      
      setIsUpdating(true);
      try {
          const tourRef = doc(db, 'tours', activeTour.id);
          await updateDoc(tourRef, { 
              hostSettlementStatus: newStatus,
              updatedAt: Timestamp.now()
          });
          await refreshTours();
      } catch (e) {
          console.error("Error updating status", e);
          alert("আপডেট ব্যর্থ হয়েছে।");
      } finally {
          setIsUpdating(false);
      }
  };

  // Logic: 
  // Net > 0: Host Owes Admin. Host is Payer.
  // Net < 0: Admin Owes Host. Host is Payee.
  const isPayer = netBalance > 0;

  return (
    <div className="space-y-4 animate-fade-in font-sans pb-24">
      {/* Selector */}
      <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 relative z-20">
        <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
            <Wallet size={18} />
        </div>
        <div className="flex-1 min-w-0">
            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 truncate">সেটেলমেন্ট (Host vs Admin)</label>
            <div className="relative">
                <select 
                    value={selectedTourId}
                    onChange={(e) => setSelectedTourId(e.target.value)}
                    className="w-full appearance-none bg-transparent text-slate-800 text-sm font-black focus:outline-none cursor-pointer pr-6 py-1 truncate"
                >
                    {tours.map(t => <option key={t.id} value={t.id}>{t.name} ({t.date})</option>)}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} strokeWidth={2.5} />
            </div>
        </div>
      </div>

      {/* Main Settlement Card */}
      <div className={`relative overflow-hidden rounded-[2rem] p-6 text-white shadow-2xl transition-all duration-500 ${netBalance >= 0 ? 'bg-gradient-to-br from-blue-600 to-indigo-800 shadow-blue-900/20' : 'bg-gradient-to-br from-rose-600 to-orange-800 shadow-rose-900/20'}`}>
         <div className="absolute -top-20 -right-20 w-48 h-48 bg-white opacity-10 rounded-full blur-3xl"></div>
         
         <div className="relative z-10 flex flex-col gap-4">
             <div className="flex justify-between items-center">
                 <div>
                     <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-1">নেট ব্যালেন্স (Cash In Hand)</p>
                     <h2 className="text-3xl font-black tracking-tight flex items-baseline gap-1">
                        {Math.abs(netBalance).toLocaleString()} <span className="text-lg opacity-70">৳</span>
                     </h2>
                     <p className="mt-1 text-[10px] font-bold bg-white/20 inline-block px-2 py-0.5 rounded-lg backdrop-blur-md">
                         {netBalance >= 0 ? 'অ্যাডমিন পাবে' : 'হোস্ট পাবে'}
                     </p>
                 </div>
                 <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg">
                     {netBalance >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                 </div>
             </div>

             {/* SETTLEMENT ACTION AREA */}
             <div className="pt-4 border-t border-white/10">
                 {status === 'settled' ? (
                     <div className="flex items-center gap-2 bg-emerald-500/20 p-3 rounded-xl border border-emerald-400/30 backdrop-blur-md">
                         <CheckCircle size={18} className="text-emerald-300" />
                         <span className="font-bold text-xs text-emerald-100">হিসাব ক্লোজড (Settled)</span>
                     </div>
                 ) : (
                    <div>
                         {/* If Host is Payer (Host Owes Admin) */}
                         {isPayer && (
                             status === 'paid' ? (
                                <div className="flex items-center gap-2 bg-amber-500/20 p-3 rounded-xl border border-amber-400/30 backdrop-blur-md">
                                    <Clock size={18} className="text-amber-300" />
                                    <span className="font-bold text-xs text-amber-100">অ্যাডমিন কনফার্মেশনের অপেক্ষায় (Pending)</span>
                                </div>
                             ) : (
                                <button 
                                    onClick={() => updateStatus('paid')}
                                    disabled={isUpdating}
                                    className="w-full py-3 bg-white text-slate-900 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg hover:bg-slate-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    {isUpdating ? '...' : <><CheckCircle size={16} /> পেমেন্ট কমপ্লিট করুন</>}
                                </button>
                             )
                         )}

                         {/* If Host is Payee (Admin Owes Host) */}
                         {!isPayer && (
                             status === 'paid' ? (
                                 <div className="flex gap-2">
                                     <button 
                                         onClick={() => updateStatus('unpaid')}
                                         disabled={isUpdating}
                                         className="flex-1 py-3 bg-white/20 text-white border border-white/20 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-white/30 flex items-center justify-center gap-2"
                                     >
                                         <XCircle size={16}/> Decline
                                     </button>
                                     <button 
                                         onClick={() => updateStatus('settled')}
                                         disabled={isUpdating}
                                         className="flex-1 py-3 bg-white text-slate-900 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg hover:bg-slate-100 flex items-center justify-center gap-2"
                                     >
                                         <CheckCircle size={16}/> Accept
                                     </button>
                                 </div>
                             ) : (
                                <div className="flex items-center gap-2 bg-white/10 p-3 rounded-xl border border-white/10 backdrop-blur-md">
                                    <Clock size={18} className="text-white/70" />
                                    <span className="font-bold text-xs text-white/80">অ্যাডমিন পেমেন্টের অপেক্ষায়</span>
                                </div>
                             )
                         )}
                         
                         {netBalance === 0 && (
                             <div className="flex items-center gap-2 text-white/60">
                                 <CheckCircle size={14}/> <span>কোনো লেনদেন বাকি নেই</span>
                             </div>
                         )}
                    </div>
                 )}
             </div>
         </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {/* Debit Card (Collection) */}
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between h-full">
              <div>
                  <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                          <DollarSign size={14}/>
                      </div>
                      <h3 className="font-bold text-slate-700 text-[10px] uppercase tracking-widest">মোট কালেকশন (Received Only)</h3>
                  </div>
                  <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-xl">
                          <span className="font-bold text-slate-500 flex items-center gap-1.5"><Building size={12}/> এজেন্সি</span>
                          <span className="font-bold text-slate-800">৳{agencyCollection.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-xl">
                          <span className="font-bold text-slate-500 flex items-center gap-1.5"><Wallet size={12}/> পার্সোনাল</span>
                          <span className="font-bold text-slate-800">৳{personalCollection.toLocaleString()}</span>
                      </div>
                  </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-[9px] font-black text-emerald-500 uppercase">মোট জমা</span>
                  <span className="text-lg font-black text-emerald-600">৳{totalHostCollection.toLocaleString()}</span>
              </div>
          </div>

          {/* Credit Card (Spending) */}
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between h-full">
              <div>
                  <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                          <Receipt size={14}/>
                      </div>
                      <h3 className="font-bold text-slate-700 text-[10px] uppercase tracking-widest">মোট খরচ (Cash Out)</h3>
                  </div>
                  <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-xl">
                          <span className="font-bold text-slate-500">দৈনিক খরচ</span>
                          <span className="font-bold text-slate-800">৳{dailyExpensesTotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-xl">
                          <span className="font-bold text-slate-500">অন্যান্য ফিক্সড</span>
                          <span className="font-bold text-slate-800">৳{otherFixedCostsTotal.toLocaleString()}</span>
                      </div>
                  </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-[9px] font-black text-rose-500 uppercase">মোট খরচ</span>
                  <span className="text-lg font-black text-rose-600">৳{hostSpending.toLocaleString()}</span>
              </div>
          </div>
      </div>
    </div>
  );
};

export default HostSettlement;