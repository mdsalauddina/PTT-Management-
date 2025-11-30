

import React, { useState, useEffect } from 'react';
import { CommonTabProps, PersonalData } from '../types';
import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CheckCircle, TrendingUp, Activity, CalendarDays, ChevronDown, Building, FileText } from 'lucide-react';
import { calculateTotalOtherFixedCosts, safeNum } from '../utils/calculations';

const FinalTab: React.FC<CommonTabProps> = ({ user, tours }) => {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [personalFinancials, setPersonalFinancials] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const uniqueDates = Array.from(new Set(tours.map(t => t.date))).sort().reverse();

  useEffect(() => {
    if (uniqueDates.length > 0 && !selectedDate) {
        setSelectedDate(uniqueDates[0]);
    }
  }, [tours]);

  const selectedTours = tours.filter(t => t.date === selectedDate);

  useEffect(() => {
    const fetchAllPersonalData = async () => {
        if (selectedTours.length === 0 || !user) return;
        setLoading(true);
        const financials: Record<string, number> = {};

        await Promise.all(selectedTours.map(async (tour) => {
            try {
                const docRef = doc(db, 'personal', `${tour.id}_${user.uid}`);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data() as PersonalData;
                    
                    const bookingFee = safeNum(data.bookingFee);
                    const regFee = safeNum(tour.fees?.regular);
                    const d1Fee = safeNum(tour.fees?.disc1);
                    const d2Fee = safeNum(tour.fees?.disc2);

                    let pCollection = 0;
                    if (data.guests && data.guests.length > 0) {
                        // Trust guest collection (which is derived from fees/packages or manual override)
                        pCollection = data.guests.reduce((sum, g) => sum + safeNum(g.collection), 0) + bookingFee;
                    } else {
                        // Fallback counters
                        const reg = safeNum(data.personalStandardCount) * regFee;
                        const d1 = safeNum(data.personalDisc1Count) * d1Fee;
                        const d2 = safeNum(data.personalDisc2Count) * d2Fee;
                        pCollection = reg + d1 + d2 + bookingFee;
                    }
                    financials[tour.id] = pCollection;
                } else {
                    financials[tour.id] = 0;
                }
            } catch (e) {
                console.error("Error fetching personal data for final report", e);
            }
        }));
        
        setPersonalFinancials(financials);
        setLoading(false);
    };

    fetchAllPersonalData();
  }, [selectedDate, tours, user]);

  if (user.role !== 'admin') return null;

  if (tours.length === 0) return (
    <div className="h-full flex flex-col items-center justify-center p-10 text-center text-slate-400">
        <CheckCircle size={24} className="mb-2 opacity-30" />
        <p className="font-bold text-xs">কোন ট্যুর ডাটা পাওয়া যায়নি</p>
    </div>
  );

  let grandTotalCollection = 0;
  let grandTotalExpense = 0;
  let grandTotalProfit = 0;

  const tourReports = selectedTours.map(tour => {
      const agencyCollection = tour.partnerAgencies 
        ? tour.partnerAgencies.reduce((sum, a) => 
            sum + (a.guests ? a.guests.reduce((g, guest) => g + safeNum(guest.collection), 0) : 0), 0)
        : 0;
      
      const pCollection = personalFinancials[tour.id] || 0;
      const totalTourIncome = agencyCollection + pCollection;

      const dailyExp = tour.costs?.dailyExpenses 
        ? tour.costs.dailyExpenses.reduce((sum, day) => 
            sum + safeNum(day.breakfast) + safeNum(day.lunch) + safeNum(day.dinner) + safeNum(day.transport) + safeNum(day.other), 0)
        : 0;
      
      const otherFixed = calculateTotalOtherFixedCosts(tour);
      const fixedCosts = safeNum(tour.busConfig?.totalRent) + safeNum(tour.costs?.hostFee) + safeNum(tour.costs?.hotelCost) + otherFixed;
      const totalTourExpense = fixedCosts + dailyExp;
      const profit = totalTourIncome - totalTourExpense;

      grandTotalCollection += totalTourIncome;
      grandTotalExpense += totalTourExpense;
      grandTotalProfit += profit;

      return { ...tour, income: totalTourIncome, expense: totalTourExpense, profit: profit };
  });

  return (
    <div className="space-y-4 animate-fade-in pb-24 max-w-xl mx-auto font-sans">
      {/* Date Selector */}
      <div className="flex items-center justify-between bg-white px-3 py-2.5 rounded-2xl border border-slate-200 shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
            <div className="p-1.5 bg-teal-50 text-teal-600 rounded-lg">
                <CalendarDays size={16} />
            </div>
            <div>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">রিপোর্ট তারিখ</p>
                <div className="relative group -mt-1">
                    <select 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="appearance-none bg-transparent font-black text-slate-700 text-sm focus:outline-none cursor-pointer pr-6 py-0.5"
                    >
                        {uniqueDates.map(date => <option key={date} value={date}>{date}</option>)}
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} strokeWidth={2.5} />
                </div>
            </div>
        </div>
        <div className="text-right">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">ইভেন্ট</p>
            <p className="text-sm font-black text-slate-800">{selectedTours.length} টি</p>
        </div>
      </div>

      {/* COMPACT SUMMARY HEADER */}
      <div className={`rounded-2xl p-4 text-white shadow-lg transition-colors ${grandTotalProfit >= 0 ? 'bg-emerald-600' : 'bg-rose-600'}`}>
         <div className="flex justify-between items-end mb-3">
             <div>
                 <p className="text-[8px] font-bold uppercase tracking-widest opacity-80 mb-0.5">সর্বমোট নেট প্রফিট / লস</p>
                 <h2 className="text-2xl font-black tracking-tight">
                    {grandTotalProfit >= 0 ? '+' : ''}{grandTotalProfit.toLocaleString()} ৳
                 </h2>
             </div>
             <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-md">
                 {grandTotalProfit >= 0 ? <TrendingUp size={16} /> : <Activity size={16} />}
             </div>
         </div>
         <div className="grid grid-cols-2 gap-2 text-[10px] font-bold opacity-90 border-t border-white/20 pt-2">
             <div className="flex justify-between"><span>মোট কালেকশন</span> <span>৳{grandTotalCollection.toLocaleString()}</span></div>
             <div className="flex justify-between"><span>মোট খরচ</span> <span>৳{grandTotalExpense.toLocaleString()}</span></div>
         </div>
      </div>

      {/* COMPACT LIST */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2 bg-slate-50/50 border-b border-slate-100 flex items-center gap-1.5">
              <FileText size={12} className="text-slate-400" />
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">বিস্তারিত রিপোর্ট</h3>
          </div>

          {loading ? (
             <div className="p-8 text-center text-slate-400 text-[10px] font-bold animate-pulse">ডাটা প্রসেসিং...</div>
          ) : selectedTours.length === 0 ? (
             <div className="text-center p-8 text-slate-400 text-[10px] font-bold italic">কোন ইভেন্ট নেই</div>
          ) : (
             <div className="divide-y divide-slate-50">
                {tourReports.map(tour => (
                    <div key={tour.id} className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-slate-800 text-xs truncate mb-1">{tour.name}</h4>
                            <div className="flex gap-2 text-[9px] font-bold">
                                <span className="text-emerald-600">আয়: ৳{tour.income}</span>
                                <span className="text-slate-300">|</span>
                                <span className="text-rose-500">ব্যয়: ৳{tour.expense}</span>
                            </div>
                        </div>
                        <div className="text-right">
                             <p className={`text-xs font-black ${tour.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                 {tour.profit >= 0 ? '+' : ''}৳{Math.abs(tour.profit).toLocaleString()}
                             </p>
                        </div>
                    </div>
                ))}
             </div>
          )}
      </div>
    </div>
  );
};

export default FinalTab;