

import React, { useState, useEffect } from 'react';
import { CommonTabProps, PartnerAgency, Guest } from '../types';
import { db } from '../services/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { calculateAgencySettlement, safeNum } from '../utils/calculations';
import { Users, Phone, Plus, Trash, ChevronDown, ChevronUp, UserPlus, Briefcase, Calculator, Mail, Star, Edit3, X, Check, FolderOpen, Armchair } from 'lucide-react';

const ShareTourTab: React.FC<CommonTabProps> = ({ user, tours, refreshTours }) => {
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  const [showAddAgency, setShowAddAgency] = useState(false);
  const [newAgency, setNewAgency] = useState({ name: '', phone: '', email: '' });
  const [expandedAgency, setExpandedAgency] = useState<string | null>(null);

  const [newBooking, setNewBooking] = useState({ name: '', phone: '', seatCount: '', unitPrice: '', seatNumbers: '' });
  const [isAddingBooking, setIsAddingBooking] = useState<string | null>(null);
  
  const [editingGuest, setEditingGuest] = useState<{ agencyId: string, guestId: string } | null>(null);
  const [seatBreakdown, setSeatBreakdown] = useState({ regular: 0, disc1: 0, disc2: 0 });

  useEffect(() => {
    if (tours.length > 0 && !selectedTourId) {
        setSelectedTourId(tours[0].id);
    }
  }, [tours, selectedTourId]);

  const activeTour = tours.find(t => t.id === selectedTourId) || null;

  // Hosts can see this tab now, but limited view
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
      const unitPrice = parseInt(newBooking.unitPrice) || 0;

      const currentGuests = agencies[agencyIndex].guests ? [...agencies[agencyIndex].guests] : [];
      
      const newGuest: Guest = {
          id: `g_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: newBooking.name,
          phone: newBooking.phone || '',
          seatCount: seatCount,
          seatNumbers: newBooking.seatNumbers,
          unitPrice: unitPrice, 
          collection: seatCount * unitPrice, 
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
      setNewBooking({ name: '', phone: '', seatCount: '', unitPrice: '', seatNumbers: '' });
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

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto font-sans pb-24">
      {/* Selector */}
      <div className="bg-white p-2 rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-100 flex items-center gap-4 relative z-20">
        <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 ring-4 ring-blue-50/50">
            <Users size={20} />
        </div>
        <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">এজেন্সি পার্টনার ম্যানেজমেন্ট</label>
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

      <div className="flex justify-between items-center bg-white/70 backdrop-blur-md p-4 rounded-[2rem] shadow-glass border border-white/50 sticky top-4 z-30 transition-all">
        <div className="pl-2">
            <h2 className="font-bold text-slate-800 text-sm">পার্টনার তালিকা</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active Collaboration</p>
        </div>
        {isAdmin && (
            <button onClick={() => setShowAddAgency(true)} className="bg-slate-900 text-white px-6 py-3.5 rounded-2xl text-xs flex items-center font-bold shadow-xl shadow-slate-300 hover:bg-slate-800 transition-all active:scale-95 uppercase tracking-wide hover:scale-105">
                <Plus size={16} className="mr-2"/> পার্টনার যোগ করুন
            </button>
        )}
      </div>

      {showAddAgency && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md animate-fade-in">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-black/20 border border-white w-full max-w-md relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
                <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-widest flex items-center gap-2">
                    <Briefcase size={16} className="text-blue-500"/> নতুন এজেন্সি প্রোফাইল
                </h3>
                <div className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">এজেন্সির নাম</label>
                        <input className="w-full border border-slate-200 bg-slate-50 p-4 rounded-2xl text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-bold placeholder-slate-300" placeholder="e.g. Sky Travels" value={newAgency.name} onChange={e => setNewAgency({...newAgency, name: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">লগইন ইমেইল</label>
                        <input type="email" className="w-full border border-slate-200 bg-slate-50 p-4 rounded-2xl text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-bold placeholder-slate-300" placeholder="agent@email.com" value={newAgency.email} onChange={e => setNewAgency({...newAgency, email: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">ফোন</label>
                        <input className="w-full border border-slate-200 bg-slate-50 p-4 rounded-2xl text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-bold placeholder-slate-300" placeholder="017..." value={newAgency.phone} onChange={e => setNewAgency({...newAgency, phone: e.target.value})} />
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-8">
                    <button onClick={() => setShowAddAgency(false)} className="px-6 py-3 rounded-xl text-slate-500 text-xs hover:bg-slate-100 transition-colors font-bold uppercase tracking-wide">বাতিল</button>
                    <button onClick={handleAddAgency} className="bg-blue-600 text-white px-8 py-3 rounded-xl text-xs font-bold shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all uppercase tracking-wide hover:scale-105">প্রোফাইল তৈরি করুন</button>
                </div>
            </div>
          </div>
      )}

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {activeTour.partnerAgencies && activeTour.partnerAgencies.map(agency => {
            const settlement = calculateAgencySettlement(activeTour, agency);
            const isExpanded = expandedAgency === agency.id;
            
            return (
              <div key={agency.id} className={`bg-white rounded-[2.5rem] shadow-sm border overflow-hidden transition-all duration-300 flex flex-col ${isExpanded ? 'border-violet-200 ring-4 ring-violet-50/30 col-span-1 lg:col-span-2 shadow-2xl shadow-violet-100' : 'border-slate-100 hover:shadow-xl hover:shadow-slate-200/40 hover:-translate-y-1'}`}>
                  <div 
                    onClick={() => setExpandedAgency(isExpanded ? null : agency.id)}
                    className={`p-7 flex justify-between items-center cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50/50 border-b border-slate-100' : 'hover:bg-slate-50/30'}`}
                  >
                      <div className="flex items-center gap-5">
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${isExpanded ? 'bg-violet-600 text-white shadow-xl shadow-violet-300' : 'bg-slate-50 text-slate-300 border border-slate-100'}`}>
                              {isExpanded ? <FolderOpen size={28} /> : <Users size={28} />}
                          </div>
                          <div>
                              <h3 className={`font-black text-xl leading-tight ${isExpanded ? 'text-violet-900' : 'text-slate-800'}`}>{agency.name}</h3>
                              <p className="text-[11px] text-slate-400 font-bold flex items-center mt-1"><Mail size={12} className="mr-1.5"/> {agency.email || 'No Email Linked'}</p>
                          </div>
                      </div>
                      <div className="flex items-center gap-5">
                          {/* Financial Summary hidden for Hosts */}
                          {isAdmin && (
                            <div className="text-right hidden sm:block bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm">
                                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">সেটেলমেন্ট</p>
                                <p className={`text-base font-black ${settlement.netAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {settlement.netAmount >= 0 ? '+' : ''}{settlement.netAmount.toLocaleString()} ৳
                                </p>
                            </div>
                          )}
                          <div className={`p-3 rounded-full transition-all duration-300 ${isExpanded ? 'rotate-180 bg-violet-100 text-violet-600' : 'bg-slate-50 text-slate-400'}`}>
                            <ChevronDown size={20}/>
                          </div>
                      </div>
                  </div>

                  {isExpanded && (
                    <div className="p-8 animate-fade-in bg-slate-50/30">
                        {/* Summary Grid - Only for Admin */}
                        {isAdmin && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                <div className="bg-white p-5 rounded-3xl border border-slate-100 text-center shadow-sm hover:shadow-md transition-shadow">
                                    <p className="text-[9px] text-slate-400 font-bold uppercase mb-2">মোট সিট</p>
                                    <p className="text-3xl font-black text-slate-800">{settlement.totalSeats}</p>
                                </div>
                                <div className="bg-orange-50 p-5 rounded-3xl border border-orange-100 text-center hover:bg-orange-100 transition-colors">
                                    <p className="text-[9px] text-orange-600 font-bold uppercase mb-2">বাই রেট (ফিক্সড)</p>
                                    <p className="text-2xl font-black text-orange-700">৳{settlement.rates.regular.toLocaleString()}</p>
                                </div>
                                <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100 text-center hover:bg-emerald-100 transition-colors">
                                    <p className="text-[9px] text-emerald-600 font-bold uppercase mb-2">হোস্ট পাবে (কালেকশন)</p>
                                    <p className="text-2xl font-black text-emerald-700">৳{settlement.totalCollection.toLocaleString()}</p>
                                </div>
                                <div className={`p-5 rounded-3xl border text-center transition-colors ${settlement.netAmount >= 0 ? 'bg-blue-50 border-blue-100 hover:bg-blue-100' : 'bg-rose-50 border-rose-100 hover:bg-rose-100'}`}>
                                    <p className={`text-[9px] font-bold uppercase mb-2 ${settlement.netAmount >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                                        {settlement.netAmount >= 0 ? 'নেট পাওনা (দিবেন)' : 'নেট পাওনা (পাবেন)'}
                                    </p>
                                    <p className={`text-2xl font-black ${settlement.netAmount >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>৳{Math.abs(settlement.netAmount).toLocaleString()}</p>
                                </div>
                            </div>
                        )}

                        {/* Guest List Container */}
                        <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                            <div className="bg-white px-6 py-5 border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-3">
                                    <div className="p-2 bg-slate-100 rounded-lg"><Users size={14}/></div> বুকিং লিস্ট
                                </h4>
                                {isAdmin && (
                                    <button onClick={() => setIsAddingBooking(agency.id)} className="text-violet-700 text-[10px] bg-violet-50 px-4 py-2 rounded-xl border border-violet-100 flex items-center font-bold hover:bg-violet-100 transition-all uppercase tracking-wide hover:scale-105 shadow-sm">
                                        <UserPlus size={14} className="mr-1.5" /> গেস্ট যোগ করুন
                                    </button>
                                )}
                            </div>
                            
                            {isAddingBooking === agency.id && (
                                <div className="p-6 bg-slate-50 border-b border-slate-100 animate-fade-in">
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="col-span-2">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 block mb-1">গেস্ট নাম</label>
                                            <input className="w-full border border-slate-200 bg-white p-3.5 rounded-xl text-sm outline-none font-bold focus:ring-4 focus:ring-violet-500/10" placeholder="নাম" value={newBooking.name} onChange={e => setNewBooking({...newBooking, name: e.target.value})} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 block mb-1">মোবাইল</label>
                                            <input className="w-full border border-slate-200 bg-white p-3.5 rounded-xl text-sm outline-none font-bold focus:ring-4 focus:ring-violet-500/10" placeholder="ফোন" value={newBooking.phone} onChange={e => setNewBooking({...newBooking, phone: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 block mb-1">সিট</label>
                                            <input type="number" className="w-full border border-slate-200 bg-white p-3.5 rounded-xl text-sm outline-none font-bold text-center focus:ring-4 focus:ring-violet-500/10" placeholder="0" value={newBooking.seatCount} onChange={e => setNewBooking({...newBooking, seatCount: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 block mb-1">কালেকশন</label>
                                            <input type="number" className="w-full border border-emerald-200 bg-emerald-50/50 p-3.5 rounded-xl text-sm outline-none font-bold text-center text-emerald-700 focus:ring-4 focus:ring-emerald-500/20" placeholder="0" value={newBooking.unitPrice} onChange={e => setNewBooking({...newBooking, unitPrice: e.target.value})} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 block mb-1">সিট নম্বর</label>
                                            <input className="w-full border border-slate-200 bg-white p-3.5 rounded-xl text-sm outline-none font-bold focus:ring-4 focus:ring-violet-500/10" placeholder="A1, A2, B3..." value={newBooking.seatNumbers} onChange={e => setNewBooking({...newBooking, seatNumbers: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                        <div className="text-xs font-bold text-slate-500">
                                            মোট বাকি: <span className="text-violet-600 text-sm font-black ml-1">৳{((parseInt(newBooking.seatCount)||0) * (parseInt(newBooking.unitPrice)||0)).toLocaleString()}</span>
                                        </div>
                                        <div className="flex gap-3">
                                            <button onClick={() => setIsAddingBooking(null)} className="px-5 py-2.5 rounded-xl text-slate-500 text-xs font-bold hover:bg-slate-100 transition-colors">বাতিল</button>
                                            <button onClick={() => addBookingToAgency(agency.id)} className="bg-violet-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg hover:bg-violet-700 transition-all hover:scale-105">সেভ করুন</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!agency.guests || agency.guests.length === 0 ? (
                                <div className="text-center py-12 flex flex-col items-center justify-center bg-slate-50/30">
                                    <div className="bg-slate-50 p-4 rounded-full mb-3 text-slate-300">
                                        <Users size={28} />
                                    </div>
                                    <p className="text-xs text-slate-400 italic font-bold">কোন গেস্ট নেই।</p>
                                </div>
                            ) : (
                                <div className="space-y-3 p-6 bg-slate-50/30">
                                    {agency.guests.map((guest, index) => {
                                        const isEditing = editingGuest?.agencyId === agency.id && editingGuest?.guestId === guest.id;
                                        const breakdownSum = safeNum(seatBreakdown.regular) + safeNum(seatBreakdown.disc1) + safeNum(seatBreakdown.disc2);
                                        const isValid = breakdownSum === safeNum(guest.seatCount);

                                        return (
                                        <div key={guest.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all group">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold">
                                                            {index + 1}
                                                        </div>
                                                        <p className="font-bold text-slate-800 text-sm">{guest.name}</p>
                                                        {/* Badges */}
                                                        {!isEditing && guest.paxBreakdown ? (
                                                             <div className="flex gap-1 ml-2">
                                                                 {guest.paxBreakdown.regular > 0 && <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md border border-slate-200 font-bold">R:{guest.paxBreakdown.regular}</span>}
                                                                 {guest.paxBreakdown.disc1 > 0 && <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md border border-amber-200 font-bold">D1:{guest.paxBreakdown.disc1}</span>}
                                                                 {guest.paxBreakdown.disc2 > 0 && <span className="text-[9px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-md border border-orange-200 font-bold">D2:{guest.paxBreakdown.disc2}</span>}
                                                             </div>
                                                        ) : (
                                                            !isEditing && guest.seatType && guest.seatType !== 'regular' && (
                                                                <span className="bg-amber-100 text-amber-700 text-[9px] px-2 py-0.5 rounded-lg border border-amber-200 font-bold uppercase flex items-center gap-1 ml-2">
                                                                    <Star size={8} fill="currentColor"/> {guest.seatType}
                                                                </span>
                                                            )
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-3 mt-2 ml-11">
                                                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1"><Phone size={10}/> {guest.phone || 'N/A'}</span>
                                                        <span className="text-[10px] text-slate-500 font-bold bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">{guest.seatCount || 1} সিট</span>
                                                        {guest.seatNumbers && (
                                                            <span className="text-[10px] text-violet-600 font-bold bg-violet-50 px-2 py-0.5 rounded-lg border border-violet-100 flex items-center gap-1">
                                                                <Armchair size={10}/> {guest.seatNumbers}
                                                            </span>
                                                        )}
                                                        {/* Hide unit price for Host */}
                                                        {isAdmin && <span className="text-[10px] text-slate-400 font-medium">@ ৳{guest.unitPrice || 0}</span>}
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-5 w-full sm:w-auto justify-between sm:justify-end ml-11 sm:ml-0">
                                                    <div className="text-right">
                                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">বাকি</p>
                                                        <p className="font-mono font-black text-emerald-600 text-sm">৳{guest.collection.toLocaleString()}</p>
                                                    </div>

                                                    <div className="flex items-center gap-1">
                                                        {isAdmin && !isEditing && (
                                                            <>
                                                                <button 
                                                                    type="button"
                                                                    onClick={(e) => startEditingSeats(e, agency.id, guest)}
                                                                    className="p-3 text-slate-300 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-all"
                                                                    title="Edit Seats"
                                                                >
                                                                    <Edit3 size={18} />
                                                                </button>
                                                                <button 
                                                                    type="button"
                                                                    onClick={(e) => deleteGuest(e, agency.id, guest.id)}
                                                                    className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                                                    title="Delete Guest"
                                                                >
                                                                    <Trash size={18} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Granular Seat Editor */}
                                            {isEditing && (
                                                <div className="mt-4 p-5 bg-white border border-slate-200 rounded-2xl shadow-xl relative z-20 animate-fade-in mx-4 mb-2 ring-4 ring-slate-50">
                                                    <div className="absolute -top-2 right-12 w-4 h-4 bg-white border-t border-l border-slate-200 transform rotate-45"></div>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-4 flex justify-between border-b border-slate-100 pb-3">
                                                        <span>সিট ব্রেকডাউন (মোট লাগবে: {guest.seatCount})</span>
                                                        <span className={isValid ? "text-emerald-500" : "text-rose-500"}>
                                                            অ্যাসাইন করা: {breakdownSum}
                                                        </span>
                                                    </p>
                                                    <div className="grid grid-cols-3 gap-4">
                                                        <div>
                                                            <label className="text-[9px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">রেগুলার</label>
                                                            <input type="number" min="0" value={seatBreakdown.regular} onChange={(e) => setSeatBreakdown({...seatBreakdown, regular: safeNum(e.target.value)})} 
                                                                className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold text-center outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">ডিস ১</label>
                                                            <input type="number" min="0" value={seatBreakdown.disc1} onChange={(e) => setSeatBreakdown({...seatBreakdown, disc1: safeNum(e.target.value)})} 
                                                                className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold text-center outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">ডিস ২</label>
                                                            <input type="number" min="0" value={seatBreakdown.disc2} onChange={(e) => setSeatBreakdown({...seatBreakdown, disc2: safeNum(e.target.value)})} 
                                                                className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold text-center outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all" />
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end gap-3 mt-5">
                                                        <button onClick={() => setEditingGuest(null)} className="px-5 py-2.5 text-slate-500 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 text-xs font-bold transition-colors">
                                                            বাতিল
                                                        </button>
                                                        <button 
                                                            disabled={!isValid}
                                                            onClick={() => saveSeatBreakdown(guest.seatCount)} 
                                                            className={`px-6 py-2.5 text-white rounded-xl flex items-center gap-2 text-xs font-bold shadow-lg transition-all hover:scale-105 ${isValid ? 'bg-violet-600 hover:bg-violet-700' : 'bg-slate-300 cursor-not-allowed'}`}
                                                        >
                                                            <Check size={14} /> ব্রেকডাউন আপডেট
                                                        </button>
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
