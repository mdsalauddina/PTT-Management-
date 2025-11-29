
import React, { useState, useEffect } from 'react';
import { CommonTabProps, PersonalData } from '../types';
import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';
import { TrendingUp, Activity, Wallet, Building, Coffee, Car, Utensils, Users, ChevronDown, AlertCircle, Bus } from 'lucide-react';

const AnalysisTab: React.FC<CommonTabProps> = ({ tours, user }) => {
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  const [personalGuestCount, setPersonalGuestCount] = useState<number>(0);
  const [personalCollection, setPersonalCollection] = useState<number>(0);

  useEffect(() => {
    if (tours.length > 0 && !selectedTourId) {
        setSelectedTourId(tours[0].id);
    }
  }, [tours, selectedTourId]);

  const activeTour = tours.find(t => t.id === selectedTourId) || null;

  useEffect(() => {
    const fetchPersonalData = async () => {
        if (!activeTour || !user) return;
        try {
            const docRef = doc(db, 'personal', `${activeTour.id}_${user.uid}`);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as PersonalData;
                const pGuests = data.guests ? data.guests.reduce((sum, g) => sum + (Number(g.seatCount)||1), 0) : 0;
                
                let pCollection = 0;
                const bookingFee = Number(data.bookingFee) || 0;
                if (data.guests && data.guests.length > 0) {
                     pCollection = data.guests.reduce((sum, g) => sum + (Number(g.collection)||0), 0) + bookingFee;
                } else {
                     const regCount = Number(data.personalStandardCount) || 0;
                     const d1Count = Number(data.personalDisc1Count) || 0;
                     const d2Count = Number(data.personalDisc2Count) || 0;
                     const regFee = Number(activeTour.fees?.regular) || 0;
                     const d1Fee = Number(activeTour.fees?.disc1) || 0;
                     const d2Fee = Number(activeTour.fees?.disc2) || 0;
                     pCollection = (regCount * regFee) + (d1Count * d1Fee) + (d2Count * d2Fee) + bookingFee;
                }
                
                setPersonalGuestCount(pGuests);
                setPersonalCollection(pCollection);
            } else {
                setPersonalGuestCount(0);
                setPersonalCollection(0);
            }
        } catch (e) {
            console.error(e);
        }
    };
    fetchPersonalData();
  }, [activeTour, user]);

  if (!activeTour) return (
    <div className="h-full flex flex-col items-center justify-center p-10 text-center text-slate-400">
        <TrendingUp size={20} className="mb-2 opacity-50"/>
        <p className="font-bold text-xs">কোন ট্যুর ডাটা পাওয়া যায়নি</p>
    </div>
  );

  if (!activeTour.busConfig || !activeTour.costs) {
    return (
      <div className="p-6 text-center text-rose-500 bg-rose-50 rounded-2xl border border-rose-100 text-xs font-bold">
        <AlertCircle className="mx-auto mb-2" size={20} />
        কনফিগারেশন অসম্পূর্ণ।
      </div>
    );
  }

  // --- CALCULATIONS ---
  const agencyGuests = activeTour.partnerAgencies 
    ? activeTour.partnerAgencies.reduce((sum, a) => sum + (a.guests?.reduce((gSum, g) => gSum + (Number(g.seatCount)||1), 0) || 0), 0) 
    : 0;

  const totalBooked = agencyGuests + personalGuestCount;
  const totalSeats = Number(activeTour.busConfig.totalSeats) || 40;
  const occupancyRate = Math.min((totalBooked / totalSeats) * 100, 100);
  const vacantSeats = Math.max(0, totalSeats - totalBooked);

  const agencyCollection = activeTour.partnerAgencies 
    ? activeTour.partnerAgencies.reduce((sum, a) => 
        sum + (a.guests ? a.guests.reduce((gSum, g) => gSum + Number(g.collection || 0), 0) : 0), 0)
    : 0;
  
  const totalIncome = agencyCollection + personalCollection;

  // Expenses Breakdown
  const totalBusRent = Number(activeTour.busConfig.totalRent || 0);
  const totalHostFee = Number(activeTour.costs.hostFee || 0);
  const totalHotelCost = Number(activeTour.costs.hotelCost || 0);
  
  const totalDailyMeals = activeTour.costs?.dailyExpenses 
    ? activeTour.costs.dailyExpenses.reduce((sum, day) => sum + Number(day.breakfast||0) + Number(day.lunch||0) + Number(day.dinner||0), 0)
    : 0;
  
  const totalDailyTransport = activeTour.costs?.dailyExpenses 
    ? activeTour.costs.dailyExpenses.reduce((sum, day) => sum + Number(day.transport||0), 0)
    : 0;

  const totalDailyExtra = activeTour.costs?.dailyExpenses 
    ? activeTour.costs.dailyExpenses.reduce((sum, day) => sum + Number(day.other||0), 0)
    : 0;

  const totalExpenses = totalBusRent + totalHostFee + totalHotelCost + totalDailyMeals + totalDailyTransport + totalDailyExtra;
  const netProfit = totalIncome - totalExpenses;

  // Per Head Calculations
  const calcPerHead = (amount: number) => Math.ceil(amount / (totalSeats || 1));

  const seatData = [
    { name: 'বুকড', value: totalBooked, color: '#6366f1' },
    { name: 'খালি', value: vacantSeats, color: '#f1f5f9' },
  ];

  const financialData = [
    { name: 'ব্যয়', amount: totalExpenses, fill: '#ef4444' },
    { name: 'আয়', amount: totalIncome, fill: '#10b981' },
  ];

  return (
    <div className="space-y-4 animate-fade-in pb-20 max-w-5xl mx-auto font-sans text-slate-800">
      {/* Compact Selector */}
      <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-50 text-violet-600 rounded-xl">
                <Activity size={16} />
            </div>
            <div>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">ট্যুর নির্বাচন</p>
                <div className="relative group -mt-1">
                    <select 
                        value={selectedTourId}
                        onChange={(e) => setSelectedTourId(e.target.value)}
                        className="appearance-none bg-transparent font-bold text-slate-700 text-sm focus:outline-none cursor-pointer pr-6 py-0.5"
                    >
                        {tours.map(t => <option key={t.id} value={t.id}>{t.name} ({t.date})</option>)}
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} strokeWidth={3} />
                </div>
            </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-[10px] font-bold border ${netProfit >= 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
            {netProfit >= 0 ? `লাভ: ৳${netProfit}` : `লস: ৳${Math.abs(netProfit)}`}
        </div>
      </div>
      
      {/* Top Stats Compact Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Occupancy */}
        <div className="col-span-2 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">মোট বুকিং</p>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-800">{totalBooked}</span>
                    <span className="text-[10px] font-bold text-slate-400">/ {totalSeats} সিট</span>
                </div>
                <div className="flex gap-1.5 mt-2">
                    <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 font-bold">এজেন্সি: {agencyGuests}</span>
                    <span className="text-[9px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded border border-purple-100 font-bold">নিজস্ব: {personalGuestCount}</span>
                </div>
            </div>
            <div className="w-16 h-16 relative">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={seatData} innerRadius={18} outerRadius={30} paddingAngle={0} dataKey="value" stroke="none">
                            {seatData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[9px] font-black text-slate-400">{Math.round(occupancyRate)}%</span>
                </div>
            </div>
        </div>

        {/* Income vs Expense Mini Cards */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><TrendingUp size={10} className="text-emerald-500"/> মোট আয়</p>
            <p className="text-xl font-black text-emerald-600 tracking-tight">৳{totalIncome.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Wallet size={10} className="text-rose-500"/> মোট ব্যয়</p>
            <p className="text-xl font-black text-rose-500 tracking-tight">৳{totalExpenses.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Detailed Cost Breakdown Table */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="px-5 py-3 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                 <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                     <Activity size={14} className="text-slate-400"/> খরচের ব্রেকডাউন ও জনপ্রতি খরচ
                 </h3>
             </div>
             
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-100">
                            <th className="p-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider">খাত</th>
                            <th className="p-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right">মোট খরচ</th>
                            <th className="p-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right bg-slate-50/50">জনপ্রতি (সিট)</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs font-bold text-slate-600">
                        {[
                            { label: 'বাস ভাড়া', total: totalBusRent, icon: Bus, color: 'text-violet-600' },
                            { label: 'হোটেল ভাড়া', total: totalHotelCost, icon: Building, color: 'text-indigo-600' },
                            { label: 'খাবার', total: totalDailyMeals, icon: Utensils, color: 'text-orange-600' },
                            { label: 'লোকাল গাড়ি', total: totalDailyTransport, icon: Car, color: 'text-blue-600' },
                            { label: 'অন্যান্য', total: totalDailyExtra, icon: Coffee, color: 'text-slate-600' },
                            { label: 'ম্যানেজমেন্ট (Host)', total: totalHostFee, icon: Users, color: 'text-teal-600' },
                        ].map((item, i) => (
                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                <td className="p-3 flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${item.color.replace('text', 'bg')}`}></div>
                                    {item.label}
                                </td>
                                <td className="p-3 text-right font-mono text-slate-700">৳{item.total.toLocaleString()}</td>
                                <td className="p-3 text-right font-mono text-slate-500 bg-slate-50/30">৳{calcPerHead(item.total)}</td>
                            </tr>
                        ))}
                        <tr className="bg-slate-50/80">
                            <td className="p-3 text-[10px] font-black text-rose-600 uppercase">সর্বমোট</td>
                            <td className="p-3 text-right font-black text-rose-600 text-sm">৳{totalExpenses.toLocaleString()}</td>
                            <td className="p-3 text-right font-black text-rose-600 text-sm">৳{calcPerHead(totalExpenses)}</td>
                        </tr>
                    </tbody>
                </table>
             </div>
          </div>

          {/* Right: Summary & Chart */}
          <div className="space-y-4">
               {/* Net Profit Compact */}
               <div className={`rounded-2xl p-5 border shadow-sm relative overflow-hidden flex flex-col justify-between h-28 ${netProfit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                   <div>
                       <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>নেট প্রফিট / লস</p>
                       <h2 className={`text-3xl font-black tracking-tight ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                           {netProfit >= 0 ? '+' : ''}{netProfit.toLocaleString()}<span className="text-sm opacity-70 ml-1">৳</span>
                       </h2>
                   </div>
               </div>

               {/* Simple Bar Chart */}
               <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm h-48">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 text-center">আয় বনাম ব্যয়</p>
                    <ResponsiveContainer width="100%" height="80%">
                        <BarChart data={financialData} margin={{top: 5, right: 0, left: 0, bottom: 0}}>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} dy={5}/>
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold'}} />
                            <Bar dataKey="amount" radius={[6, 6, 6, 6]} barSize={40}>
                                {financialData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
               </div>
          </div>
      </div>
    </div>
  );
};

export default AnalysisTab;
