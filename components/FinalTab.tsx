
import React, { useState, useEffect } from 'react';
import { CommonTabProps, PersonalData } from '../types';
import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CheckCircle, TrendingUp, Activity, CalendarDays, ChevronDown, Building, ArrowRight } from 'lucide-react';
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
                        // Trust guest collection sum + booking fee
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
    <div className="space-y-4 animate-fade-in pb-24 max-w-2xl mx-auto font-sans">
      {/* Date Selector */}
      <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
                <CalendarDays size={18} />
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

      {/* COMPACT SUMMARY CARD */}
      <div className={`relative overflow-hidden rounded-3xl p-5 text-white shadow-lg transition-all ${grandTotalProfit >= 0 ? 'bg-gradient-to-r from-emerald-600 to-teal-700' : 'bg-gradient-to-r from-rose-600 to-orange-700'}`}>
         <div className="flex justify-between items-center mb-4">
             <div>
                 <p className="text-[9px] font-bold uppercase tracking-widest opacity-80 mb-1">সর্বমোট নেট প্রফিট / লস</p>
                 <h2 className="text-3xl font-black tracking-tight">
                    {grandTotalProfit >= 0 ? '+' : ''}{grandTotalProfit.toLocaleString()} <span className="text-lg opacity-70">৳</span>
                 </h2>
             </div>
             <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-md">
                 {grandTotalProfit >= 0 ? <TrendingUp size={20} /> : <Activity size={20} />}
             </div>
         </div>
         <div className="flex gap-4 pt-4 border-t border-white/10 text-xs font-bold font-mono">
             <div className="flex-1 bg-white/10 rounded-lg p-2 text-center">
                 <span className="block opacity-60 text-[8px] uppercase font-sans mb-0.5">মোট কালেকশন</span>
                 ৳{grandTotalCollection.toLocaleString()}
             </div>
             <div className="flex-1 bg-white/10 rounded-lg p-2 text-center">
                 <span className="block opacity-60 text-[8px] uppercase font-sans mb-0.5">মোট খরচ</span>
                 ৳{grandTotalExpense.toLocaleString()}
             </div>
         </div>
      </div>

      {/* COMPACT LIST */}
      <div className="space-y-3">
          <div className="flex items-center gap-2 px-2 mb-1">
              <Building size={14} className="text-slate-400" />
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">বিস্তারিত রিপোর্ট</h3>
          </div>

          {loading ? (
             <div className="p-8 text-center text-slate-400 text-[10px] font-bold animate-pulse bg-slate-50 rounded-2xl border border-slate-100">ডাটা প্রসেসিং...</div>
          ) : (
            tourReports.map(tour => (
                <div key={tour.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:shadow-md transition-all">
                    <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-800 text-xs leading-tight mb-2 truncate">{tour.name}</h4>
                        <div className="flex gap-2">
                            <span className="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded border border-emerald-100 font-bold whitespace-nowrap">
                                আয়: ৳{tour.income}
                            </span>
                            <span className="text-[9px] bg-rose-50 text-rose-600 px-2 py-0.5 rounded border border-rose-100 font-bold whitespace-nowrap">
                                ব্যয়: ৳{tour.expense}
                            </span>
                        </div>
                    </div>
                    
                    <div className={`flex items-center gap-3 pl-4 sm:border-l border-slate-100 w-full sm:w-auto justify-between sm:justify-end ${tour.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        <div className="text-right">
                            <p className="text-[8px] font-bold uppercase tracking-wider mb-0.5">
                                {tour.profit >= 0 ? 'লাভ' : 'লস'}
                            </p>
                            <p className="text-lg font-black">
                                ৳{Math.abs(tour.profit).toLocaleString()}
                            </p>
                        </div>
                        <div className={`p-1.5 rounded-full ${tour.profit >= 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                            {tour.profit >= 0 ? <CheckCircle size={14}/> : <Activity size={14}/>}
                        </div>
                    </div>
                </div>
            ))
          )}
          
          {selectedTours.length === 0 && (
             <div className="text-center p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 text-[10px] font-bold">
                 কোন ইভেন্ট নেই
             </div>
          )}
      </div>
    </div>
  );
};

export default FinalTab;
