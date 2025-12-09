
import React, { useState, useEffect } from 'react';
import { CommonTabProps, PartnerAgency, Guest, SettlementStatus } from '../types';
import { db } from '../services/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { calculateAgencySettlement, safeNum, recalculateTourSeats } from '../utils/calculations';
import { Users, Phone, Plus, Trash, ChevronDown, UserPlus, Briefcase, Mail, Star, Edit3, X, Check, FolderOpen, Armchair, MessageCircle, Clock, CheckCircle, XCircle, MapPin, Heart } from 'lucide-react';

const ShareTourTab: React.FC<CommonTabProps> = ({ user, tours, refreshTours }) => {
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  const [showAddAgency, setShowAddAgency] = useState(false);
  const [newAgency, setNewAgency] = useState({ name: '', phone: '', email: '' });
  const [expandedAgency, setExpandedAgency] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

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
  const [isAddingBooking, setIsAddingBooking] = useState<string | null>(null);
  
  const [editingGuest, setEditingGuest] = useState<{ agencyId: string, guestId: string } | null>(null);
  const [seatBreakdown, setSeatBreakdown] = useState({ regular: 0, disc1: 0, disc2: 0 });

  useEffect(() => {
    if (tours.length > 0 && !selectedTourId) {
        setSelectedTourId(tours[0].id);
    }
  }, [tours, selectedTourId]);

  const activeTour = tours.find(t => t.id === selectedTourId) || null;

  if (user.role !== 'admin' && user.role !== 'host') return <div className="h-full flex items-center justify-center text-rose-400 font-bold p-10 bg-rose-50 m-4 rounded-3xl border border-rose-100">Restricted Access: Admin/Host Only</div>;
  
  const isAdmin = user.role === 'admin';

  if (!activeTour) return (
    <div className="h-full flex flex-col items-center justify-center p-20 text-center text-slate-400">
        <div className="bg-slate-100 p-8 rounded-full mb-6 animate-pulse"><Users size={32} /></div>
        <p className="font-bold text-sm">কোন ট্যুর ডাটা পাওয়া যায়নি</p>
    </div>
  );

  const updateTourAgencies = async (agencies: PartnerAgency[]) => {
      if (!activeTour || !activeTour.id) return;
      try {
          const tourRef = doc(db, 'tours', activeTour.id);
          const cleanAgencies = JSON.parse(JSON.stringify(agencies));
          await updateDoc(tourRef, { partnerAgencies: cleanAgencies, updatedAt: Timestamp.now() });
          await recalculateTourSeats(activeTour.id); // Dynamic seat update
          await refreshTours();
      } catch (e) {
          console.error("Error updating tour agencies", e);
      }
  };

  const handleAddAgency = async () => {
    if (!newAgency.name) return;
    const agency: PartnerAgency = {
        id: `agency_${Date.now()}`,
        name: newAgency.name,
        email: newAgency.email.toLowerCase().trim(),
        phone: newAgency.phone,
        guests: [],
        expenses: []
    };
    
    const currentAgencies = activeTour.partnerAgencies ? [...activeTour.partnerAgencies] : [];
    const updatedAgencies = [...currentAgencies, agency];
    
    await updateTourAgencies(updatedAgencies);
    setNewAgency({ name: '', phone: '', email: '' });
    setShowAddAgency(false);
  };

  const addBookingToAgency = async (agencyId: string) => {
      if (!newBooking.name || !newBooking.seatCount) {
          alert("Please provide Name and Seat Count");
          return;
      }

      const agencies = activeTour.partnerAgencies ? [...activeTour.partnerAgencies] : [];
      const agencyIndex = agencies.findIndex((a: PartnerAgency) => a.id === agencyId);
      if (agencyIndex === -1) return;

      const seatCount = parseInt(newBooking.seatCount) || 0;
      const totalAmount = parseInt(newBooking.unitPrice) || 0; // Treated as fixed Total Collection

      const currentGuests = agencies[agencyIndex].guests ? [...agencies[agencyIndex].guests] : [];
      
      // Auto-format phone number
      let formattedPhone = (newBooking.phone || '').trim();
      if (formattedPhone.startsWith('01')) {
          formattedPhone = '+88' + formattedPhone;
      }

      const newGuest: Guest = {
          id: `g_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: newBooking.name,
          phone: formattedPhone,
          address: newBooking.address,
          isCouple: newBooking.isCouple,
          seatCount: seatCount,
          seatNumbers: newBooking.seatNumbers,
          unitPrice: seatCount > 0 ? Math.round(totalAmount / seatCount) : 0, 
          collection: totalAmount, // Fixed amount (not multiplied)
          seatType: 'regular',
          paxBreakdown: {
              regular: seatCount,
              disc1: 0,
              disc2: 0
          }
      };

      currentGuests.push(newGuest);
      agencies[agencyIndex] = { ...agencies[agencyIndex], guests: currentGuests };
      
      await updateTourAgencies(agencies);
      setNewBooking({ name: '', phone: '', address: '', isCouple: false, seatCount: '', unitPrice: '', seatNumbers: '' });
      setIsAddingBooking(null);
  };

  const deleteGuest = async (e: React.MouseEvent | undefined, agencyId: string, guestId: string) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
      }

      if(!window.confirm("Delete this guest?")) return;
      
      if (!activeTour.partnerAgencies) return;

      const agencies = activeTour.partnerAgencies.map(a => ({
          ...a,
          guests: a.guests ? [...a.guests] : []
      }));

      const agIdx = agencies.findIndex((a: PartnerAgency) => a.id === agencyId);
      
      if (agIdx !== -1) {
          agencies[agIdx].guests = agencies[agIdx].guests.filter((g: Guest) => g.id !== guestId);
          await updateTourAgencies(agencies);
      }
  };

  const startEditingSeats = (e: React.MouseEvent, agencyId: string, guest: Guest) => {
      e.stopPropagation();
      setEditingGuest({ agencyId, guestId: guest.id });
      if (guest.paxBreakdown) {
          setSeatBreakdown(guest.paxBreakdown);
      } else {
          const total = safeNum(guest.seatCount);
          const type = guest.seatType || 'regular';
          setSeatBreakdown({
              regular: type === 'regular' ? total : 0,
              disc1: type === 'disc1' ? total : 0,
              disc2: type === 'disc2' ? total : 0,
          });
      }
  };

  const saveSeatBreakdown = async (guestTotalSeats: number) => {
      if (!editingGuest) return;
      
      const totalAssigned = safeNum(seatBreakdown.regular) + safeNum(seatBreakdown.disc1) + safeNum(seatBreakdown.disc2);
      
      if (totalAssigned !== guestTotalSeats) {
          alert(`Total seats must match guest count (${guestTotalSeats}). You entered ${totalAssigned}.`);
          return;
      }

      const agencies = activeTour.partnerAgencies.map(a => ({
          ...a,
          guests: a.guests ? [...a.guests] : []
      }));

      const agIdx = agencies.findIndex((a: PartnerAgency) => a.id === editingGuest.agencyId);
      
      if (agIdx > -1) {
          const guestIdx = agencies[agIdx].guests.findIndex((g: Guest) => g.id === editingGuest.guestId);
          if (guestIdx > -1) {
              agencies[agIdx].guests[guestIdx].paxBreakdown = seatBreakdown;
          }
      }
      
      await updateTourAgencies(agencies);
      setEditingGuest(null);
  };

  const updateAgencySettlementStatus = async (agencyId: string, status: SettlementStatus, e: React.MouseEvent) => {
      e.stopPropagation();
      if (status === 'settled' && !window.confirm("Accept payment?")) return;
      if (status === 'paid' && !window.confirm("Payment Complete?")) return;

      setIsUpdatingStatus(true);
      try {
           const agencies = activeTour.partnerAgencies.map(a => ({
                ...a,
                guests: a.guests ? [...a.guests] : []
            }));
            const idx = agencies.findIndex(a => a.id === agencyId);
            if (idx !== -1) {
                agencies[idx].settlementStatus = status;
                await updateTourAgencies(agencies);
            }
      } catch(err) {
          console.error(err);
      } finally {
          setIsUpdatingStatus(false);
      }
  };

  const getWhatsAppLink = (phone: string) => {
      let p = phone.replace(/[^0-9]/g, '');
      if (p.startsWith('01')) p = '88' + p;
      return `https://wa.me/${p}`;
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-6xl mx-auto font-sans pb-4">
      {/* Selector */}
      <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 relative z-20">
        <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
            <Users size={18} />
        </div>
        <div className="flex-1 min-w-0">
            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 truncate">এজেন্সি পার্টনার</label>
            <div className="relative">
                <select 
                    value={selectedTourId}
                    onChange={(e) => setSelectedTourId(e.target.value)}
                    className="w-full appearance-none bg-transparent text-slate-800 text-sm font-black focus:outline-none cursor-pointer pr-6 py-1 truncate"
                >
                    {tours.map(t => <option key={t.id} value={t.id}>{t.name} ({t.date})</option>)}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} strokeWidth={2.5} />
            </div>
        </div>
      </div>

      <div className="flex justify-between items-center bg-white/70 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-white/50 sticky top-14 sm:top-4 z-30 transition-all">
        <div className="pl-1">
            <h2 className="font-bold text-slate-800 text-xs">পার্টনার তালিকা</h2>
        </div>
        {isAdmin && (
            <button onClick={() => setShowAddAgency(true)} className="bg-slate-900 text-white px-3 py-2 rounded-xl text-[10px] flex items-center font-bold shadow-lg hover:bg-slate-800 transition-all active:scale-95 uppercase tracking-wide">
                <Plus size={12} className="mr-1"/> পার্টনার যোগ
            </button>
        )}
      </div>

      {showAddAgency && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md animate-fade-in">
            <div className="bg-white p-6 rounded-[2rem] shadow-2xl border border-white w-full max-w-sm relative">
                <h3 className="text-xs font-bold text-slate-800 mb-4 uppercase tracking-widest flex items-center gap-2">
                    <Briefcase size={14} className="text-blue-500"/> নতুন এজেন্সি
                </h3>
                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">নাম</label>
                        <input className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl text-xs font-bold outline-none" value={newAgency.name} onChange={e => setNewAgency({...newAgency, name: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">ইমেইল</label>
                        <input type="email" className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl text-xs font-bold outline-none" value={newAgency.email} onChange={e => setNewAgency({...newAgency, email: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">ফোন</label>
                        <input className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl text-xs font-bold outline-none" value={newAgency.phone} onChange={e => setNewAgency({...newAgency, phone: e.target.value})} />
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={() => setShowAddAgency(false)} className="px-4 py-2 rounded-lg text-slate-500 text-xs font-bold">বাতিল</button>
                    <button onClick={handleAddAgency} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-lg">তৈরি করুন</button>
                </div>
            </div>
          </div>
      )}

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {activeTour.partnerAgencies && activeTour.partnerAgencies.map(agency => {
            const settlement = calculateAgencySettlement(activeTour, agency);
            const isExpanded = expandedAgency === agency.id;
            const status = agency.settlementStatus || 'unpaid';
            
            const isAdminPayer = settlement.netAmount < 0;

            return (
              <div key={agency.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-300 flex flex-col ${isExpanded ? 'border-violet-200 ring-2 ring-violet-50/30 col-span-1 lg:col-span-2 shadow-xl' : 'border-slate-100 hover:shadow-md'}`}>
                  <div 
                    onClick={() => setExpandedAgency(isExpanded ? null : agency.id)}
                    className={`p-4 flex justify-between items-center cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50/50 border-b border-slate-100' : ''}`}
                  >
                      <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isExpanded ? 'bg-violet-600 text-white' : 'bg-slate-50 text-slate-300 border border-slate-100'}`}>
                              {isExpanded ? <FolderOpen size={18} /> : <Users size={18} />}
                          </div>
                          <div>
                              <div className="flex items-center gap-2">
                                  <h3 className={`font-black text-sm leading-tight ${isExpanded ? 'text-violet-900' : 'text-slate-800'}`}>{agency.name}</h3>
                                  {status === 'settled' && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5"><CheckCircle size={8}/> Paid</span>}
                                  {status === 'paid' && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5"><Clock size={8}/> Pending</span>}
                              </div>
                              {isExpanded && <p className="text-[9px] text-slate-400 font-bold flex items-center mt-0.5"><Mail size={10} className="mr-1"/> {agency.email}</p>}
                          </div>
                      </div>
                      <div className="flex items-center gap-3">
                          {isAdmin && (
                            <div className="text-right hidden sm:block bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm">
                                <p className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">সেটেলমেন্ট</p>
                                <p className={`text-xs font-black ${settlement.netAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {settlement.netAmount >= 0 ? '+' : ''}{settlement.netAmount.toLocaleString()} ৳
                                </p>
                            </div>
                          )}
                          <div className={`p-2 rounded-full transition-all duration-300 ${isExpanded ? 'rotate-180 bg-violet-100 text-violet-600' : 'bg-slate-50 text-slate-400'}`}>
                            <ChevronDown size={14}/>
                          </div>
                      </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 animate-fade-in bg-slate-50/30">
                        {isAdmin && (
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                <div className="bg-white p-3 rounded-xl border border-slate-100 text-center shadow-sm">
                                    <p className="text-[8px] text-slate-400 font-bold uppercase mb-1">মোট সিট</p>
                                    <p className="text-xl font-black text-slate-800">{settlement.totalSeats}</p>
                                </div>
                                <div className={`p-3 rounded-xl border text-center ${settlement.netAmount >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-rose-50 border-rose-100'}`}>
                                    <p className={`text-[8px] font-bold uppercase mb-1 ${settlement.netAmount >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                                        {settlement.netAmount >= 0 ? 'দিবেন' : 'পাবেন'}
                                    </p>
                                    <div className="flex flex-col items-center">
                                        <p className={`text-lg font-black ${settlement.netAmount >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>৳{Math.abs(settlement.netAmount).toLocaleString()}</p>
                                        
                                        {/* Status Actions */}
                                        {!isAdminPayer && (
                                            status === 'paid' ? (
                                                <div className="flex gap-2 mt-2">
                                                    <button onClick={(e) => updateAgencySettlementStatus(agency.id, 'unpaid', e)} disabled={isUpdatingStatus} className="p-1.5 bg-white text-rose-500 rounded border border-rose-200 hover:bg-rose-50 shadow-sm flex items-center gap-1" title="Decline"><XCircle size={14}/> Decline</button>
                                                    <button onClick={(e) => updateAgencySettlementStatus(agency.id, 'settled', e)} disabled={isUpdatingStatus} className="p-1.5 bg-emerald-500 text-white rounded border border-emerald-600 hover:bg-emerald-600 shadow-sm flex items-center gap-1" title="Accept"><CheckCircle size={14}/> Accept</button>
                                                </div>
                                            ) : (
                                                status !== 'settled' && <span className="text-[10px] font-bold text-slate-400 mt-2">এজেন্সি পেমেন্টের অপেক্ষায়...</span>
                                            )
                                        )}

                                        {isAdminPayer && (
                                            status === 'paid' ? (
                                                <span className="text-[10px] font-bold text-amber-500 mt-2 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">কনফার্মেশনের অপেক্ষায়</span>
                                            ) : status !== 'settled' ? (
                                                <button onClick={(e) => updateAgencySettlementStatus(agency.id, 'paid', e)} disabled={isUpdatingStatus} className="mt-2 text-[10px] font-bold bg-white text-slate-900 border border-slate-200 px-2 py-1 rounded hover:bg-slate-50 flex items-center gap-1">
                                                    <CheckCircle size={12}/> Pay Agency
                                                </button>
                                            ) : null
                                        )}
                                        
                                        {status === 'settled' && (
                                            <button onClick={(e) => updateAgencySettlementStatus(agency.id, 'unpaid', e)} disabled={isUpdatingStatus} className="text-[9px] text-slate-400 underline mt-1">Reopen</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="bg-white px-4 py-3 border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
                                <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    বুকিং লিস্ট
                                </h4>
                                {isAdmin && (
                                    <button onClick={() => setIsAddingBooking(agency.id)} className="text-violet-700 text-[9px] bg-violet-50 px-3 py-1.5 rounded-lg border border-violet-100 flex items-center font-bold">
                                        <UserPlus size={12} className="mr-1" /> যোগ
                                    </button>
                                )}
                            </div>
                            
                            {isAddingBooking === agency.id && (
                                <div className="p-4 bg-slate-50 border-b border-slate-100 animate-fade-in">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 block mb-0.5">গেস্ট নাম</label>
                                            <input className="w-full border border-slate-200 bg-white p-2 rounded-lg text-xs outline-none font-bold" placeholder="নাম" value={newBooking.name} onChange={e => setNewBooking({...newBooking, name: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 block mb-0.5">মোবাইল</label>
                                            <input className="w-full border border-slate-200 bg-white p-2 rounded-lg text-xs outline-none font-bold" placeholder="01..." value={newBooking.phone} onChange={e => setNewBooking({...newBooking, phone: e.target.value})} />
                                        </div>
                                        {/* NEW: Address Field */}
                                        <div className="sm:col-span-2">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 block mb-0.5">ঠিকানা</label>
                                            <input className="w-full border border-slate-200 bg-white p-2 rounded-lg text-xs outline-none font-bold" placeholder="ঠিকানা" value={newBooking.address} onChange={e => setNewBooking({...newBooking, address: e.target.value})} />
                                        </div>
                                        {/* NEW: Couple Checkbox */}
                                        <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                                             <input type="checkbox" checked={newBooking.isCouple} onChange={e => setNewBooking({...newBooking, isCouple: e.target.checked})} className="w-4 h-4"/>
                                             <label className="text-[10px] font-bold text-pink-500 uppercase">কাপল?</label>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 block mb-0.5">সিট</label>
                                            <input type="number" className="w-full border border-slate-200 bg-white p-2 rounded-lg text-xs outline-none font-bold text-center" placeholder="0" value={newBooking.seatCount} onChange={e => setNewBooking({...newBooking, seatCount: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 block mb-0.5">কালেকশন</label>
                                            <input type="number" className="w-full border border-emerald-200 bg-emerald-50/50 p-2 rounded-lg text-xs outline-none font-bold text-center text-emerald-700" placeholder="0" value={newBooking.unitPrice} onChange={e => setNewBooking({...newBooking, unitPrice: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 block mb-0.5">সিট নম্বর</label>
                                            <input className="w-full border border-slate-200 bg-white p-2 rounded-lg text-xs outline-none font-bold" placeholder="A1, B2..." value={newBooking.seatNumbers} onChange={e => setNewBooking({...newBooking, seatNumbers: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setIsAddingBooking(null)} className="flex-1 py-2 rounded-lg text-slate-500 text-xs font-bold bg-white border border-slate-200">বাতিল</button>
                                        <button onClick={() => addBookingToAgency(agency.id)} className="flex-1 bg-violet-600 text-white py-2 rounded-lg text-xs font-bold">সেভ</button>
                                    </div>
                                </div>
                            )}

                            {!agency.guests || agency.guests.length === 0 ? (
                                <div className="text-center py-6 text-[10px] text-slate-400 font-bold italic">কোন গেস্ট নেই।</div>
                            ) : (
                                <div className="space-y-2 p-3 bg-slate-50/30">
                                    {agency.guests.map((guest, index) => {
                                        const isEditing = editingGuest?.agencyId === agency.id && editingGuest?.guestId === guest.id;
                                        const breakdownSum = safeNum(seatBreakdown.regular) + safeNum(seatBreakdown.disc1) + safeNum(seatBreakdown.disc2);
                                        const isValid = breakdownSum === safeNum(guest.seatCount);

                                        return (
                                        <div key={guest.id} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-[9px] font-bold shrink-0">
                                                            {index + 1}
                                                        </div>
                                                        <p className="font-bold text-slate-800 text-xs truncate">{guest.name}</p>
                                                        {guest.isCouple && (
                                                            <span className="text-[8px] font-bold text-white bg-pink-500 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Heart size={8} fill="currentColor"/> Couple</span>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex flex-col ml-7 gap-1">
                                                        {guest.phone && (
                                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                                <span className="text-[10px] font-bold text-slate-500">{guest.phone}</span>
                                                                <div className="flex gap-1">
                                                                    <a href={`tel:${guest.phone}`} className="text-[9px] text-white font-bold bg-emerald-500 px-2 py-1 rounded shadow-sm hover:bg-emerald-600 transition-all flex items-center gap-1" title="Call" onClick={(e) => e.stopPropagation()}>
                                                                        <Phone size={10}/> Call
                                                                    </a>
                                                                    <a href={getWhatsAppLink(guest.phone)} target="_blank" rel="noopener noreferrer" className="text-[9px] text-white font-bold bg-green-500 px-2 py-1 rounded shadow-sm hover:bg-green-600 transition-all flex items-center gap-1" title="WhatsApp" onClick={(e) => e.stopPropagation()}>
                                                                        <MessageCircle size={10}/> WA
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {guest.address && (
                                                            <div className="flex items-center gap-1 text-[9px] text-slate-500 font-bold mb-1">
                                                                <MapPin size={10} className="text-slate-400"/> {guest.address}
                                                            </div>
                                                        )}
                                                        <div className="flex gap-1.5">
                                                            <span className="text-[9px] text-slate-500 font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{guest.seatCount} সিট</span>
                                                            {guest.seatNumbers && (
                                                                <span className="text-[9px] text-violet-600 font-bold bg-violet-50 px-1.5 py-0.5 rounded border border-violet-100 flex items-center gap-0.5">
                                                                    <Armchair size={8}/> {guest.seatNumbers}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {!isEditing && guest.paxBreakdown && (
                                                        <div className="flex gap-1 ml-7 mt-1">
                                                            {guest.paxBreakdown.regular > 0 && <span className="text-[8px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded font-bold">R:{guest.paxBreakdown.regular}</span>}
                                                            {guest.paxBreakdown.disc1 > 0 && <span className="text-[8px] bg-amber-50 text-amber-600 px-1 py-0.5 rounded font-bold">D1:{guest.paxBreakdown.disc1}</span>}
                                                            {guest.paxBreakdown.disc2 > 0 && <span className="text-[8px] bg-orange-50 text-orange-600 px-1 py-0.5 rounded font-bold">D2:{guest.paxBreakdown.disc2}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="flex flex-col items-end gap-2">
                                                    <div className="text-right">
                                                        <p className="font-mono font-black text-emerald-600 text-xs">৳{guest.collection.toLocaleString()}</p>
                                                    </div>

                                                    <div className="flex items-center gap-1">
                                                        {isAdmin && !isEditing && (
                                                            <>
                                                                <button onClick={(e) => startEditingSeats(e, agency.id, guest)} className="p-1.5 text-slate-300 hover:text-violet-600 bg-slate-50 rounded-lg">
                                                                    <Edit3 size={14} />
                                                                </button>
                                                                <button onClick={(e) => deleteGuest(e, agency.id, guest.id)} className="p-1.5 text-slate-300 hover:text-rose-500 bg-slate-50 rounded-lg">
                                                                    <Trash size={14} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {isEditing && (
                                                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                                    <p className="text-[9px] font-bold text-slate-500 uppercase mb-2 flex justify-between">
                                                        <span>ব্রেকডাউন ({guest.seatCount})</span>
                                                        <span className={isValid ? "text-emerald-500" : "text-rose-500"}>{breakdownSum}</span>
                                                    </p>
                                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                                        <input type="number" placeholder="R" min="0" value={seatBreakdown.regular} onChange={(e) => setSeatBreakdown({...seatBreakdown, regular: safeNum(e.target.value)})} className="p-1.5 text-center text-xs font-bold rounded border border-slate-200" />
                                                        <input type="number" placeholder="D1" min="0" value={seatBreakdown.disc1} onChange={(e) => setSeatBreakdown({...seatBreakdown, disc1: safeNum(e.target.value)})} className="p-1.5 text-center text-xs font-bold rounded border border-slate-200" />
                                                        <input type="number" placeholder="D2" min="0" value={seatBreakdown.disc2} onChange={(e) => setSeatBreakdown({...seatBreakdown, disc2: safeNum(e.target.value)})} className="p-1.5 text-center text-xs font-bold rounded border border-slate-200" />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setEditingGuest(null)} className="flex-1 py-1.5 text-[10px] font-bold bg-white border border-slate-200 rounded text-slate-500">বাতিল</button>
                                                        <button disabled={!isValid} onClick={() => saveSeatBreakdown(guest.seatCount)} className={`flex-1 py-1.5 text-[10px] font-bold text-white rounded ${isValid ? 'bg-violet-600' : 'bg-slate-300'}`}>সেভ</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )})}
                                </div>
                            )}
                        </div>
                    </div>
                  )}
              </div>
            );
        })}
      </div>
    </div>
  );
};

export default ShareTourTab;
