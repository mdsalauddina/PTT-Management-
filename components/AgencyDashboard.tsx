
import React, { useState, useEffect } from 'react';
import { Tour, UserProfile, Guest, PartnerAgency } from '../types';
import { db } from '../services/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { ChevronDown, LogOut, Users, Plus, Phone, Info, Star, Calendar, History, Wallet, LayoutGrid, Sparkles } from 'lucide-react';
import { calculateAgencySettlement } from '../utils/calculations';

interface AgencyDashboardProps {
  user: UserProfile;
  tours: Tour[];
  refreshTours: () => Promise<void>;
  handleLogout: () => void;
}

const AgencyDashboard: React.FC<AgencyDashboardProps> = ({ user, tours, refreshTours, handleLogout }) => {
  const [activeTab, setActiveTab] = useState<'booking' | 'history'>('booking');
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  const [isAddingBooking, setIsAddingBooking] = useState(false);
  const [newBooking, setNewBooking] = useState({ name: '', phone: '', seatCount: '', unitPrice: '' });

  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateString();
  const upcomingTours = tours.filter(t => t.date >= todayStr);
  const pastTours = tours.filter(t => {
      const isPast = t.date < todayStr;
      const participated = t.partnerAgencies?.some(a => a.email === user.email);
      return isPast && participated;
  });

  const displayTours = activeTab === 'booking' ? upcomingTours : pastTours;

  useEffect(() => {
    if (displayTours.length > 0) {
        setSelectedTourId(displayTours[0].id);
    } else {
        setSelectedTourId('');
    }
  }, [activeTab, tours.length]); 

  const activeTour = tours.find(t => t.id === selectedTourId) || null;
  const myAgencyData = activeTour?.partnerAgencies?.find(a => a.email === user.email);

  const safeNum = (val: any) => Number(val) || 0;
  const hasGuests = myAgencyData && myAgencyData.guests && myAgencyData.guests.length > 0;
  
  const settlement = (activeTour && myAgencyData) ? calculateAgencySettlement(activeTour, myAgencyData) : null;

  // Breakdown Calculation for Display
  const calculateBreakdown = () => {
      if (!activeTour) return null;
      const totalSeats = safeNum(activeTour.busConfig?.totalSeats) || 1;
      const hostFee = safeNum(activeTour.costs?.hostFee);
      const hotelCost = safeNum(activeTour.costs?.hotelCost);
      const dailyExpensesTotal = activeTour.costs?.dailyExpenses ? activeTour.costs.dailyExpenses.reduce((sum, day) => 
          sum + safeNum(day.breakfast) + safeNum(day.lunch) + safeNum(day.dinner) + safeNum(day.transport) + safeNum(day.other), 0
      ) : 0;

      // Per Head Fixed & Variable
      const perHeadBus = Math.ceil(safeNum(activeTour.busConfig?.totalRent) / totalSeats);
      const perHeadHotel = Math.ceil(hotelCost / totalSeats);
      const perHeadMgmt = Math.ceil(hostFee / totalSeats);
      const perHeadDaily = Math.ceil(dailyExpensesTotal / totalSeats);
      
      const totalPerHead = perHeadBus + perHeadHotel + perHeadMgmt + perHeadDaily;

      return { perHeadBus, perHeadHotel, perHeadMgmt, perHeadDaily, totalPerHead };
  };
  
  const breakdown = calculateBreakdown();

  const handleAddBooking = async () => {
      if (!activeTour) return;
      if (!newBooking.name || !newBooking.seatCount) {
          alert("নাম এবং সিট সংখ্যা দিন।");
          return;
      }

      let agencies = activeTour.partnerAgencies ? JSON.parse(JSON.stringify(activeTour.partnerAgencies)) : [];
      let agencyIndex = agencies.findIndex((a: PartnerAgency) => a.email === user.email);
      
      if (agencyIndex === -1) {
          const newAgencyProfile: PartnerAgency = {
              id: `agency_${Date.now()}`,
              name: user.email.split('@')[0], 
              email: user.email,
              phone: '',
              guests: [],
              expenses: []
          };
          agencies.push(newAgencyProfile);
          agencyIndex = agencies.length - 1;
      }

      const seatCount = safeNum(newBooking.seatCount);
      const unitPrice = safeNum(newBooking.unitPrice); 

      const newGuest: Guest = {
          id: `g_${Date.now()}`,
          name: newBooking.name,
          phone: newBooking.phone || '',
          seatCount: seatCount,
          unitPrice: unitPrice,
          collection: seatCount * unitPrice,
          seatType: 'regular' 
      };

      if (!agencies[agencyIndex].guests) agencies[agencyIndex].guests = [];
      agencies[agencyIndex].guests.push(newGuest);

      try {
        const tourRef = doc(db, 'tours', activeTour.id);
        await updateDoc(tourRef, { partnerAgencies: agencies, updatedAt: Timestamp.now() });
        await refreshTours();
        setNewBooking({ name: '', phone: '', seatCount: '', unitPrice: '' });
        setIsAddingBooking(false);
      } catch (error) {
        console.error("Error adding booking:", error);
        alert("বুকিং যোগ করা যায়নি।");
      }
  };

  return (
    <div className="pb-20 lg:pb-10 min-h-screen flex flex-col bg-slate-50 font-sans text-slate-800">
      {/* Compact Header */}
      <div className="bg-white/90 backdrop-blur-xl border-b border-slate-200 px-4 py-3 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2">
           <div className="bg-slate-800 text-white p-2 rounded-xl shadow-md">
               <LayoutGrid size={18} />
           </div>
           <div>
               <h1 className="text-sm font-black text-slate-800 tracking-tight leading-none">এজেন্সি পোর্টাল</h1>
           </div>
        </div>
        <button onClick={handleLogout} className="p-2 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-100">
            <LogOut size={16} />
        </button>
      </div>

      {/* Compact Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 pt-2 sticky top-[58px] z-20">
          <div className="flex gap-4 max-w-4xl mx-auto">
              <button onClick={() => setActiveTab('booking')}
                className={`flex-1 pb-3 text-[10px] font-black uppercase tracking-widest flex justify-center items-center gap-1.5 border-b-2 transition-all ${activeTab === 'booking' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                  <Calendar size={12}/> বুকিং
              </button>
              <button onClick={() => setActiveTab('history')}
                className={`flex-1 pb-3 text-[10px] font-black uppercase tracking-widest flex justify-center items-center gap-1.5 border-b-2 transition-all ${activeTab === 'history' ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                  <History size={12}/> রিপোর্ট
              </button>
          </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4 w-full flex-1">
        
        {/* Compact Tour Selector */}
        {displayTours.length > 0 ? (
            <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 relative z-10">
                <div className={`p-2 rounded-xl ${activeTab === 'booking' ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600'}`}>
                    {activeTab === 'booking' ? <Sparkles size={16} /> : <History size={16} />}
                </div>
                <div className="flex-1">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ট্যুর নির্বাচন</p>
                    <div className="relative -mt-1">
                        <select 
                            value={selectedTourId}
                            onChange={(e) => setSelectedTourId(e.target.value)}
                            className="w-full appearance-none bg-transparent text-slate-800 text-sm font-black focus:outline-none cursor-pointer pr-6 py-1"
                        >
                            {displayTours.map(t => <option key={t.id} value={t.id}>{t.name} ({t.date})</option>)}
                        </select>
                        <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} strokeWidth={2.5} />
                    </div>
                </div>
            </div>
        ) : (
            <div className="p-10 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 text-xs">
                {activeTab === 'booking' ? 'কোনো আসন্ন ট্যুর নেই।' : 'কোনো হিস্ট্রি পাওয়া যায়নি।'}
            </div>
        )}

        {activeTour && (
            <>
                {/* 1. FINANCIAL SUMMARY & BREAKDOWN */}
                {(activeTab === 'history' || (activeTab === 'booking' && hasGuests)) && settlement && breakdown && (
                    <div className="animate-fade-in space-y-4">
                        
                        {/* Per Person Breakdown Card */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
                                <Info size={14} className="text-slate-400"/>
                                <h3 className="font-bold text-slate-700 text-[10px] uppercase tracking-widest">জনপ্রতি খরচের ব্রেকডাউন</h3>
                            </div>
                            <div className="p-5">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">বাস ভাড়া</p>
                                        <p className="font-bold text-slate-700">৳{breakdown.perHeadBus}</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">হোটেল</p>
                                        <p className="font-bold text-slate-700">৳{breakdown.perHeadHotel}</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">খাবার ও অন্যান্য</p>
                                        <p className="font-bold text-slate-700">৳{breakdown.perHeadDaily}</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">ম্যানেজমেন্ট</p>
                                        <p className="font-bold text-slate-700">৳{breakdown.perHeadMgmt}</p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-500 uppercase">মোট রেট (জনপ্রতি)</span>
                                    <span className="text-base font-black text-slate-800">৳{settlement.rates.regular}</span>
                                </div>
                            </div>
                        </div>

                        {/* Totals Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                             <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                 <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">মোট বিল</p>
                                 <p className="text-xl font-black text-slate-800 mt-1">৳{settlement.fixedCostShare.toLocaleString()}</p>
                                 <p className="text-[9px] text-slate-400 mt-1 font-bold">{settlement.totalSeats} সিট</p>
                             </div>
                             <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                 <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">কালেকশন</p>
                                 <p className="text-xl font-black text-emerald-600 mt-1">৳{settlement.totalCollection.toLocaleString()}</p>
                             </div>
                             <div className={`p-4 rounded-2xl border flex flex-col justify-center ${settlement.netAmount >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                                 <p className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 ${settlement.netAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    <Wallet size={12}/> নেট সেটেলমেন্ট
                                 </p>
                                 <p className={`text-xl font-black mt-1 ${settlement.netAmount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                     {settlement.netAmount >= 0 ? '+' : ''}{settlement.netAmount.toLocaleString()} ৳
                                 </p>
                                 <p className={`text-[9px] font-bold mt-0.5 ${settlement.netAmount >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                     {settlement.netAmount >= 0 ? 'পাবেন' : 'দিতে হবে'}
                                 </p>
                             </div>
                        </div>
                    </div>
                )}

                {/* 2. GUEST MANAGEMENT */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
                    <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10">
                        <h3 className="font-bold text-slate-700 text-[10px] uppercase tracking-widest flex items-center gap-2">
                            <Users size={14} className="text-slate-400"/> গেস্ট লিস্ট
                        </h3>
                        {activeTab === 'booking' && (
                            <button 
                                onClick={() => setIsAddingBooking(!isAddingBooking)} 
                                className="text-[9px] font-bold bg-slate-900 text-white px-3 py-1.5 rounded-lg uppercase tracking-wide flex items-center gap-1.5 shadow-md hover:bg-slate-800 transition-all"
                            >
                                <Plus size={12}/> নতুন গেস্ট
                            </button>
                        )}
                    </div>

                    {isAddingBooking && activeTab === 'booking' && (
                        <div className="p-5 bg-slate-50 border-b border-slate-100 animate-fade-in">
                            <div className="grid grid-cols-1 gap-3 mb-4">
                                <div>
                                    <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 block mb-1">নাম</label>
                                    <input className="w-full border border-slate-200 bg-white p-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100" placeholder="নাম" value={newBooking.name} onChange={e => setNewBooking({...newBooking, name: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 block mb-1">মোবাইল</label>
                                        <input className="w-full border border-slate-200 bg-white p-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100" placeholder="ফোন" value={newBooking.phone} onChange={e => setNewBooking({...newBooking, phone: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 block mb-1">সিট</label>
                                        <input type="number" className="w-full border border-slate-200 bg-white p-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100" placeholder="1" value={newBooking.seatCount} onChange={e => setNewBooking({...newBooking, seatCount: e.target.value})} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 block mb-1">কালেকশন (বাকি)</label>
                                    <input type="number" className="w-full border border-emerald-200 bg-emerald-50/50 p-3 rounded-xl text-xs font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-100" placeholder="0" value={newBooking.unitPrice} onChange={e => setNewBooking({...newBooking, unitPrice: e.target.value})} />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setIsAddingBooking(false)} className="px-4 py-2 rounded-lg text-slate-500 font-bold text-[10px] hover:bg-slate-200">বাতিল</button>
                                <button onClick={handleAddBooking} className="px-5 py-2 bg-blue-600 text-white rounded-lg font-bold text-[10px] shadow-md hover:bg-blue-700">কনফার্ম</button>
                            </div>
                        </div>
                    )}

                    {!hasGuests ? (
                        <div className="p-10 text-center text-slate-400 text-xs font-bold italic">কোনো গেস্ট নেই।</div>
                    ) : (
                        <div className="space-y-2 p-4 bg-slate-50/30">
                            {myAgencyData.guests.map((guest, idx) => (
                                <div key={guest.id} className="p-3 flex justify-between items-center bg-white rounded-xl border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-[10px] font-bold">
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-xs">{guest.name}</p>
                                            <p className="text-[9px] text-slate-400 font-bold flex items-center gap-1"><Phone size={8}/> {guest.phone || '-'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-bold bg-slate-50 px-2 py-0.5 rounded border border-slate-100 text-slate-600 mr-2">{guest.seatCount} সিট</span>
                                        <span className="text-[10px] font-black text-emerald-600">৳{guest.collection}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default AgencyDashboard;
