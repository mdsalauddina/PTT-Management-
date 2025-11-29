

import React, { useState, useEffect } from 'react';
import { Tour, UserProfile, Guest, PartnerAgency } from '../types';
import { db } from '../services/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { ChevronDown, LogOut, Users, Plus, Phone, Info, Star, Calendar, History, Wallet, CheckCircle, LayoutGrid, Sparkles } from 'lucide-react';
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

  const handleAddBooking = async () => {
      if (!activeTour) return;
      if (!newBooking.name || !newBooking.seatCount) {
          alert("অনুগ্রহ করে নাম এবং সিট সংখ্যা দিন।");
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
        alert("বুকিং যোগ করা যায়নি। ইন্টারনেট চেক করুন।");
      }
  };

  return (
    <div className="pb-20 lg:pb-10 min-h-screen flex flex-col bg-slate-50 font-sans">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
           <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-2.5 rounded-2xl shadow-lg shadow-slate-300">
               <LayoutGrid size={22} />
           </div>
           <div>
               <h1 className="text-lg font-black text-slate-800 tracking-tight leading-none">এজেন্সি পোর্টাল</h1>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{user.email}</p>
           </div>
        </div>
        <button onClick={handleLogout} className="p-3 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-2xl transition-colors border border-rose-100 shadow-sm">
            <LogOut size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 pt-3 sticky top-[76px] z-20 shadow-sm/50">
          <div className="flex gap-4 max-w-4xl mx-auto">
              <button 
                onClick={() => setActiveTab('booking')}
                className={`flex-1 pb-4 text-xs font-black uppercase tracking-widest flex justify-center items-center gap-2 border-b-4 transition-all rounded-t-lg ${activeTab === 'booking' ? 'border-blue-600 text-blue-600 bg-blue-50/20' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
              >
                  <Calendar size={14}/> বুকিং ও একটিভ
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`flex-1 pb-4 text-xs font-black uppercase tracking-widest flex justify-center items-center gap-2 border-b-4 transition-all rounded-t-lg ${activeTab === 'history' ? 'border-violet-600 text-violet-600 bg-violet-50/20' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
              >
                  <History size={14}/> হিস্ট্রি ও রিপোর্ট
              </button>
          </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6 w-full flex-1">
        
        {/* Tour Selector */}
        {displayTours.length > 0 ? (
            <div className="bg-white p-2 rounded-[2rem] shadow-lg shadow-slate-200/50 border border-slate-100 flex items-center gap-4 relative z-20">
                <div className={`p-3.5 rounded-2xl ${activeTab === 'booking' ? 'bg-blue-50 text-blue-600 ring-4 ring-blue-50/50' : 'bg-violet-50 text-violet-600 ring-4 ring-violet-50/50'}`}>
                    {activeTab === 'booking' ? <Sparkles size={20} /> : <History size={20} />}
                </div>
                <div className="flex-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                        {activeTab === 'booking' ? 'আসন্ন ট্যুর' : 'অতীতের ট্যুর'}
                    </label>
                    <div className="relative">
                        <select 
                            value={selectedTourId}
                            onChange={(e) => setSelectedTourId(e.target.value)}
                            className="w-full appearance-none bg-transparent text-slate-800 text-lg font-black focus:outline-none cursor-pointer pr-8"
                        >
                            {displayTours.map(t => <option key={t.id} value={t.id}>{t.name} ({t.date})</option>)}
                        </select>
                        <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} strokeWidth={2.5} />
                    </div>
                </div>
            </div>
        ) : (
            <div className="p-16 text-center text-slate-400 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                {activeTab === 'booking' ? 'কোনো আসন্ন ট্যুর নেই।' : 'কোনো হিস্ট্রি পাওয়া যায়নি।'}
            </div>
        )}

        {/* Content Area */}
        {activeTour && (
            <>
                {/* 1. FINANCIAL SUMMARY */}
                {(activeTab === 'history' || (activeTab === 'booking' && hasGuests)) && settlement && (
                    <div className="animate-fade-in space-y-6">
                        {/* Buy Rates */}
                        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                            <div className="px-8 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
                                <Info size={16} className="text-slate-400"/>
                                <h3 className="font-bold text-slate-700 text-xs uppercase tracking-widest">খরচের হিসাব (বাই রেট)</h3>
                            </div>
                            <div className="p-8">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50 text-center">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase mb-2 tracking-wider">রেগুলার</p>
                                        <p className="font-black text-slate-800 text-xl">৳{settlement.rates.regular}</p>
                                    </div>
                                    <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50 text-center">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase mb-2 tracking-wider">ডিস ১</p>
                                        <p className="font-black text-slate-800 text-xl">৳{settlement.rates.d1}</p>
                                    </div>
                                    <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50 text-center">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase mb-2 tracking-wider">ডিস ২</p>
                                        <p className="font-black text-slate-800 text-xl">৳{settlement.rates.d2}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Totals */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">মোট বিল</p>
                                 <p className="text-3xl font-black text-slate-800 mt-2">৳{settlement.fixedCostShare.toLocaleString()}</p>
                                 <p className="text-[10px] text-slate-400 mt-1 font-bold bg-slate-50 inline-block px-2 py-0.5 rounded-lg border border-slate-100">{settlement.totalSeats} সিট বুকড</p>
                             </div>
                             <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">হোস্ট কালেকশন</p>
                                 <p className="text-3xl font-black text-emerald-600 mt-2">৳{settlement.totalCollection.toLocaleString()}</p>
                             </div>
                             <div className={`p-6 rounded-[2.5rem] shadow-sm border flex flex-col justify-center transition-all ${settlement.netAmount >= 0 ? 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100' : 'bg-rose-50 border-rose-100 hover:bg-rose-100'}`}>
                                 <div className="flex items-center gap-2 mb-2">
                                     <Wallet size={16} className={settlement.netAmount >= 0 ? 'text-emerald-500' : 'text-rose-500'}/>
                                     <p className={`text-[10px] font-bold uppercase tracking-widest ${settlement.netAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        নেট সেটেলমেন্ট
                                     </p>
                                 </div>
                                 <p className={`text-3xl font-black ${settlement.netAmount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                     {settlement.netAmount >= 0 ? '+' : ''}{settlement.netAmount.toLocaleString()} ৳
                                 </p>
                                 <p className={`text-[10px] font-bold mt-1 ${settlement.netAmount >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                     {settlement.netAmount >= 0 ? 'আপনি পাবেন' : 'আপনাকে দিতে হবে'}
                                 </p>
                             </div>
                        </div>
                    </div>
                )}

                {/* 2. GUEST MANAGEMENT */}
                <div className="bg-white rounded-[2.5rem] shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden animate-fade-in">
                    <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10">
                        <h3 className="font-bold text-slate-700 text-xs uppercase tracking-widest flex items-center gap-3">
                            <div className="p-2 bg-slate-100 rounded-xl"><Users size={16} className="text-slate-500"/></div>
                            গেস্ট লিস্ট
                        </h3>
                        
                        {/* ADD BUTTON */}
                        {activeTab === 'booking' && (
                            <button 
                                onClick={() => setIsAddingBooking(!isAddingBooking)} 
                                className="text-[10px] font-bold bg-slate-900 text-white px-5 py-2.5 rounded-xl uppercase tracking-wide flex items-center gap-2 shadow-lg hover:bg-slate-800 transition-all active:scale-95 hover:scale-105"
                            >
                                <Plus size={14}/> নতুন গেস্ট যোগ
                            </button>
                        )}
                    </div>

                    {/* ADD FORM */}
                    {isAddingBooking && activeTab === 'booking' && (
                        <div className="p-8 bg-slate-50/50 border-b border-slate-100 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block">গেস্ট নাম</label>
                                    <input className="w-full border border-slate-200 bg-white p-4 rounded-2xl text-sm outline-none font-bold focus:ring-4 focus:ring-blue-500/10 transition-all" placeholder="নাম লিখুন" value={newBooking.name} onChange={e => setNewBooking({...newBooking, name: e.target.value})} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block">মোবাইল নম্বর</label>
                                    <input className="w-full border border-slate-200 bg-white p-4 rounded-2xl text-sm outline-none font-bold focus:ring-4 focus:ring-blue-500/10 transition-all" placeholder="017..." value={newBooking.phone} onChange={e => setNewBooking({...newBooking, phone: e.target.value})} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block">সিট সংখ্যা</label>
                                    <input type="number" className="w-full border border-slate-200 bg-white p-4 rounded-2xl text-sm outline-none font-bold focus:ring-4 focus:ring-blue-500/10 transition-all" placeholder="1" value={newBooking.seatCount} onChange={e => setNewBooking({...newBooking, seatCount: e.target.value})} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block">কালেকশন (বাকি)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">৳</span>
                                        <input type="number" className="w-full border border-emerald-200 bg-emerald-50/50 pl-8 pr-4 py-4 rounded-2xl text-sm outline-none font-bold text-emerald-700 focus:ring-4 focus:ring-emerald-500/20 transition-all" placeholder="0" value={newBooking.unitPrice} onChange={e => setNewBooking({...newBooking, unitPrice: e.target.value})} />
                                    </div>
                                    <p className="text-[9px] text-slate-400 ml-2 mt-1">বাসে হোস্ট এই পরিমাণ টাকা তুলবে।</p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setIsAddingBooking(false)} className="px-6 py-3 rounded-xl text-slate-500 font-bold text-xs hover:bg-slate-200 transition-colors">বাতিল</button>
                                <button onClick={handleAddBooking} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-xl hover:bg-blue-700 transition-all uppercase tracking-wide hover:scale-105">বুকিং নিশ্চিত করুন</button>
                            </div>
                        </div>
                    )}

                    {/* LIST */}
                    {!hasGuests ? (
                        <div className="p-16 text-center flex flex-col items-center justify-center text-slate-400 bg-slate-50/30 m-6 rounded-3xl border-2 border-dashed border-slate-100">
                            <div className="bg-slate-50 p-4 rounded-full mb-3">
                                <Users size={32} className="opacity-40"/>
                            </div>
                            <p className="font-bold text-sm">কোনো গেস্ট নেই।</p>
                            {activeTab === 'booking' && <p className="text-xs mt-1">বুকিং করতে "নতুন গেস্ট যোগ" এ ক্লিক করুন।</p>}
                        </div>
                    ) : (
                        <div className="space-y-3 p-6 bg-slate-50/30">
                            {myAgencyData.guests.map((guest, idx) => (
                                <div key={guest.id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all group">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold">
                                                {idx + 1}
                                            </div>
                                            <p className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                                                {guest.name}
                                            </p>
                                            {guest.seatType && guest.seatType !== 'regular' && (
                                                <span className="bg-amber-100 text-amber-700 text-[9px] px-2 py-0.5 rounded-lg border border-amber-200 font-bold uppercase flex items-center gap-0.5">
                                                    <Star size={8} fill="currentColor"/> {guest.seatType}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-2 ml-11 font-medium"><Phone size={10}/> {guest.phone || 'N/A'}</p>
                                    </div>
                                    <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end ml-11 sm:ml-0">
                                        <div className="text-right">
                                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">সিট</p>
                                            <p className="font-black text-slate-800 text-sm">{guest.seatCount}</p>
                                        </div>
                                        <div className="text-right pl-6 border-l border-slate-100">
                                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">বাকি</p>
                                            <p className="font-black text-emerald-600 text-sm">৳{guest.collection}</p>
                                        </div>
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
