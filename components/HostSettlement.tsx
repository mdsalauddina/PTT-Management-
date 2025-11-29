import React, { useState, useEffect } from 'react';
import { CommonTabProps, PersonalData } from '../types';
import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Wallet, ChevronDown, TrendingUp, TrendingDown, Receipt, DollarSign, Building } from 'lucide-react';
import { calculateTotalDailyExpenses, calculateTotalOtherFixedCosts, safeNum } from '../utils/calculations';

const HostSettlement: React.FC<CommonTabProps> = ({ user, tours }) => {
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);

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
          setPersonalData(docSnap.data() as PersonalData);
        } else {
          setPersonalData(null);
        }
      } catch (err) {
        console.error("Error fetching personal data", err);
      }
    };
    fetchPersonalData();
  }, [activeTour, user.uid]);

  if (!activeTour) return (
      <div className="h-full flex flex-col items-center justify-center p-10 text-center text-slate-400">
        <Wallet size={32} className="mb-2 opacity-50"/>
        <p className="font-bold text-xs">কোন ট্যুর ডাটা পাওয়া যায়নি</p>
      </div>
  );

  // --- CALCULATION LOGIC ---

  // 1. Personal Collection
  let personalCollection = 0;
  if (personalData) {
      const bookingFee = safeNum(personalData.bookingFee);
      let guestCollection = 0;
      if (personalData.guests && personalData.guests.length > 0) {
          guestCollection = personalData.guests.reduce((sum, g) => sum + safeNum(g.collection), 0);
      } else {
          const reg = safeNum(personalData.personalStandardCount) * safeNum(activeTour.fees?.regular);
          const d1 = safeNum(personalData.personalDisc1Count) * safeNum(activeTour.fees?.disc1);
          const d2 = safeNum(personalData.personalDisc2Count) * safeNum(activeTour.fees?.disc2);
          guestCollection = reg + d1 + d2;
      }
      personalCollection = guestCollection + bookingFee;
  }

  // 2. Agency Collection
  let agencyCollection = 0;
  if (activeTour.partnerAgencies) {
      agencyCollection = activeTour.partnerAgencies.reduce((sum, agency) => {
          const agencyTotal = agency.guests ? agency.guests.reduce((gSum, g) => gSum + safeNum(g.collection), 0) : 0;
          return sum + agencyTotal;
      }, 0);
  }

  // 3. Total Host Collection (Personal + Agency)
  const totalHostCollection = personalCollection + agencyCollection;

  // 4. Host Spending (Credit): Daily Expenses + Extra Fixed Costs
  const dailyExpensesTotal = calculateTotalDailyExpenses(activeTour);
  const otherFixedCostsTotal = calculateTotalOtherFixedCosts(activeTour);
  
  const hostSpending = dailyExpensesTotal + otherFixedCostsTotal;

  // 5. Net Balance
  const netBalance = totalHostCollection - hostSpending;

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
         {/* Background Decoration */}
         <div className="absolute -top-20 -right-20 w-48 h-48 bg-white opacity-10 rounded-full blur-3xl"></div>
         
         <div className="relative z-10 flex justify-between items-center mb-4">
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
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {/* Debit Card (Collection) */}
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between h-full">
              <div>
                  <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                          <DollarSign size={14}/>
                      </div>
                      <h3 className="font-bold text-slate-700 text-[10px] uppercase tracking-widest">মোট কালেকশন</h3>
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