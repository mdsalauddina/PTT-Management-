import React, { useState, useEffect } from 'react';
import { CommonTabProps, Guest } from '../types';
import { CheckCircle, AlertTriangle, TrendingUp, Users, DollarSign, Wallet, ChevronDown, Activity, ArrowRight, PieChart } from 'lucide-react';

const FinalTab: React.FC<CommonTabProps> = ({ user, tours }) => {
  const [selectedTourId, setSelectedTourId] = useState<string>('');

  useEffect(() => {
    if (tours.length > 0 && !selectedTourId) {
        setSelectedTourId(tours[0].id);
    }
  }, [tours, selectedTourId]);

  const activeTour = tours.find(t => t.id === selectedTourId) || null;

  if (user.role !== 'admin') return null;

  if (!activeTour) return (
    <div className="h-full flex flex-col items-center justify-center p-10 text-center text-slate-400">
        <div className="bg-slate-100 p-6 rounded-full mb-4"><CheckCircle size={32} /></div>
        <p className="font-bold text-sm">কোন ট্যুর ডাটা পাওয়া যায়নি</p>
    </div>
  );

  const getGuestSeatCount = (guest: Guest): number => {
    const count = Number(guest.seatCount);
    return isNaN(count) || count === 0 ? 1 : count;
  };

  const totalGuests = activeTour.partnerAgencies 
    ? activeTour.partnerAgencies.reduce((sum, a) => 
        sum + (a.guests?.reduce((gSum, g) => gSum + getGuestSeatCount(g), 0) || 0), 0)
    : 0;
  
  const totalCollection = activeTour.partnerAgencies 
    ? activeTour.partnerAgencies.reduce((sum, a) => 
        sum + (a.guests ? a.guests.reduce((g, guest) => g + Number(guest.collection || 0), 0) : 0), 0)
    : 0;

  const totalDailyExpenses = activeTour.costs?.dailyExpenses 
    ? activeTour.costs.dailyExpenses.reduce((sum, day) => sum + Number(day.breakfast||0) + Number(day.lunch||0) + Number(day.dinner||0) + Number(day.transport||0), 0)
    : 0;

  const totalFixedCosts = Number(activeTour.busConfig?.totalRent || 0) + Number(activeTour.costs?.hostFee || 0) + totalDailyExpenses;
  
  const netOperation = totalCollection - totalFixedCosts;

  return (
    <div className="p-4 space-y-6 animate-fade-in pb-24 lg:pb-10 max-w-4xl mx-auto">
      {/* Selector */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 relative z-20">
        <div className="p-3 bg-teal-50 rounded-xl text-teal-600">
            <CheckCircle size={20} />
        </div>
        <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">ফাইনাল রিপোর্ট</label>
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

      {/* Hero Card */}
      <div className={`relative overflow-hidden rounded-[2.5rem] p-10 text-white shadow-2xl transition-all duration-500 ${netOperation >= 0 ? 'bg-gradient-to-br from-emerald-600 to-teal-800 shadow-emerald-500/30' : 'bg-gradient-to-br from-rose-600 to-orange-800 shadow-rose-500/30'}`}>
        {/* Background Mesh */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-10 rounded-full -mr-20 -mt-20 blur-3xl mix-blend-overlay"></div>
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-black opacity-10 rounded-full -ml-20 -mb-20 blur-3xl mix-blend-overlay"></div>
        
        <div className="relative z-10">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-black tracking-tighter mb-1">নেট অপারেশন রেজাল্ট</h2>
                    <p className="opacity-80 text-xs font-bold tracking-widest uppercase flex items-center gap-2">
                         {activeTour.name} <span className="w-1 h-1 bg-white rounded-full"></span> {activeTour.date}
                    </p>
                </div>
                <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md border border-white/10">
                    <Activity size={28} className="text-white" />
                </div>
            </div>
            
            <div className="mt-12">
                <p className="text-white/70 text-[10px] uppercase font-bold tracking-widest mb-2 flex items-center gap-2">
                    মোট লাভ / (লোকসান)
                </p>
                <div className="flex items-baseline gap-2">
                    <p className="text-6xl font-black tracking-tighter drop-shadow-sm">৳ {Math.abs(netOperation).toLocaleString()}</p>
                </div>
                <div className={`inline-flex items-center px-5 py-2.5 rounded-2xl text-xs mt-6 font-bold shadow-lg backdrop-blur-md border transition-all hover:scale-105 ${netOperation >= 0 ? 'bg-emerald-400/20 text-emerald-50 border-emerald-400/30' : 'bg-rose-900/20 text-rose-50 border-rose-400/30'}`}>
                    {netOperation >= 0 ? <CheckCircle size={16} className="mr-2"/> : <AlertTriangle size={16} className="mr-2"/>}
                    {netOperation >= 0 ? 'লাভজনক ইভেন্ট' : 'লোকসানি ইভেন্ট'}
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center group hover:shadow-md transition-all">
             <div className="bg-blue-50 p-4 rounded-2xl text-blue-600 mb-4 group-hover:scale-110 transition-transform"><Users size={24}/></div>
             <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">মোট গেস্ট</p>
             <p className="text-3xl font-black text-slate-800 mt-2">{totalGuests}</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center group hover:shadow-md transition-all">
             <div className="bg-purple-50 p-4 rounded-2xl text-purple-600 mb-4 group-hover:scale-110 transition-transform"><PieChart size={24}/></div>
             <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">অকুপেন্সি</p>
             <p className="text-3xl font-black text-slate-800 mt-2">
               {activeTour.busConfig?.totalSeats ? ((totalGuests/activeTour.busConfig.totalSeats)*100).toFixed(0) : 0}<span className="text-lg text-slate-400 ml-1">%</span>
             </p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center md:col-span-2 group hover:shadow-md transition-all">
             <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600 mb-4 group-hover:scale-110 transition-transform"><DollarSign size={24}/></div>
             <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">মোট কালেকশন</p>
             <p className="text-4xl font-black text-slate-800 mt-2">৳ {totalCollection.toLocaleString()}</p>
          </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-700 flex items-center text-xs uppercase tracking-widest"><Wallet size={16} className="mr-2 text-violet-500"/> বিস্তারিত খরচ</h3>
          </div>
          <div className="p-6 space-y-4 text-sm">
              <div className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors">
                  <span className="text-slate-500 font-bold text-xs uppercase">বাস ভাড়া (ফিক্সড)</span>
                  <span className="font-mono font-bold text-slate-700">৳ {Number(activeTour.busConfig?.totalRent || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors">
                  <span className="text-slate-500 font-bold text-xs uppercase">হোস্ট ফি (স্যালারি)</span>
                  <span className="font-mono font-bold text-slate-700">৳ {Number(activeTour.costs?.hostFee || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors">
                  <span className="text-slate-500 font-bold text-xs uppercase">খাবার ও লোকাল ট্রান্সপোর্ট</span>
                  <span className="font-mono font-bold text-slate-700">৳ {totalDailyExpenses.toLocaleString()}</span>
              </div>
              <div className="h-px bg-slate-100 my-2"></div>
              <div className="flex justify-between items-center bg-rose-50 p-4 rounded-xl border border-rose-100">
                  <span className="text-rose-700 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                     <TrendingUp size={16}/> মোট খরচ
                  </span>
                  <span className="font-black text-rose-600 text-xl font-mono">- ৳ {totalFixedCosts.toLocaleString()}</span>
              </div>
          </div>
      </div>
    </div>
  );
};

export default FinalTab;