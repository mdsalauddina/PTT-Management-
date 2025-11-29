

import React, { useState, useEffect } from 'react';
import { CommonTabProps, PersonalData } from '../types';
import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CheckCircle, TrendingUp, Users, DollarSign, Wallet, ChevronDown, Activity, CalendarDays, ArrowRight, Building } from 'lucide-react';

const FinalTab: React.FC<CommonTabProps> = ({ user, tours }) => {
  const [selectedDate, setSelectedDate] = useState<string>('');
  // Map of tourId -> Personal Collection (for Admin)
  const [personalFinancials, setPersonalFinancials] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // Get unique dates
  const uniqueDates = Array.from(new Set(tours.map(t => t.date))).sort().reverse();

  useEffect(() => {
    if (uniqueDates.length > 0 && !selectedDate) {
        setSelectedDate(uniqueDates[0]);
    }
  }, [tours]);

  const selectedTours = tours.filter(t => t.date === selectedDate);

  // Fetch personal data for all tours on selected date to calculate accurate P/L
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
                    
                    const regCount = Number(data.personalStandardCount) || 0;
                    const d1Count = Number(data.personalDisc1Count) || 0;
                    const d2Count = Number(data.personalDisc2Count) || 0;
                    const bookingFee = Number(data.bookingFee) || 0;

                    const regFee = Number(tour.fees?.regular) || 0;
                    const d1Fee = Number(tour.fees?.disc1) || 0;
                    const d2Fee = Number(tour.fees?.disc2) || 0;

                    let pCollection = 0;
                    if (data.guests && data.guests.length > 0) {
                        pCollection = data.guests.reduce((sum, g) => sum + (Number(g.collection)||0), 0) + bookingFee;
                    } else {
                        pCollection = (regCount * regFee) + (d1Count * d1Fee) + (d2Count * d2Fee) + bookingFee;
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
        <div className="bg-slate-100 p-4 rounded-full mb-3"><CheckCircle size={24} /></div>
        <p className="font-bold text-xs">কোন ট্যুর ডাটা পাওয়া যায়নি</p>
    </div>
  );

  // Calculate Aggregates
  let grandTotalCollection = 0;
  let grandTotalExpense = 0;
  let grandTotalProfit = 0;

  const tourReports = selectedTours.map(tour => {
      // Income
      const agencyCollection = tour.partnerAgencies 
        ? tour.partnerAgencies.reduce((sum, a) => 
            sum + (a.guests ? a.guests.reduce((g, guest) => g + Number(guest.collection || 0), 0) : 0), 0)
        : 0;
      
      const pCollection = personalFinancials[tour.id] || 0;
      const totalTourIncome = agencyCollection + pCollection;

      // Expense
      const dailyExp = tour.costs?.dailyExpenses 
        ? tour.costs.dailyExpenses.reduce((sum, day) => 
            sum + Number(day.breakfast||0) + Number(day.lunch||0) + Number(day.dinner||0) + Number(day.transport||0) + Number(day.other||0), 0)
        : 0;
      
      const fixedCosts = Number(tour.busConfig?.totalRent || 0) + Number(tour.costs?.hostFee || 0) + Number(tour.costs?.hotelCost || 0);
      const totalTourExpense = fixedCosts + dailyExp;

      const profit = totalTourIncome - totalTourExpense;

      // Aggregates
      grandTotalCollection += totalTourIncome;
      grandTotalExpense += totalTourExpense;
      grandTotalProfit += profit;

      return {
          ...tour,
          income: totalTourIncome,
          expense: totalTourExpense,
          profit: profit
      };
  });

  return (
    <div className="space-y-6 animate-fade-in pb-24 max-w-4xl mx-auto font-sans">
      {/* Date Selector */}
      <div className="flex items-center justify-between bg-white px-5 py-4 rounded-3xl border border-slate-200 shadow-lg shadow-slate-200/50 sticky top-0 z-20">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl ring-4 ring-teal-50/50">
                <CalendarDays size={20} />
            </div>
            <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">রিপোর্ট তারিখ নির্বাচন করুন</p>
                <div className="relative group">
                    <select 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="appearance-none bg-transparent font-black text-slate-700 text-lg focus:outline-none cursor-pointer pr-8"
                    >
                        {uniqueDates.map(date => <option key={date} value={date}>{date}</option>)}
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-slate-600" size={16} strokeWidth={3} />
                </div>
            </div>
        </div>
        <div className="text-right hidden sm:block">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ইভেন্ট সংখ্যা</p>
            <p className="text-xl font-black text-slate-800">{selectedTours.length}</p>
        </div>
      </div>

      {/* GRAND TOTAL SUMMARY CARD */}
      <div className={`relative overflow-hidden rounded-[2.5rem] p-8 text-white shadow-2xl transition-all duration-500 hover:scale-[1.01] ${grandTotalProfit >= 0 ? 'bg-gradient-to-br from-emerald-600 to-teal-800 shadow-emerald-900/20' : 'bg-gradient-to-br from-rose-600 to-orange-800 shadow-rose-900/20'}`}>
         {/* Background Decoration */}
         <div className="absolute -top-20 -right-20 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
         
         <div className="relative z-10 flex justify-between items-center mb-8">
             <div>
                 <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-2">সর্বমোট নেট প্রফিট / লস</p>
                 <h2 className="text-5xl font-black tracking-tight flex items-baseline gap-1">
                    {grandTotalProfit >= 0 ? '+' : ''}{grandTotalProfit.toLocaleString()} <span className="text-2xl opacity-70">৳</span>
                 </h2>
             </div>
             <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg">
                 {grandTotalProfit >= 0 ? <TrendingUp size={32} /> : <Activity size={32} />}
             </div>
         </div>
         
         <div className="grid grid-cols-2 gap-6 pt-6 border-t border-white/10">
             <div>
                 <p className="text-[10px] font-bold uppercase opacity-70 mb-1">মোট কালেকশন</p>
                 <p className="text-2xl font-bold font-mono">৳{grandTotalCollection.toLocaleString()}</p>
             </div>
             <div className="text-right">
                 <p className="text-[10px] font-bold uppercase opacity-70 mb-1">মোট খরচ</p>
                 <p className="text-2xl font-bold font-mono opacity-90">- ৳{grandTotalExpense.toLocaleString()}</p>
             </div>
         </div>
      </div>

      {/* INDIVIDUAL TOUR BREAKDOWN */}
      <div className="space-y-4">
          <div className="flex items-center gap-2 px-4 mb-2">
              <Building size={16} className="text-slate-400" />
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">ট্যুর ভিত্তিক রিপোর্ট ({selectedDate})</h3>
          </div>

          {loading ? (
             <div className="p-12 text-center text-slate-400 text-xs font-bold animate-pulse bg-slate-50 rounded-3xl border border-slate-100">ডাটা ক্যালকুলেট হচ্ছে...</div>
          ) : (
            tourReports.map(tour => (
                <div key={tour.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 group">
                    <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="flex-1">
                            <h4 className="font-black text-slate-800 text-lg leading-tight group-hover:text-violet-700 transition-colors">{tour.name}</h4>
                            <div className="flex flex-wrap items-center gap-3 mt-3">
                                <span className="text-[10px] bg-slate-50 text-slate-500 px-3 py-1 rounded-full font-bold border border-slate-200 shadow-sm">
                                    আয়: ৳{tour.income.toLocaleString()}
                                </span>
                                <span className="text-[10px] bg-slate-50 text-slate-500 px-3 py-1 rounded-full font-bold border border-slate-200 shadow-sm">
                                    ব্যয়: ৳{tour.expense.toLocaleString()}
                                </span>
                            </div>
                        </div>
                        
                        <div className={`flex items-center gap-4 px-6 py-3 rounded-2xl border transition-all ${tour.profit >= 0 ? 'bg-emerald-50 border-emerald-100 group-hover:bg-emerald-100' : 'bg-rose-50 border-rose-100 group-hover:bg-rose-100'}`}>
                            <div className="text-right">
                                <p className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${tour.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {tour.profit >= 0 ? 'লাভ' : 'লস'}
                                </p>
                                <p className={`text-xl font-black ${tour.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    ৳{Math.abs(tour.profit).toLocaleString()}
                                </p>
                            </div>
                            <div className={`p-2 rounded-full ${tour.profit >= 0 ? 'bg-emerald-200/50 text-emerald-600' : 'bg-rose-200/50 text-rose-600'}`}>
                                {tour.profit >= 0 ? <CheckCircle size={24}/> : <Activity size={24}/>}
                            </div>
                        </div>
                    </div>
                </div>
            ))
          )}
          
          {selectedTours.length === 0 && (
             <div className="text-center p-12 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 text-slate-400 text-xs font-bold">
                 এই তারিখে কোন ট্যুর নেই
             </div>
          )}
      </div>
    </div>
  );
};

export default FinalTab;
