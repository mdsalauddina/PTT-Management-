import React, { useState, useEffect } from 'react';
import { CommonTabProps } from '../types';
import { calculateBusFare } from '../utils/calculations';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { TrendingUp, Users, DollarSign, AlertCircle, Bus, ChevronDown, Activity, Wallet } from 'lucide-react';

const AnalysisTab: React.FC<CommonTabProps> = ({ tours }) => {
  const [selectedTourId, setSelectedTourId] = useState<string>('');

  useEffect(() => {
    if (tours.length > 0 && !selectedTourId) {
        setSelectedTourId(tours[0].id);
    }
  }, [tours, selectedTourId]);

  const activeTour = tours.find(t => t.id === selectedTourId) || null;

  if (!activeTour) return (
    <div className="h-full flex flex-col items-center justify-center p-10 text-center text-slate-400">
        <div className="bg-slate-100 p-6 rounded-full mb-4"><TrendingUp size={32} /></div>
        <p className="font-bold text-sm">কোন ট্যুর ডাটা পাওয়া যায়নি</p>
    </div>
  );

  // Safety Check
  if (!activeTour.busConfig || !activeTour.costs) {
    return (
      <div className="p-8 text-center text-rose-500 bg-rose-50 m-4 rounded-[2rem] border border-rose-100 shadow-sm">
        <AlertCircle className="mx-auto mb-3" size={32} />
        <p className="font-bold text-lg">কনফিগারেশন অসম্পূর্ণ</p>
        <p className="text-sm mt-1 text-rose-400">দয়া করে এন্ট্রি ট্যাব থেকে ট্যুর এডিট করে সেভ করুন।</p>
      </div>
    );
  }

  const fareData = calculateBusFare(activeTour.busConfig);
  
  const totalGuests = activeTour.partnerAgencies 
    ? activeTour.partnerAgencies.reduce((sum, a) => sum + (a.guests?.length || 0), 0) 
    : 0;

  const totalSeats = Number(activeTour.busConfig.totalSeats) || 1;
  const occupancyRate = (totalGuests / totalSeats) * 100;

  const seatData = [
    { name: 'রেগুলার', value: Number(activeTour.busConfig.regularSeats) || 0 },
    { name: 'ডিস ১', value: Number(activeTour.busConfig.discount1Seats) || 0 },
    { name: 'ডিস ২', value: Number(activeTour.busConfig.discount2Seats) || 0 },
  ];
  const COLORS = ['#6366f1', '#10b981', '#f59e0b'];

  const totalCollection = activeTour.partnerAgencies 
    ? activeTour.partnerAgencies.reduce((sum, a) => 
        sum + (a.guests ? a.guests.reduce((gSum, g) => gSum + Number(g.collection || 0), 0) : 0), 0)
    : 0;
  
  const totalDailyExpenses = activeTour.costs?.dailyExpenses 
    ? activeTour.costs.dailyExpenses.reduce((sum, day) => sum + Number(day.breakfast||0) + Number(day.lunch||0) + Number(day.dinner||0) + Number(day.transport||0), 0)
    : 0;

  const totalCosts = Number(activeTour.busConfig.totalRent || 0) + Number(activeTour.costs.hostFee || 0) + totalDailyExpenses;
  const netProfit = totalCollection - totalCosts;

  const financialData = [
    { name: 'খরচ', amount: totalCosts, fill: '#ef4444' },
    { name: 'আয়', amount: totalCollection, fill: '#10b981' },
  ];

  return (
    <div className="p-4 space-y-6 animate-fade-in pb-24 lg:pb-10 max-w-5xl mx-auto">
      {/* Selector */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 relative z-20">
        <div className="p-3 bg-violet-50 rounded-xl text-violet-600">
            <TrendingUp size={20} />
        </div>
        <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">বিশ্লেষণ (Analysis)</label>
            <div className="relative">
                <select 
                    value={selectedTourId}
                    onChange={(e) => setSelectedTourId(e.target.value)}
                    className="w-full appearance-none bg-transparent text-slate-800 text-lg font-black focus:outline-none cursor-pointer pr-8"
                >
                    {tours.map(t => <option key={t.id} value={t.id}>{t.name} ({t.date})</option>)}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} strokeWidth={2.5} />
            </div>
        </div>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Occupancy Card */}
        <div className="relative overflow-hidden bg-slate-900 p-6 rounded-[2rem] shadow-xl text-white col-span-1 lg:col-span-2 group">
             <div className="absolute top-0 right-0 p-8 opacity-10 transform group-hover:scale-110 transition-transform duration-700">
                <Users size={100} />
             </div>
             <div className="relative z-10">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Bus size={12}/> বাস অকুপেন্সি
                </p>
                <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-black tracking-tighter">{occupancyRate.toFixed(0)}</span>
                    <span className="text-xl font-bold opacity-60">%</span>
                </div>
                <div className="mt-4 w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(occupancyRate, 100)}%` }}></div>
                </div>
                <p className="text-xs text-slate-400 mt-2 font-medium">{totalGuests} / {totalSeats} সিট বুকড</p>
             </div>
        </div>
        
        {/* Profit/Loss Card */}
        <div className={`relative overflow-hidden p-6 rounded-[2rem] shadow-xl text-white col-span-1 lg:col-span-2 flex flex-col justify-between group ${netProfit >= 0 ? 'bg-gradient-to-br from-emerald-600 to-teal-800' : 'bg-gradient-to-br from-rose-600 to-orange-800'}`}>
            <div className="absolute -bottom-6 -right-6 opacity-20 transform group-hover:rotate-12 transition-transform duration-700">
                <Wallet size={120} />
            </div>
            <div className="relative z-10">
                <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Activity size={12}/> নেট লাভ/ক্ষতি
                </p>
                <div className="flex items-center">
                    <span className="text-4xl font-black tracking-tighter">
                        {netProfit >= 0 ? '+' : ''}{netProfit.toLocaleString()}
                    </span>
                    <span className="text-xl ml-1 font-bold opacity-70">৳</span>
                </div>
            </div>
            <div className="relative z-10 mt-auto">
                <span className="inline-block text-[10px] font-bold bg-white/20 px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/10 uppercase tracking-wide">
                    {netProfit >= 0 ? 'লাভজনক ইভেন্ট' : 'লোকসান'}
                </span>
            </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 h-96 flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                    <div className="w-2 h-2 bg-violet-500 rounded-full mr-2"></div>সিট বিন্যাস
                </h3>
            </div>
            <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={seatData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                            {seatData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', fontWeight: 'bold', padding: '12px'}} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '12px', fontWeight: 'bold', color: '#64748b', paddingTop: '20px'}}/>
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 h-96 flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                    <div className="w-2 h-2 bg-rose-500 rounded-full mr-2"></div>আয় বনাম ব্যয়
                </h3>
            </div>
            <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financialData} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#cbd5e1', fontSize: 10, fontWeight: 600}} />
                        <Tooltip cursor={{fill: '#f8fafc', radius: 8}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', fontWeight: 'bold', padding: '12px'}} />
                        <Bar dataKey="amount" radius={[8, 8, 0, 0]} barSize={50}>
                          {
                            financialData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))
                          }
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      {/* Fare Breakdown Table */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 text-xs uppercase tracking-widest flex items-center gap-2">
                <Bus size={16} className="text-violet-500" /> বাস ভাড়া ক্যালকুলেশন
            </h3>
            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 font-bold uppercase tracking-wider">Automated</span>
        </div>
        <div className="divide-y divide-slate-50 text-sm">
            <div className="flex justify-between px-6 py-5 items-center group hover:bg-slate-50 transition-colors">
                <span className="text-slate-500 font-bold text-xs uppercase tracking-wide">বেস ফেয়ার (আসল খরচ)</span>
                <span className="font-mono font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">৳ {fareData.baseFare}</span>
            </div>
            <div className="flex justify-between px-6 py-5 bg-violet-50/30 border-l-4 border-violet-500 items-center">
                <div className="flex flex-col">
                    <span className="text-violet-900 font-bold text-sm">রেগুলার ভাড়া</span>
                    <span className="text-[10px] text-violet-400 font-bold uppercase tracking-wide mt-0.5">সাবসিডি সহ</span>
                </div>
                <span className="font-mono font-black text-violet-700 text-xl">৳ {fareData.regularFare}</span>
            </div>
            <div className="flex justify-between px-6 py-5 items-center group hover:bg-slate-50 transition-colors">
                <span className="text-slate-500 font-bold text-xs uppercase tracking-wide">ডিসকাউন্ট ১ ভাড়া</span>
                <span className="font-mono font-bold text-slate-700">৳ {fareData.discount1Fare}</span>
            </div>
            <div className="flex justify-between px-6 py-5 items-center group hover:bg-slate-50 transition-colors">
                <span className="text-slate-500 font-bold text-xs uppercase tracking-wide">ডিসকাউন্ট ২ ভাড়া</span>
                <span className="font-mono font-bold text-slate-700">৳ {fareData.discount2Fare}</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisTab;