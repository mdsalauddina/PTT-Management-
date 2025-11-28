
import React, { useState, useEffect } from 'react';
import { CommonTabProps, Guest } from '../types';
import { CheckCircle, AlertTriangle, TrendingUp, Users, DollarSign, Wallet, ChevronDown, Activity } from 'lucide-react';

const FinalTab: React.FC<CommonTabProps> = ({ user, tours }) => {
  // 1. ALL HOOKS MUST BE AT THE TOP LEVEL
  const [selectedTourId, setSelectedTourId] = useState<string>('');

  useEffect(() => {
    if (tours.length > 0 && !selectedTourId) {
        setSelectedTourId(tours[0].id);
    }
  }, [tours, selectedTourId]);

  // 2. Conditional Logic (After hooks)
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
      {/* Improved Selector */}
      <div className="mb-6">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Select Tour</label>
        <div className="relative">
            <select 
                value={selectedTourId}
                onChange={(e) => setSelectedTourId(e.target.value)}
                className="w-full appearance-none bg-white border-2 border-slate-200 text-slate-800 py-4 pl-5 pr-12 rounded-2xl text-lg font-black focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all shadow-sm"
            >
                {tours.map(t => <option key={t.id} value={t.id}>{t.name} ({t.date})</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={24} strokeWidth={2.5} />
        </div>
      </div>

      <div className={`relative overflow-hidden rounded-[2rem] p-8 text-white shadow-2xl ${netOperation >= 0 ? 'bg-gradient-to-br from-emerald-600 to-teal-800' : 'bg-gradient-to-br from-rose-500 to-orange-700'}`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <div className="relative z-10">
            <h2 className="text-2xl font-black tracking-tight mb-1">Net Operation Result</h2>
            <p className="opacity-80 text-xs font-bold tracking-widest uppercase">{activeTour.name} • {activeTour.date}</p>
            
            <div className="mt-10">
                <p className="text-white/70 text-[10px] uppercase font-bold tracking-widest mb-1 flex items-center gap-2">
                    <Activity size={12}/> মোট লাভ / (লোকসান)
                </p>
                <div className="flex items-baseline gap-2">
                    <p className="text-5xl font-black tracking-tighter drop-shadow-sm">৳ {Math.abs(netOperation).toLocaleString()}</p>
                </div>
                <div className={`inline-flex items-center px-4 py-2 rounded-xl text-xs mt-5 font-bold shadow-lg backdrop-blur-md border ${netOperation >= 0 ? 'bg-emerald-400/20 text-emerald-50 border-emerald-400/30' : 'bg-rose-900/20 text-rose-50 border-rose-400/30'}`}>
                    {netOperation >= 0 ? <CheckCircle size={14} className="mr-2"/> : <AlertTriangle size={14} className="mr-2"/>}
                    {netOperation >= 0 ? 'Profitable' : 'Loss Making'}
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
             <div className="bg-blue-50 p-3.5 rounded-2xl text-blue-600 mb-3"><Users size={24}/></div>
             <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">মোট গেস্ট</p>
             <p className="text-2xl font-black text-slate-800 mt-1">{totalGuests}</p>
          </div>
          <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
             <div className="bg-purple-50 p-3.5 rounded-2xl text-purple-600 mb-3"><TrendingUp size={24}/></div>
             <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">অকুপেন্সি</p>
             <p className="text-2xl font-black text-slate-800 mt-1">
               {activeTour.busConfig?.totalSeats ? ((totalGuests/activeTour.busConfig.totalSeats)*100).toFixed(0) : 0}%
             </p>
          </div>
          <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center md:col-span-2">
             <div className="bg-emerald-50 p-3.5 rounded-2xl text-emerald-600 mb-3"><DollarSign size={24}/></div>
             <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">মোট কালেকশন (Revenue)</p>
             <p className="text-2xl font-black text-slate-800 mt-1">৳ {totalCollection.toLocaleString()}</p>
          </div>
      </div>

      <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50">
              <h3 className="font-bold text-slate-700 flex items-center text-xs uppercase tracking-widest"><DollarSign size={14} className="mr-2 text-violet-500"/> বিস্তারিত খরচ</h3>
          </div>
          <div className="p-6 space-y-4 text-sm">
              <div className="flex justify-between items-center text-slate-500 text-xs">
                  <span>বাস ভাড়া (Fixed)</span>
                  <span className="font-mono">৳ {Number(activeTour.busConfig?.totalRent || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500 text-xs">
                  <span>হোস্ট ফি (Salary)</span>
                  <span className="font-mono">৳ {Number(activeTour.costs?.hostFee || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500 text-xs">
                  <span>খাবার ও লোকাল ট্রান্সপোর্ট (Variable)</span>
                  <span className="font-mono">৳ {totalDailyExpenses.toLocaleString()}</span>
              </div>
              <div className="h-px bg-slate-100 my-2"></div>
              <div className="flex justify-between items-center pt-2">
                  <span className="text-slate-800 font-bold text-xs uppercase">মোট খরচ</span>
                  <span className="font-black text-rose-500 text-lg font-mono">- ৳ {totalFixedCosts.toLocaleString()}</span>
              </div>
          </div>
      </div>
    </div>
  );
};

export default FinalTab;
