
import React, { useState, useEffect } from 'react';
import { Tour, UserProfile, Guest, PartnerAgency } from '../types';
import { db } from '../services/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { ChevronDown, LogOut, Users, Plus, Phone, Info, Star, Calendar, History, Wallet, CheckCircle } from 'lucide-react';
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

  // --- FILTERING LOGIC ---
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateString();

  // Booking Tab: Show ALL Upcoming Tours (Including today)
  const upcomingTours = tours.filter(t => t.date >= todayStr);

  // History Tab: Show PAST Tours ONLY if this agency participated
  const pastTours = tours.filter(t => {
      const isPast = t.date < todayStr;
      const participated = t.partnerAgencies?.some(a => a.email === user.email);
      return isPast && participated;
  });

  const displayTours = activeTab === 'booking' ? upcomingTours : pastTours;

  // Auto-select first tour when tab or list changes
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
  
  // Calculate Settlement
  const settlement = (activeTour && myAgencyData) ? calculateAgencySettlement(activeTour, myAgencyData) : null;

  const handleAddBooking = async () => {
      if (!activeTour) return;
      
      if (!newBooking.name || !newBooking.seatCount) {
          alert("Please enter Name and Seat Count");
          return;
      }

      // Deep copy agencies array
      let agencies = activeTour.partnerAgencies ? JSON.parse(JSON.stringify(activeTour.partnerAgencies)) : [];
      let agencyIndex = agencies.findIndex((a: PartnerAgency) => a.email === user.email);
      
      // Auto-create Agency Profile if joining a new tour
      if (agencyIndex === -1) {
          const newAgencyProfile: PartnerAgency = {
              id: `agency_${Date.now()}`,
              name: user.email.split('@')[0], // Default name from email
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
          seatType: 'regular' // Agencies add regular seats, Admin can upgrade later
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
        alert("Failed to add booking. Check internet.");
      }
  };

  return (
    <div className="pb-20 lg:pb-10 min-h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div>
           <h1 className="text-lg font-black text-slate-800 tracking-tight">Agency Portal</h1>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user.email}</p>
        </div>
        <button onClick={handleLogout} className="p-2 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors">
            <LogOut size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 pt-2 sticky top-[73px] z-20">
          <div className="flex gap-4 max-w-4xl mx-auto">
              <button 
                onClick={() => setActiveTab('booking')}
                className={`flex-1 pb-3 text-sm font-bold uppercase tracking-wide flex justify-center items-center gap-2 border-b-2 transition-all ${activeTab === 'booking' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                  <Calendar size={16}/> Booking & Active
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`flex-1 pb-3 text-sm font-bold uppercase tracking-wide flex justify-center items-center gap-2 border-b-2 transition-all ${activeTab === 'history' ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                  <History size={16}/> History & Reports
              </button>
          </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6 w-full flex-1">
        
        {/* Tour Selector */}
        {displayTours.length > 0 ? (
            <div className="relative">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    {activeTab === 'booking' ? 'Select Upcoming Tour' : 'Select Past Tour'}
                </label>
                <div className="relative">
                    <select 
                        value={selectedTourId}
                        onChange={(e) => setSelectedTourId(e.target.value)}
                        className={`w-full appearance-none bg-white border-2 text-slate-800 py-4 pl-5 pr-12 rounded-2xl text-lg font-black focus:outline-none focus:ring-4 transition-all shadow-sm ${activeTab === 'booking' ? 'border-blue-100 focus:border-blue-500 focus:ring-blue-500/10' : 'border-violet-100 focus:border-violet-500 focus:ring-violet-500/10'}`}
                    >
                        {displayTours.map(t => <option key={t.id} value={t.id}>{t.name} ({t.date})</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={24} strokeWidth={2.5} />
                </div>
            </div>
        ) : (
            <div className="p-12 text-center text-slate-400 bg-white rounded-[2rem] border border-dashed border-slate-200">
                {activeTab === 'booking' ? 'No upcoming tours available for booking.' : 'No past tour history found.'}
            </div>
        )}

        {/* Content Area */}
        {activeTour && (
            <>
                {/* 1. FINANCIAL SUMMARY (Always visible in History, visible in Booking ONLY if guests exist) */}
                {(activeTab === 'history' || (activeTab === 'booking' && hasGuests)) && settlement && (
                    <div className="animate-fade-in space-y-6">
                        {/* Buy Rates */}
                        <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden">
                            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                                <Info size={16} className="text-slate-400"/>
                                <h3 className="font-bold text-slate-700 text-xs uppercase tracking-widest">Cost Breakdown (Buy Rates)</h3>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50 text-center">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase">Regular</p>
                                        <p className="font-black text-slate-700">৳{settlement.rates.regular}</p>
                                    </div>
                                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50 text-center">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase">Disc 1</p>
                                        <p className="font-black text-slate-700">৳{settlement.rates.d1}</p>
                                    </div>
                                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50 text-center">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase">Disc 2</p>
                                        <p className="font-black text-slate-700">৳{settlement.rates.d2}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Totals */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-slate-100">
                                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Payable Bill</p>
                                 <p className="text-2xl font-black text-slate-800 mt-1">৳{settlement.fixedCostShare.toLocaleString()}</p>
                                 <p className="text-[10px] text-slate-400 mt-1">{settlement.totalSeats} Seats Booked</p>
                             </div>
                             <div className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-slate-100">
                                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Collection by Host</p>
                                 <p className="text-2xl font-black text-emerald-600 mt-1">৳{settlement.totalCollection.toLocaleString()}</p>
                             </div>
                             <div className={`p-5 rounded-[1.5rem] shadow-sm border flex flex-col justify-center ${settlement.netAmount >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                                 <div className="flex items-center gap-2 mb-1">
                                     <Wallet size={16} className={settlement.netAmount >= 0 ? 'text-emerald-500' : 'text-rose-500'}/>
                                     <p className={`text-[10px] font-bold uppercase tracking-widest ${settlement.netAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        Net Settlement
                                     </p>
                                 </div>
                                 <p className={`text-2xl font-black ${settlement.netAmount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                     {settlement.netAmount >= 0 ? '+' : ''}{settlement.netAmount.toLocaleString()} ৳
                                 </p>
                                 <p className={`text-[10px] font-bold mt-1 ${settlement.netAmount >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                     {settlement.netAmount >= 0 ? 'You will receive' : 'You have to pay'}
                                 </p>
                             </div>
                        </div>
                    </div>
                )}

                {/* 2. GUEST MANAGEMENT (Visible in both, but "Add" only in Booking) */}
                <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
                    <div className="px-6 py-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-bold text-slate-700 text-xs uppercase tracking-widest flex items-center gap-2">
                            <Users size={16} className="text-slate-400"/> Guest List
                        </h3>
                        
                        {/* ADD BUTTON: Only in Booking Tab */}
                        {activeTab === 'booking' && (
                            <button 
                                onClick={() => setIsAddingBooking(!isAddingBooking)} 
                                className="text-[10px] font-bold bg-slate-900 text-white px-4 py-2 rounded-xl uppercase tracking-wide flex items-center gap-2 shadow-lg hover:bg-slate-800 transition-all active:scale-95"
                            >
                                <Plus size={14}/> Add New Guest
                            </button>
                        )}
                    </div>

                    {/* ADD FORM */}
                    {isAddingBooking && activeTab === 'booking' && (
                        <div className="p-6 bg-blue-50/50 border-b border-blue-100 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Guest Name</label>
                                    <input className="w-full border border-slate-200 bg-white p-3 rounded-xl text-sm outline-none font-semibold focus:ring-2 focus:ring-blue-500" placeholder="Enter Name" value={newBooking.name} onChange={e => setNewBooking({...newBooking, name: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Phone Number</label>
                                    <input className="w-full border border-slate-200 bg-white p-3 rounded-xl text-sm outline-none font-semibold focus:ring-2 focus:ring-blue-500" placeholder="017..." value={newBooking.phone} onChange={e => setNewBooking({...newBooking, phone: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Number of Seats</label>
                                    <input type="number" className="w-full border border-slate-200 bg-white p-3 rounded-xl text-sm outline-none font-semibold focus:ring-2 focus:ring-blue-500" placeholder="1" value={newBooking.seatCount} onChange={e => setNewBooking({...newBooking, seatCount: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Collection Amount (Due)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">৳</span>
                                        <input type="number" className="w-full border border-emerald-200 bg-emerald-50 pl-8 pr-3 py-3 rounded-xl text-sm outline-none font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500" placeholder="0" value={newBooking.unitPrice} onChange={e => setNewBooking({...newBooking, unitPrice: e.target.value})} />
                                    </div>
                                    <p className="text-[9px] text-slate-400 ml-1 mt-1">Amount the Host will collect from this guest on the bus.</p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setIsAddingBooking(false)} className="px-5 py-2.5 rounded-xl text-slate-500 font-bold text-xs hover:bg-slate-100 transition-colors">Cancel</button>
                                <button onClick={handleAddBooking} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-blue-700 transition-all uppercase tracking-wide">Confirm Booking</button>
                            </div>
                        </div>
                    )}

                    {/* LIST */}
                    {!hasGuests ? (
                        <div className="p-10 text-center flex flex-col items-center justify-center text-slate-400">
                            <div className="bg-slate-50 p-4 rounded-full mb-3">
                                <Users size={24} className="opacity-50"/>
                            </div>
                            <p className="font-bold text-sm">No guests found.</p>
                            {activeTab === 'booking' && <p className="text-xs mt-1">Click "Add New Guest" to make a booking.</p>}
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {myAgencyData.guests.map(guest => (
                                <div key={guest.id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-50 transition-colors">
                                    <div>
                                        <p className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                                            {guest.name}
                                            {guest.seatType && guest.seatType !== 'regular' && (
                                                <span className="bg-amber-100 text-amber-700 text-[9px] px-1.5 py-0.5 rounded border border-amber-200 font-bold uppercase flex items-center gap-0.5">
                                                    <Star size={8} fill="currentColor"/> {guest.seatType}
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-1 font-medium"><Phone size={10}/> {guest.phone || 'N/A'}</p>
                                    </div>
                                    <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                                        <div className="text-right">
                                            <p className="text-[9px] text-slate-400 font-bold uppercase">Seats</p>
                                            <p className="font-bold text-slate-800 text-sm">{guest.seatCount}</p>
                                        </div>
                                        <div className="text-right pl-6 border-l border-slate-100">
                                            <p className="text-[9px] text-slate-400 font-bold uppercase">Due</p>
                                            <p className="font-bold text-emerald-600 text-sm">৳{guest.collection}</p>
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
