

import React, { useState, useEffect } from 'react';
import { CommonTabProps, PersonalData } from '../types';
import { calculateBusFare } from '../utils/calculations';
import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { TrendingUp, Users, DollarSign, AlertCircle, Bus, ChevronDown, Activity, Wallet, Building, Coffee, Car, Utensils } from 'lucide-react';

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

  // Fetch Personal Data to include in Analysis
  useEffect(() => {
    const fetchPersonalData = async () => {
        if (!activeTour || !user) return;
        try {
            const docRef = doc(db, 'personal', `${activeTour.id}_${user.uid}`);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as PersonalData;
                const pGuests = data.guests ? data.guests.reduce((sum, g) => sum + (Number(g.seatCount)||1), 0) : 0;
                
                // Calculate personal collection for accurate financial report
                const regCount = Number(data.personalStandardCount) || 0;
                const d1Count = Number(data.personalDisc1Count) || 0;
                const d2Count = Number(data.personalDisc2Count) || 0;
                const bookingFee = Number(data.bookingFee) || 0;

                const regFee = Number(activeTour.fees?.regular) || 0;
                const d1Fee = Number(activeTour.fees?.disc1) || 0;
                const d2Fee = Number(activeTour.fees?.disc2) || 0;

                // Priority: Use Guest List collection if available, else fallback to counters
                let pCollection = 0;
                if (data.guests && data.guests.length > 0) {
                     pCollection = data.guests.reduce((sum, g) => sum + (Number(g.collection)||0), 0) + bookingFee;
                } else {
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
        <TrendingUp size={24} className="mb-2 opacity-50"/>
        <p className="font-bold text-xs">কোন ট্যুর ডাটা পাওয়া যায়নি</p>
    </div>
  );

  if (!activeTour.busConfig || !activeTour.costs) {
    return (
      <div className="p-8 text-center text-rose-500 bg-rose-50 rounded-3xl border border-rose-100 text-sm font-bold shadow-sm">
        <AlertCircle className="mx-auto mb-3" size={24} />
        কনফিগারেশন অসম্পূর্ণ। এন্ট্রি ট্যাব চেক করুন।
      </div>
    );
  }

  // --- CALCULATIONS ---

  // 1. Occupancy: Agency + Personal
  const agencyGuests = activeTour.partnerAgencies 
    ? activeTour.partnerAgencies.reduce((sum, a) => sum + (a.guests?.reduce((gSum, g) => gSum + (Number(g.seatCount)||1), 0) || 0), 0) 
    : 0;

  const totalBooked = agencyGuests + personalGuestCount;
  const totalSeats = Number(activeTour.busConfig.totalSeats) || 40;
  const occupancyRate = Math.min((totalBooked / totalSeats) * 100, 100);
  const vacantSeats = Math.max(0, totalSeats - totalBooked);

  // 2. Financials
  const agencyCollection = activeTour.partnerAgencies 
    ? activeTour.partnerAgencies.reduce((sum, a) => 
        sum + (a.guests ? a.guests.reduce((gSum, g) => gSum + Number(g.collection || 0), 0) : 0), 0)
    : 0;
  
  const totalIncome = agencyCollection + personalCollection;

  // Expenses
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

  // Charts Data
  const seatData = [
    { name: 'বুকড', value: totalBooked, color: '#6366f1' },
    { name: 'খালি', value: vacantSeats, color: '#f1f5f9' },
  ];

  const financialData = [
    { name: 'ব্যয়', amount: totalExpenses, fill: '#ef4444' },
    { name: 'আয়', amount: totalIncome, fill: '#10b981' },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-20 max-w-5xl mx-auto font-sans">
      {/* Compact Selector */}
      <div className="flex items-center justify-between bg-white px-5 py-4 rounded-3xl border border-slate-100 shadow-lg shadow-slate-100/50 sticky top-0 z-20">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-violet-50 text-violet-600 rounded-2xl ring-4 ring-violet-50/50">
                <Activity size={20} />
            </div>
            <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">চলমান ট্যুর</p>
                <div className="relative group">
                    <select 
                        value={selectedTourId}
                        onChange={(e) => setSelectedTourId(e.target.value)}
                        className="appearance-none bg-transparent font-black text-slate-700 text-lg focus:outline-none cursor-pointer pr-8"
                    >
                        {tours.map(t => <option key={t.id} value={t.id}>{t.name} ({t.date})</option>)}
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-slate-600" size={16} strokeWidth={3} />
                </div>
            </div>
        </div>
        <div className={`px-4 py-2 rounded-2xl text-xs font-bold border-2 ${netProfit >= 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'} shadow-sm`}>
            {netProfit >= 0 ? 'লাভজনক' : 'লোকসান'}
        </div>
      </div>
      
      {/* Top Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Occupancy */}
        <div className="col-span-2 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-md shadow-slate-200/50 flex items-center justify-between relative overflow-hidden group">
            <div className="relative z-10">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">মোট বুকিং</p>
                <div className="flex items-baseline gap-1.5 mb-3">
                    <span className="text-4xl font-black text-slate-800 tracking-tight">{totalBooked}</span>
                    <span className="text-xs font-bold text-slate-400">/ {totalSeats} সিট</span>
                </div>
                <div className="flex gap-2">
                    <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-1 rounded-lg font-bold border border-blue-100">এজেন্সি: {agencyGuests}</span>
                    <span className="text-[9px] bg-purple-50 text-purple-600 px-2 py-1 rounded-lg font-bold border border-purple-100">পার্সোনাল: {personalGuestCount}</span>
                </div>
            </div>
            <div className="w-24 h-24 relative">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={seatData} innerRadius={25} outerRadius={40} paddingAngle={0} dataKey="value" stroke="none">
                            {seatData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-black text-slate-400">{Math.round(occupancyRate)}%</span>
                </div>
            </div>
        </div>

        {/* Income vs Expense Mini Cards */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-md shadow-slate-200/50 flex flex-col justify-center relative overflow-hidden group hover:-translate-y-1 transition-transform">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-50 rounded-full blur-2xl opacity-50"></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><TrendingUp size={12} className="text-emerald-500"/> মোট আয়</p>
            <p className="text-2xl font-black text-emerald-600 tracking-tight">৳{totalIncome.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-md shadow-slate-200/50 flex flex-col justify-center relative overflow-hidden group hover:-translate-y-1 transition-transform">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-rose-50 rounded-full blur-2xl opacity-50"></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Wallet size={12} className="text-rose-500"/> মোট ব্যয়</p>
            <p className="text-2xl font-black text-rose-500 tracking-tight">৳{totalExpenses.toLocaleString()}</p>
        </div>
      </div>

      {/* Main Analysis Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Detailed Cost Breakdown */}
          <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200/60 overflow-hidden shadow-lg shadow-slate-200/40">
             <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-white">
                 <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-3">
                     <div className="p-2 bg-slate-100 rounded-xl"><Activity size={16} className="text-slate-500"/></div>
                     খরচের ব্রেকডাউন
                 </h3>
                 <span className="text-[10px] font-bold bg-slate-50 border border-slate-200 px-3 py-1 rounded-full text-slate-400 uppercase tracking-wider">অটোমেটেড</span>
             </div>
             
             <div className="p-6 space-y-3">
                {[
                    { label: 'বাস ভাড়া (ফিক্সড)', amount: totalBusRent, icon: Bus, color: 'text-violet-500', bg: 'bg-violet-50', border: 'border-violet-100' },
                    { label: 'হোটেল খরচ', amount: totalHotelCost, icon: Building, color: 'text-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-100' },
                    { label: 'খাবার খরচ (মোট)', amount: totalDailyMeals, icon: Utensils, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' },
                    { label: 'লোকাল ট্রান্সপোর্ট', amount: totalDailyTransport, icon: Car, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100' },
                    { label: 'অন্যান্য / এক্সট্রা', amount: totalDailyExtra, icon: Coffee, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200' },
                    { label: 'হোস্ট ফি (স্যালারি)', amount: totalHostFee, icon: Users, color: 'text-teal-500', bg: 'bg-teal-50', border: 'border-teal-100' },
                ].map((item, i) => (
                    <div key={i} className={`flex items-center justify-between p-4 rounded-2xl border ${item.border} ${item.bg} bg-opacity-40 hover:bg-opacity-100 transition-all cursor-default`}>
                        <div className="flex items-center gap-4">
                            <div className={`p-2.5 rounded-xl bg-white shadow-sm ${item.color}`}>
                                <item.icon size={16} />
                            </div>
                            <span className="font-bold text-slate-700 text-xs uppercase tracking-wide">{item.label}</span>
                        </div>
                        <span className="font-mono font-black text-slate-800 text-sm">৳{item.amount.toLocaleString()}</span>
                    </div>
                ))}
                
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center px-4">
                    <span className="text-xs font-black text-rose-500 uppercase tracking-widest">সর্বমোট খরচ</span>
                    <span className="text-xl font-black text-rose-600 font-mono tracking-tight">৳{totalExpenses.toLocaleString()}</span>
                </div>
             </div>
          </div>

          {/* Right: Net Profit Card & Charts */}
          <div className="space-y-6">
               <div className={`rounded-[2.5rem] p-8 border shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[200px] transition-all duration-500 hover:scale-[1.02] ${netProfit >= 0 ? 'bg-gradient-to-bl from-emerald-500 to-teal-600 border-emerald-400 text-white shadow-emerald-200' : 'bg-gradient-to-bl from-rose-500 to-orange-600 border-rose-400 text-white shadow-rose-200'}`}>
                   <div className="relative z-10">
                       <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-2">নেট প্রফিট / লস</p>
                       <h2 className="text-4xl font-black tracking-tighter">
                           {netProfit >= 0 ? '+' : ''}{netProfit.toLocaleString()}<span className="text-xl opacity-70 ml-1">৳</span>
                       </h2>
                   </div>
                   <div className="relative z-10 mt-auto">
                        <div className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-white/20 px-3 py-1.5 rounded-xl border border-white/20 backdrop-blur-md">
                            {netProfit >= 0 ? <TrendingUp size={14}/> : <AlertCircle size={14}/>}
                            {netProfit >= 0 ? 'Profit Margin Active' : 'Loss Detected'}
                        </div>
                   </div>
                   {/* Decorative Icon */}
                   <div className="absolute -bottom-6 -right-6 text-white opacity-10 transform rotate-12">
                       <Wallet size={140} />
                   </div>
               </div>

               <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-lg shadow-slate-100/50 h-56">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 text-center">আয় বনাম ব্যয় গ্রাফ</p>
                    <ResponsiveContainer width="100%" height="80%">
                        <BarChart data={financialData} margin={{top: 0, right: 0, left: 0, bottom: 0}} barSize={50}>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#94a3b8'}} dy={10}/>
                            <Tooltip cursor={{fill: '#f8fafc', radius: 12}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold', padding: '12px 16px'}} />
                            <Bar dataKey="amount" radius={[8, 8, 8, 8]}>
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
