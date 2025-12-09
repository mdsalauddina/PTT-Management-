
import React, { useState, useEffect, useMemo } from 'react';
import { Tour, UserProfile, Guest, PartnerAgency, SettlementStatus } from '../types';
import { db } from '../services/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { ChevronDown, LogOut, Users, Plus, Phone, Info, Star, Calendar, History, Wallet, LayoutGrid, Sparkles, Briefcase, Armchair, Tag, Clock, MapPin, X, CheckCircle, Calculator, MessageCircle, XCircle, Activity, Heart } from 'lucide-react';
import { calculateAgencySettlement, calculateBusFare, calculateTotalOtherFixedCosts, safeNum, recalculateTourSeats, calculateBuyRates } from '../utils/calculations';

interface AgencyDashboardProps {
  user: UserProfile;
  tours: Tour[];
  refreshTours: () => Promise<void>;
  handleLogout: () => void;
}

const AgencyDashboard: React.FC<AgencyDashboardProps> = ({ user, tours, refreshTours, handleLogout }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'history'>('all');
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  // Booking Modal State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [targetTour, setTargetTour] = useState<Tour | null>(null);
  // Updated state to include address and isCouple
  const [newBooking, setNewBooking] = useState({ 
      name: '', 
      phone: '', 
      address: '', 
      isCouple: false, 
      seatCount: '', 
      unitPrice: '', 
      seatNumbers: '' 
  });

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

  // Auto-select first tour when switching to details view
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
      
      // Use Received Guests as Divisor (consistent with Analysis Tab)
      const divisor = (tour.totalGuests && tour.totalGuests > 0) ? tour.totalGuests : (safeNum(tour.busConfig?.totalSeats) || 1);
      
      const totalHostFee = safeNum(tour.costs?.hostFee);
      const totalHotel = safeNum(tour.costs?.hotelCost);
      const dailyExpenses = tour.costs?.dailyExpenses || [];
      
      const totalFood = dailyExpenses.reduce((sum, day) => sum + safeNum(day.breakfast) + safeNum(day.lunch) + safeNum(day.dinner), 0);
      const totalTransport = dailyExpenses.reduce((sum, day) => sum + safeNum(day.transport), 0);
      const totalDailyOther = dailyExpenses.reduce((sum, day) => sum + safeNum(day.other), 0);
      const totalFixedOther = calculateTotalOtherFixedCosts(tour);
      
      const totalOthers = totalDailyOther + totalFixedOther;

      // Bus Share (consistent with buy rate calculation)
      const rates = calculateBuyRates(tour);
      const busShare = rates.regularBus || 0;
      const totalBusRent = safeNum(tour.busConfig?.totalRent);

      // Per Head Calc
      const perHeadHost = Math.ceil(totalHostFee / divisor);
      const perHeadHotel = Math.ceil(totalHotel / divisor);
      const perHeadFood = Math.ceil(totalFood / divisor);
      const perHeadTransport = Math.ceil(totalTransport / divisor);
      const perHeadOthers = Math.ceil(totalOthers / divisor);
      
      const totalVariablePerHead = perHeadHost + perHeadHotel + perHeadFood + perHeadTransport + perHeadOthers;

      return { 
          divisor,
          totals: { 
              host: totalHostFee, 
              hotel: totalHotel, 
              food: totalFood, 
              transport: totalTransport,
              others: totalOthers,
              bus: totalBusRent
          },
          perHead: { 
              host: perHeadHost, 
              hotel: perHeadHotel, 
              food: perHeadFood, 
              transport: perHeadTransport,
              others: perHeadOthers,
              bus: busShare
          },
          totalVariablePerHead
      };
  };
  
  const breakdown = activeDetailTour ? calculateBreakdown(activeDetailTour) : null;

  // --- ACTIONS ---

  const openBookingModal = (tour: Tour) => {
      setTargetTour(tour);
      setNewBooking({ name: '', phone: '', address: '', isCouple: false, seatCount: '', unitPrice: '', seatNumbers: '' });
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

      // Auto-format phone number
      let formattedPhone = (newBooking.phone || '').trim();
      if (formattedPhone.startsWith('01')) {
          formattedPhone = '+88' + formattedPhone;
      }

      const newGuest: Guest = {
          id: `g_${Date.now()}`,
          name: newBooking.name,
          phone: formattedPhone,
          address: newBooking.address,
          isCouple: newBooking.isCouple,
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
        await recalculateTourSeats(targetTour.id); // Dynamic seat update
        await refreshTours();
        closeBookingModal();
        // If user was in 'all', maybe switch to 'my'? optional.
        // setActiveTab('my'); 
      } catch (error) {
        console.error("Error adding booking:", error);
        alert("বুকিং যোগ করা যায়নি।");
      }
  };

  const updateSettlementStatus = async (status: SettlementStatus) => {
    if (!activeDetailTour || !myAgencyData) return;
    if (status === 'paid' && !window.confirm("Payment Complete?")) return;
    if (status === 'settled' && !window.confirm("Accept payment?")) return;

    setIsUpdatingStatus(true);
    try {
        const agencies = activeDetailTour.partnerAgencies ? JSON.parse(JSON.stringify(activeDetailTour.partnerAgencies)) : [];
        const idx = agencies.findIndex((a: PartnerAgency) => a.email === user.email);
        
        if (idx !== -1) {
            agencies[idx].settlementStatus = status;
            const tourRef = doc(db, 'tours', activeDetailTour.id);
            await updateDoc(tourRef, { partnerAgencies: agencies, updatedAt: Timestamp.now() });
            await refreshTours();
        }
    } catch (error) {
        console.error("Error updating status:", error);
        alert("আপডেট ব্যর্থ হয়েছে।");
    } finally {
        setIsUpdatingStatus(false);
    }
  };

  const getWhatsAppLink = (phone: string) => {
      let p = phone.replace(/[^0-9]/g, '');
      if (p.startsWith('01')) p = '88' + p;
      return `https://wa.me/${p}`;
  };

  const settlementStatus = myAgencyData?.settlementStatus || 'unpaid';
  const isAgencyPayer = (settlement?.netAmount || 0) >= 0;

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
                                    <p className="text-[9px] font-bold text-slate-400">বাস ভাড়া: ৳{breakdown.perHead.bus}</p>
                                    <div className="mt-2 text-[9px] bg-white/60 rounded-lg py-1 font-bold text-violet-600 border border-violet-100">
                                        বুকিং: {agencySeatStats.regular} টি
                                    </div>
                                </div>

                                {/* Disc 1 */}
                                <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 text-center relative overflow-hidden group">
                                    <p className="text-[8px] font-bold text-amber-500 uppercase mb-1 tracking-wider">ডিসকাউন্ট ১</p>
                                    <p className="text-lg font-black text-amber-600">৳{settlement.rates.d1}</p>
                                    <p className="text-[9px] font-bold text-slate-400">বাস ভাড়া: ৳{breakdown.perHead.bus - safeNum(activeDetailTour.busConfig?.discount1Amount)}</p>
                                    <div className="mt-2 text-[9px] bg-white/60 rounded-lg py-1 font-bold text-amber-600 border border-amber-100">
                                        বুকিং: {agencySeatStats.d1} টি
                                    </div>
                                </div>

                                {/* Disc 2 */}
                                <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 text-center relative overflow-hidden group">
                                    <p className="text-[8px] font-bold text-orange-500 uppercase mb-1 tracking-wider">ডিসকাউন্ট ২</p>
                                    <p className="text-lg font-black text-orange-600">৳{settlement.rates.d2}</p>
                                    <p className="text-[9px] font-bold text-slate-400">বাস ভাড়া: ৳{breakdown.perHead.bus - safeNum(activeDetailTour.busConfig?.discount2Amount)}</p>
                                    <div className="mt-2 text-[9px] bg-white/60 rounded-lg py-1 font-bold text-orange-600 border border-orange-100">
                                        বুকিং: {agencySeatStats.d2} টি
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Cost Components Breakdown Table (Like Analysis Tab) */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Activity size={14} className="text-slate-400"/>
                                    <h3 className="font-bold text-slate-700 text-[10px] uppercase tracking-widest">খরচের ব্রেকডাউন</h3>
                                </div>
                                <div className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                    Received Guests: {breakdown.divisor}
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100">
                                            <th className="p-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider">খাত</th>
                                            <th className="p-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right">মোট</th>
                                            <th className="p-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right bg-slate-50/30">জনপ্রতি</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-xs font-bold text-slate-600">
                                        {/* Bus Rent */}
                                        <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                                            <td className="p-3 flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-violet-600"></div>
                                                বাস ভাড়া (Base)
                                            </td>
                                            <td className="p-3 text-right font-mono text-slate-700">৳{breakdown.totals.bus.toLocaleString()}</td>
                                            <td className="p-3 text-right font-mono text-slate-500 bg-slate-50/30">৳{breakdown.perHead.bus}</td>
                                        </tr>
                                        {/* Other Items */}
                                         {[
                                            { label: 'হোটেল ভাড়া', total: breakdown.totals.hotel, perHead: breakdown.perHead.hotel, color: 'bg-indigo-600' },
                                            { label: 'খাবার', total: breakdown.totals.food, perHead: breakdown.perHead.food, color: 'bg-orange-600' },
                                            { label: 'লোকাল গাড়ি', total: breakdown.totals.transport, perHead: breakdown.perHead.transport, color: 'bg-blue-600' },
                                            { label: 'হোস্ট খরচ', total: breakdown.totals.host, perHead: breakdown.perHead.host, color: 'bg-teal-600' },
                                            { label: 'অন্যান্য', total: breakdown.totals.others, perHead: breakdown.perHead.others, color: 'bg-slate-600' },
                                        ].map((item, i) => (
                                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                                                <td className="p-3 flex items-center gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${item.color}`}></div>
                                                    {item.label}
                                                </td>
                                                <td className="p-3 text-right font-mono text-slate-700">৳{item.total.toLocaleString()}</td>
                                                <td className="p-3 text-right font-mono text-slate-500 bg-slate-50/30">৳{item.perHead}</td>
                                            </tr>
                                        ))}
                                         <tr className="bg-slate-50/80">
                                            <td className="p-3 text-[10px] font-black text-rose-600 uppercase">মোট ভেরিয়েবল (বাস বাদে)</td>
                                            <td className="p-3 text-right font-black text-rose-600 text-sm">-</td>
                                            <td className="p-3 text-right font-black text-rose-600 text-sm">৳{breakdown.totalVariablePerHead}</td>
                                        </tr>
                                    </tbody>
                                </table>
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

                        {/* SETTLEMENT STATUS BAR */}
                        {settlementStatus === 'settled' ? (
                            <div className="bg-emerald-100 border border-emerald-200 p-4 rounded-xl flex items-center justify-center gap-2">
                                <CheckCircle size={20} className="text-emerald-600" />
                                <span className="font-black text-emerald-800 text-xs uppercase tracking-wide">হিসাব ক্লোজড (Settled)</span>
                            </div>
                        ) : (
                             // Logic:
                             // Agency Pays (Net >= 0): Show "Mark Paid"
                             // Agency Receives (Net < 0): Show "Accept / Decline" (if Paid)
                            <div className="space-y-2">
                                {isAgencyPayer && (
                                    settlementStatus === 'paid' ? (
                                        <div className="bg-amber-100 border border-amber-200 p-4 rounded-xl flex items-center justify-center gap-2">
                                            <Clock size={20} className="text-amber-600" />
                                            <span className="font-black text-amber-800 text-xs uppercase tracking-wide">অ্যাডমিন কনফার্মেশনের অপেক্ষায় (Pending)</span>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => updateSettlementStatus('paid')}
                                            disabled={isUpdatingStatus}
                                            className="w-full py-4 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                                        >
                                            {isUpdatingStatus ? 'আপডেট হচ্ছে...' : <><CheckCircle size={16}/> পেমেন্ট কমপ্লিট করুন</>}
                                        </button>
                                    )
                                )}

                                {!isAgencyPayer && (
                                    settlementStatus === 'paid' ? (
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => updateSettlementStatus('unpaid')}
                                                disabled={isUpdatingStatus}
                                                className="flex-1 py-3 bg-white text-rose-600 border border-rose-100 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-rose-50 flex items-center justify-center gap-2"
                                            >
                                                <XCircle size={16}/> Decline
                                            </button>
                                            <button 
                                                onClick={() => updateSettlementStatus('settled')}
                                                disabled={isUpdatingStatus}
                                                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg hover:bg-emerald-700 flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle size={16}/> Accept
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="bg-slate-100 border border-slate-200 p-4 rounded-xl flex items-center justify-center gap-2">
                                            <Clock size={16} className="text-slate-500" />
                                            <span className="font-bold text-slate-600 text-xs uppercase">অ্যাডমিন পেমেন্টের অপেক্ষায়...</span>
                                        </div>
                                    )
                                )}
                            </div>
                        )}

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
                                                    {guest.isCouple && (
                                                        <span className="text-[8px] font-bold text-white bg-pink-500 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 mt-0.5 w-fit"><Heart size={8} fill="currentColor"/> Couple</span>
                                                    )}
                                                    <div className="flex flex-col gap-1 mt-1">
                                                        {guest.phone && (
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="text-[10px] font-bold text-slate-500">{guest.phone}</span>
                                                                <div className="flex gap-1">
                                                                    <a href={`tel:${guest.phone}`} className="text-[9px] text-white font-bold bg-emerald-500 px-2 py-1 rounded shadow-sm hover:bg-emerald-600 transition-all flex items-center gap-1" title="Call">
                                                                        <Phone size={10}/> Call
                                                                    </a>
                                                                    <a href={getWhatsAppLink(guest.phone)} target="_blank" rel="noopener noreferrer" className="text-[9px] text-white font-bold bg-green-500 px-2 py-1 rounded shadow-sm hover:bg-green-600 transition-all flex items-center gap-1" title="WhatsApp">
                                                                        <MessageCircle size={10}/> WA
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {guest.address && (
                                                            <div className="flex items-center gap-1 text-[9px] text-slate-500 font-bold">
                                                                <MapPin size={10} className="text-slate-400"/> {guest.address}
                                                            </div>
                                                        )}
                                                        <div className="flex gap-1.5">
                                                            {guest.seatNumbers && (
                                                                <span className="text-[9px] text-violet-600 font-bold bg-violet-50 px-1.5 py-0.5 rounded border border-violet-100 flex items-center gap-0.5">
                                                                    <Armchair size={8}/> {guest.seatNumbers}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
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
                            placeholder="01..."
                          />
                      </div>
                       {/* NEW: Address Field */}
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">ঠিকানা</label>
                          <input 
                            value={newBooking.address}
                            onChange={e => setNewBooking({...newBooking, address: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300"
                            placeholder="ঠিকানা"
                          />
                      </div>
                       {/* NEW: Couple Checkbox */}
                       <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                             <input type="checkbox" checked={newBooking.isCouple} onChange={e => setNewBooking({...newBooking, isCouple: e.target.checked})} className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                             <label className="text-[10px] font-bold text-pink-500 uppercase flex items-center gap-1"><Heart size={10}/> কাপল প্যাকেজ?</label>
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
