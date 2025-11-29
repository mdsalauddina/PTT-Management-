
import React, { useState, useEffect, useMemo } from 'react';
import { Tour, UserProfile, Guest, PartnerAgency } from '../types';
import { db } from '../services/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { ChevronDown, LogOut, Users, Plus, Phone, Info, Star, Calendar, History, Wallet, LayoutGrid, Sparkles, Briefcase, Armchair, Tag, Clock, MapPin, X, CheckCircle } from 'lucide-react';
import { calculateAgencySettlement } from '../utils/calculations';

interface AgencyDashboardProps {
  user: UserProfile;
  tours: Tour[];
  refreshTours: () => Promise<void>;
  handleLogout: () => void;
}

const AgencyDashboard: React.FC<AgencyDashboardProps> = ({ user, tours, refreshTours, handleLogout }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'history'>('all');
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  
  // Booking Modal State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [targetTour, setTargetTour] = useState<Tour | null>(null);
  const [newBooking, setNewBooking] = useState({ name: '', phone: '', seatCount: '', unitPrice: '', seatNumbers: '' });

  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateString();
  
  // Filter Logic
  const allUpcoming = tours.filter(t => t.date >= todayStr);
  
  const myBookings = tours.filter(t => {
      const isPartner = t.partnerAgencies?.some(a => a.email === user.email);
      return t.date >= todayStr && isPartner;
  });
  
  const historyTours = tours.filter(t => {
      const isPartner = t.partnerAgencies?.some(a => a.email === user.email);
      return t.date < todayStr && isPartner;
  });

  // Determine which list to use for the dropdown in details view
  const detailViewTours = activeTab === 'my' ? myBookings : historyTours;

  // Auto-select first tour when switching to detail views
  useEffect(() => {
    if (activeTab !== 'all' && detailViewTours.length > 0) {
        setSelectedTourId(detailViewTours[0].id);
    } else {
        setSelectedTourId('');
    }
  }, [activeTab, tours.length]); 

  // Selected tour for detail view
  const activeDetailTour = detailViewTours.find(t => t.id === selectedTourId) || null;
  const myAgencyData = activeDetailTour?.partnerAgencies?.find(a => a.email === user.email);

  const safeNum = (val: any) => Number(val) || 0;
  const hasGuests = myAgencyData && myAgencyData.guests && myAgencyData.guests.length > 0;
  
  const settlement = (activeDetailTour && myAgencyData) ? calculateAgencySettlement(activeDetailTour, myAgencyData) : null;

  // Calculate Agency Specific Seat Stats (Memoized)
  const agencySeatStats = useMemo(() => {
    let stats = { regular: 0, d1: 0, d2: 0, total: 0 };
    if (myAgencyData && myAgencyData.guests) {
        myAgencyData.guests.forEach(g => {
             if (g.paxBreakdown) {
                  stats.regular += safeNum(g.paxBreakdown.regular);
                  stats.d1 += safeNum(g.paxBreakdown.disc1);
                  stats.d2 += safeNum(g.paxBreakdown.disc2);
             } else {
                  const cnt = safeNum(g.seatCount);
                  const type = g.seatType || 'regular';
                  if(type === 'disc1') stats.d1 += cnt;
                  else if(type === 'disc2') stats.d2 += cnt;
                  else stats.regular += cnt;
             }
        });
        stats.total = stats.regular + stats.d1 + stats.d2;
    }
    return stats;
  }, [myAgencyData]);

  // Breakdown Calculation for Display
  const calculateBreakdown = (tour: Tour) => {
      if (!tour) return null;
      const totalSeats = safeNum(tour.busConfig?.totalSeats) || 1;
      const hostFee = safeNum(tour.costs?.hostFee);
      const hotelCost = safeNum(tour.costs?.hotelCost);
      const dailyExpensesTotal = tour.costs?.dailyExpenses ? tour.costs.dailyExpenses.reduce((sum, day) => 
          sum + safeNum(day.breakfast) + safeNum(day.lunch) + safeNum(day.dinner) + safeNum(day.transport) + safeNum(day.other), 0
      ) : 0;

      // Per Head Fixed & Variable
      const perHeadBus = Math.ceil(safeNum(tour.busConfig?.totalRent) / totalSeats);
      const perHeadHotel = Math.ceil(hotelCost / totalSeats);
      const perHeadMgmt = Math.ceil(hostFee / totalSeats);
      const perHeadDaily = Math.ceil(dailyExpensesTotal / totalSeats);
      
      const totalPerHead = perHeadBus + perHeadHotel + perHeadMgmt + perHeadDaily;

      return { perHeadBus, perHeadHotel, perHeadMgmt, perHeadDaily, totalPerHead };
  };
  
  const breakdown = activeDetailTour ? calculateBreakdown(activeDetailTour) : null;

  // --- ACTIONS ---

  const openBookingModal = (tour: Tour) => {
      setTargetTour(tour);
      setNewBooking({ name: '', phone: '', seatCount: '', unitPrice: '', seatNumbers: '' });
      setIsBookingModalOpen(true);
  };

  const closeBookingModal = () => {
      setIsBookingModalOpen(false);
      setTargetTour(null);
  };

  const handleConfirmBooking = async () => {
      if (!targetTour) return;
      if (!newBooking.name || !newBooking.seatCount) {
          alert("নাম এবং সিট সংখ্যা দিন।");
          return;
      }

      let agencies = targetTour.partnerAgencies ? JSON.parse(JSON.stringify(targetTour.partnerAgencies)) : [];
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
          seatNumbers: newBooking.seatNumbers, // Added seat numbers here
          seatType: 'regular' 
      };

      if (!agencies[agencyIndex].guests) agencies[agencyIndex].guests = [];
      agencies[agencyIndex].guests.push(newGuest);

      try {
        const tourRef = doc(db, 'tours', targetTour.id);
        await updateDoc(tourRef, { partnerAgencies: agencies, updatedAt: Timestamp.now() });
        await refreshTours();
        closeBookingModal();
        // If user was in 'all', maybe switch to 'my'? optional.
        // setActiveTab('my'); 
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

      {/* 3 Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 pt-2 sticky top-[58px] z-20">
          <div className="flex gap-2 max-w-4xl mx-auto">
              <button onClick={() => setActiveTab('all')}
                className={`flex-1 pb-3 text-[10px] font-black uppercase tracking-widest flex justify-center items-center gap-1.5 border-b-2 transition-all ${activeTab === 'all' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                  <Briefcase size={12}/> সব ট্যুর
              </button>
              <button onClick={() => setActiveTab('my')}
                className={`flex-1 pb-3 text-[10px] font-black uppercase tracking-widest flex justify-center items-center gap-1.5 border-b-2 transition-all ${activeTab === 'my' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                  <Sparkles size={12}/> আমার বুকিং
              </button>
              <button onClick={() => setActiveTab('history')}
                className={`flex-1 pb-3 text-[10px] font-black uppercase tracking-widest flex justify-center items-center gap-1.5 border-b-2 transition-all ${activeTab === 'history' ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                  <History size={12}/> হিস্ট্রি
              </button>
          </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4 w-full flex-1">
        
        {/* --- VIEW 1: ALL TOURS (List View, No Details) --- */}
        {activeTab === 'all' && (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {allUpcoming.length === 0 ? (
                    <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-[2.5rem] border border-slate-100 text-xs font-bold">
                        কোনো আসন্ন ট্যুর নেই।
                    </div>
                ) : (
                    allUpcoming.map(tour => (
                        <div key={tour.id} className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 hover:shadow-lg transition-all flex flex-col justify-between group">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-bold border border-indigo-100">
                                        {tour.date}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                        <Clock size={12}/> {tour.duration} দিন
                                    </span>
                                </div>
                                <h3 className="font-black text-xl text-slate-800 mb-2 leading-tight group-hover:text-indigo-600 transition-colors">
                                    {tour.name}
                                </h3>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold mb-6">
                                    <MapPin size={12}/> বাস: {tour.busConfig?.totalSeats || 40} সিট
                                </div>
                            </div>
                            <button 
                                onClick={() => openBookingModal(tour)}
                                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-slate-200 hover:bg-indigo-600 hover:shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Plus size={16}/> বুকিং দিন
                            </button>
                        </div>
                    ))
                )}
            </div>
        )}


        {/* --- VIEW 2 & 3: MY BOOKINGS & HISTORY (Detail View) --- */}
        {(activeTab === 'my' || activeTab === 'history') && (
            <>
                {/* Tour Selector Dropdown */}
                {detailViewTours.length > 0 ? (
                    <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 relative z-10 mb-6">
                        <div className={`p-2 rounded-xl ${activeTab === 'my' ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600'}`}>
                            {activeTab === 'my' ? <Sparkles size={16} /> : <History size={16} />}
                        </div>
                        <div className="flex-1">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ট্যুর নির্বাচন</p>
                            <div className="relative -mt-1">
                                <select 
                                    value={selectedTourId}
                                    onChange={(e) => setSelectedTourId(e.target.value)}
                                    className="w-full appearance-none bg-transparent text-slate-800 text-sm font-black focus:outline-none cursor-pointer pr-6 py-1"
                                >
                                    {detailViewTours.map(t => <option key={t.id} value={t.id}>{t.name} ({t.date})</option>)}
                                </select>
                                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} strokeWidth={2.5} />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-10 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 text-xs font-bold">
                        {activeTab === 'my' ? 'আপনার কোনো বুকিং নেই।' : 'কোনো হিস্ট্রি পাওয়া যায়নি।'}
                    </div>
                )}

                {/* Details Content */}
                {activeDetailTour && settlement && breakdown && (
                    <div className="animate-fade-in space-y-4">
                        
                        {/* DETAILED SEAT & RATE BREAKDOWN */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-5">
                            <div className="flex items-center gap-2 mb-4 border-b border-slate-50 pb-3">
                                <Armchair size={16} className="text-violet-500"/>
                                <h3 className="font-bold text-slate-700 text-xs uppercase tracking-widest">বুকিং এবং রেট বিস্তারিত</h3>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-3">
                                {/* Regular */}
                                <div className="bg-violet-50 p-3 rounded-xl border border-violet-100 text-center relative overflow-hidden group">
                                    <p className="text-[8px] font-bold text-violet-400 uppercase mb-1 tracking-wider">রেগুলার সিট</p>
                                    <p className="text-lg font-black text-violet-700">৳{settlement.rates.regular}</p>
                                    <div className="mt-2 text-[9px] bg-white/60 rounded-lg py-1 font-bold text-violet-600 border border-violet-100">
                                        বুকিং: {agencySeatStats.regular} টি
                                    </div>
                                </div>

                                {/* Disc 1 */}
                                <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 text-center relative overflow-hidden group">
                                    <p className="text-[8px] font-bold text-amber-500 uppercase mb-1 tracking-wider">ডিসকাউন্ট ১</p>
                                    <p className="text-lg font-black text-amber-600">৳{settlement.rates.d1}</p>
                                    <div className="mt-2 text-[9px] bg-white/60 rounded-lg py-1 font-bold text-amber-600 border border-amber-100">
                                        বুকিং: {agencySeatStats.d1} টি
                                    </div>
                                </div>

                                {/* Disc 2 */}
                                <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 text-center relative overflow-hidden group">
                                    <p className="text-[8px] font-bold text-orange-500 uppercase mb-1 tracking-wider">ডিসকাউন্ট ২</p>
                                    <p className="text-lg font-black text-orange-600">৳{settlement.rates.d2}</p>
                                    <div className="mt-2 text-[9px] bg-white/60 rounded-lg py-1 font-bold text-orange-600 border border-orange-100">
                                        বুকিং: {agencySeatStats.d2} টি
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Cost Components Breakdown */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
                                <Tag size={14} className="text-slate-400"/>
                                <h3 className="font-bold text-slate-700 text-[10px] uppercase tracking-widest">খরচের খাত (জনপ্রতি)</h3>
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

                        {/* GUEST LIST */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-4">
                            <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10">
                                <h3 className="font-bold text-slate-700 text-[10px] uppercase tracking-widest flex items-center gap-2">
                                    <Users size={14} className="text-slate-400"/> গেস্ট লিস্ট ({settlement.totalSeats})
                                </h3>
                                {/* Add Guest button for My Bookings */}
                                {activeTab === 'my' && (
                                    <button 
                                        onClick={() => openBookingModal(activeDetailTour)} 
                                        className="text-[9px] font-bold bg-slate-900 text-white px-3 py-1.5 rounded-lg uppercase tracking-wide flex items-center gap-1.5 shadow-md hover:bg-slate-800 transition-all"
                                    >
                                        <Plus size={12}/> আরো যোগ করুন
                                    </button>
                                )}
                            </div>

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
                                                    <p className="text-[9px] text-slate-400 font-bold flex items-center gap-1">
                                                        <Phone size={8}/> {guest.phone || '-'}
                                                        {guest.seatNumbers && (
                                                            <span className="text-violet-600 bg-violet-50 px-1 rounded ml-1 border border-violet-100">
                                                                {guest.seatNumbers}
                                                            </span>
                                                        )}
                                                    </p>
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
                    </div>
                )}
            </>
        )}

      </div>

      {/* --- BOOKING MODAL --- */}
      {isBookingModalOpen && targetTour && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden relative">
                  <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div>
                          <h3 className="font-black text-slate-800 text-sm">{targetTour.name}</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">নতুন বুকিং</p>
                      </div>
                      <button onClick={closeBookingModal} className="p-2 bg-white rounded-full text-slate-400 hover:text-rose-500 transition-colors shadow-sm">
                          <X size={16} />
                      </button>
                  </div>
                  
                  <div className="p-6 space-y-4">
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">গেস্ট নাম</label>
                          <input 
                            value={newBooking.name}
                            onChange={e => setNewBooking({...newBooking, name: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300"
                            placeholder="পুরো নাম"
                          />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">মোবাইল নম্বর</label>
                          <input 
                            value={newBooking.phone}
                            onChange={e => setNewBooking({...newBooking, phone: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300"
                            placeholder="017..."
                          />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">সিট নম্বর</label>
                          <input 
                            value={newBooking.seatNumbers}
                            onChange={e => setNewBooking({...newBooking, seatNumbers: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300"
                            placeholder="A1, B2..."
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">মোট সিট</label>
                              <input 
                                type="number"
                                value={newBooking.seatCount}
                                onChange={e => setNewBooking({...newBooking, seatCount: e.target.value})}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300"
                                placeholder="0"
                              />
                          </div>
                          <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">মোট কালেকশন</label>
                              <input 
                                type="number"
                                value={newBooking.unitPrice}
                                onChange={e => setNewBooking({...newBooking, unitPrice: e.target.value})}
                                className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm font-bold text-center text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-emerald-300"
                                placeholder="0"
                              />
                          </div>
                      </div>
                  </div>

                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                      <button onClick={closeBookingModal} className="flex-1 py-3 text-slate-500 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors">
                          বাতিল
                      </button>
                      <button onClick={handleConfirmBooking} className="flex-[2] py-3 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-[1.02] transition-all flex justify-center items-center gap-2">
                          <CheckCircle size={16}/> কনফার্ম করুন
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AgencyDashboard;
