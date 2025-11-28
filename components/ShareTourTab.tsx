
import React, { useState, useEffect } from 'react';
import { CommonTabProps, PartnerAgency, Guest } from '../types';
import { db } from '../services/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { calculateAgencySettlement, safeNum } from '../utils/calculations';
import { Users, Phone, Plus, Trash, ChevronDown, ChevronUp, UserPlus, Briefcase, Calculator, Mail, Star, Edit3, X, Check, FolderOpen } from 'lucide-react';

const ShareTourTab: React.FC<CommonTabProps> = ({ user, tours, refreshTours }) => {
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  const [showAddAgency, setShowAddAgency] = useState(false);
  const [newAgency, setNewAgency] = useState({ name: '', phone: '', email: '' });
  const [expandedAgency, setExpandedAgency] = useState<string | null>(null);

  const [newBooking, setNewBooking] = useState({ name: '', phone: '', seatCount: '', unitPrice: '' });
  const [isAddingBooking, setIsAddingBooking] = useState<string | null>(null);
  
  const [editingGuest, setEditingGuest] = useState<{ agencyId: string, guestId: string } | null>(null);
  const [seatBreakdown, setSeatBreakdown] = useState({ regular: 0, disc1: 0, disc2: 0 });

  useEffect(() => {
    if (tours.length > 0 && !selectedTourId) {
        setSelectedTourId(tours[0].id);
    }
  }, [tours, selectedTourId]);

  const activeTour = tours.find(t => t.id === selectedTourId) || null;

  if (user.role !== 'admin') return <div className="h-full flex items-center justify-center text-rose-400 font-bold p-10 bg-rose-50 m-4 rounded-3xl border border-rose-100">Restricted Access: Admin Only</div>;
  
  if (!activeTour) return (
    <div className="h-full flex flex-col items-center justify-center p-20 text-center text-slate-400">
        <div className="bg-slate-100 p-8 rounded-full mb-6 animate-pulse"><Users size={32} /></div>
        <p className="font-bold text-sm">No Tour Data Available</p>
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
      setNewBooking({ name: '', phone: '', seatCount: '', unitPrice: '' });
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
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Selector */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 relative z-20">
        <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
            <Users size={20} />
        </div>
        <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Manage Agency Partners</label>
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

      <div className="flex justify-between items-center bg-white/70 backdrop-blur-md p-4 rounded-[1.5rem] shadow-glass border border-white/50 sticky top-4 z-30">
        <div>
            <h2 className="font-bold text-slate-800 text-sm">Partner List</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active Collaboration</p>
        </div>
        <button onClick={() => setShowAddAgency(true)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs flex items-center font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 uppercase tracking-wide">
            <Plus size={14} className="mr-2"/> Add Partner
        </button>
      </div>

      {showAddAgency && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm animate-fade-in">
            <div className="bg-white p-8 rounded-[2rem] shadow-2xl border border-white w-full max-w-md relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
                <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-widest flex items-center gap-2">
                    <Briefcase size={16} className="text-blue-500"/> New Agency Profile
                </h3>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Agency Name</label>
                        <input className="w-full border border-slate-200 bg-slate-50 p-4 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold" placeholder="e.g. Sky Travels" value={newAgency.name} onChange={e => setNewAgency({...newAgency, name: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Login Email</label>
                        <input type="email" className="w-full border border-slate-200 bg-slate-50 p-4 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold" placeholder="agent@email.com" value={newAgency.email} onChange={e => setNewAgency({...newAgency, email: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Phone</label>
                        <input className="w-full border border-slate-200 bg-slate-50 p-4 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold" placeholder="017..." value={newAgency.phone} onChange={e => setNewAgency({...newAgency, phone: e.target.value})} />
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-8">
                    <button onClick={() => setShowAddAgency(false)} className="px-5 py-2.5 rounded-xl text-slate-500 text-xs hover:bg-slate-100 transition-colors font-bold uppercase tracking-wide">Cancel</button>
                    <button onClick={handleAddAgency} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all uppercase tracking-wide">Create Profile</button>
                </div>
            </div>
          </div>
      )}

      <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
        {activeTour.partnerAgencies && activeTour.partnerAgencies.map(agency => {
            const settlement = calculateAgencySettlement(activeTour, agency);
            const isExpanded = expandedAgency === agency.id;
            
            return (
              <div key={agency.id} className={`bg-white rounded-[2rem] shadow-sm border overflow-hidden transition-all duration-300 flex flex-col ${isExpanded ? 'border-violet-200 ring-4 ring-violet-50/50 col-span-1 lg:col-span-2 shadow-xl' : 'border-slate-100 hover:shadow-md'}`}>
                  <div 
                    onClick={() => setExpandedAgency(isExpanded ? null : agency.id)}
                    className={`p-6 flex justify-between items-center cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50/50 border-b border-slate-100' : 'hover:bg-slate-50/30'}`}
                  >
                      <div className="flex items-center gap-5">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isExpanded ? 'bg-violet-600 text-white shadow-lg shadow-violet-200' : 'bg-slate-50 text-slate-300 border border-slate-100'}`}>
                              {isExpanded ? <FolderOpen size={24} /> : <Users size={24} />}
                          </div>
                          <div>
                              <h3 className={`font-black text-lg leading-tight ${isExpanded ? 'text-violet-900' : 'text-slate-800'}`}>{agency.name}</h3>
                              <p className="text-[11px] text-slate-400 font-bold flex items-center mt-1"><Mail size={10} className="mr-1.5"/> {agency.email || 'No Email Linked'}</p>
                          </div>
                      </div>
                      <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Settlement</p>
                              <p className={`text-sm font-black ${settlement.netAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {settlement.netAmount >= 0 ? '+' : ''}{settlement.netAmount.toLocaleString()} ৳
                              </p>
                          </div>
                          <div className={`p-2 rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-violet-100 text-violet-600' : 'bg-slate-50 text-slate-400'}`}>
                            <ChevronDown size={20}/>
                          </div>
                      </div>
                  </div>

                  {isExpanded && (
                    <div className="p-6 animate-fade-in bg-slate-50/30">
                        {/* Summary Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center shadow-sm">
                                <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Seats</p>
                                <p className="text-2xl font-black text-slate-800">{settlement.totalSeats}</p>
                            </div>
                            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 text-center">
                                <p className="text-[9px] text-orange-600 font-bold uppercase mb-1">Buy Rate</p>
                                <p className="text-xl font-black text-orange-700">৳{settlement.rates.regular.toLocaleString()}</p>
                            </div>
                            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center">
                                <p className="text-[9px] text-emerald-600 font-bold uppercase mb-1">Host Due</p>
                                <p className="text-xl font-black text-emerald-700">৳{settlement.totalCollection.toLocaleString()}</p>
                            </div>
                             <div className={`p-4 rounded-2xl border text-center ${settlement.netAmount >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-rose-50 border-rose-100'}`}>
                                <p className={`text-[9px] font-bold uppercase mb-1 ${settlement.netAmount >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                                    {settlement.netAmount >= 0 ? 'To Pay' : 'To Receive'}
                                </p>
                                <p className={`text-xl font-black ${settlement.netAmount >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>৳{Math.abs(settlement.netAmount).toLocaleString()}</p>
                            </div>
                        </div>

                        {/* Guest List Container */}
                        <div className="bg-white rounded-[1.75rem] border border-slate-200 overflow-hidden shadow-sm">
                            <div className="bg-white p-5 border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <Users size={14}/> Booking List
                                </h4>
                                <button onClick={() => setIsAddingBooking(agency.id)} className="text-violet-700 text-[10px] bg-violet-50 px-3 py-1.5 rounded-lg border border-violet-100 flex items-center font-bold hover:bg-violet-100 transition-all uppercase tracking-wide">
                                    <UserPlus size={12} className="mr-1.5" /> Add Guest
                                </button>
                            </div>
                            
                            {isAddingBooking === agency.id && (
                                <div className="p-6 bg-slate-50 border-b border-slate-100 animate-fade-in">
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="col-span-2">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Guest Name</label>
                                            <input className="w-full border border-slate-200 bg-white p-3 rounded-xl text-sm outline-none font-semibold focus:ring-2 focus:ring-violet-500" placeholder="Name" value={newBooking.name} onChange={e => setNewBooking({...newBooking, name: e.target.value})} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Mobile</label>
                                            <input className="w-full border border-slate-200 bg-white p-3 rounded-xl text-sm outline-none font-semibold focus:ring-2 focus:ring-violet-500" placeholder="Phone" value={newBooking.phone} onChange={e => setNewBooking({...newBooking, phone: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Seats</label>
                                            <input type="number" className="w-full border border-slate-200 bg-white p-3 rounded-xl text-sm outline-none font-bold text-center focus:ring-2 focus:ring-violet-500" placeholder="0" value={newBooking.seatCount} onChange={e => setNewBooking({...newBooking, seatCount: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Collection</label>
                                            <input type="number" className="w-full border border-emerald-200 bg-emerald-50 p-3 rounded-xl text-sm outline-none font-bold text-center text-emerald-700 focus:ring-2 focus:ring-emerald-500" placeholder="0" value={newBooking.unitPrice} onChange={e => setNewBooking({...newBooking, unitPrice: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200">
                                        <div className="text-xs font-bold text-slate-500">
                                            Total Due: <span className="text-violet-600 text-sm">৳{((parseInt(newBooking.seatCount)||0) * (parseInt(newBooking.unitPrice)||0)).toLocaleString()}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setIsAddingBooking(null)} className="px-4 py-2 rounded-lg text-slate-500 text-xs font-bold hover:bg-slate-100">Cancel</button>
                                            <button onClick={() => addBookingToAgency(agency.id)} className="bg-violet-600 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md hover:bg-violet-700">Save</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!agency.guests || agency.guests.length === 0 ? (
                                <div className="text-center py-12 flex flex-col items-center justify-center">
                                    <div className="bg-slate-50 p-4 rounded-full mb-3 text-slate-300">
                                        <Users size={24} />
                                    </div>
                                    <p className="text-xs text-slate-400 italic font-medium">No guests added yet.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {agency.guests.map((guest, index) => {
                                        const isEditing = editingGuest?.agencyId === agency.id && editingGuest?.guestId === guest.id;
                                        const breakdownSum = safeNum(seatBreakdown.regular) + safeNum(seatBreakdown.disc1) + safeNum(seatBreakdown.disc2);
                                        const isValid = breakdownSum === safeNum(guest.seatCount);

                                        return (
                                        <div key={guest.id} className={`p-4 hover:bg-slate-50 transition-colors group ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-slate-800 text-sm">{guest.name}</p>
                                                        {/* Badges */}
                                                        {!isEditing && guest.paxBreakdown ? (
                                                             <div className="flex gap-1">
                                                                 {guest.paxBreakdown.regular > 0 && <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 rounded border border-slate-200 font-bold">R:{guest.paxBreakdown.regular}</span>}
                                                                 {guest.paxBreakdown.disc1 > 0 && <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 rounded border border-amber-200 font-bold">D1:{guest.paxBreakdown.disc1}</span>}
                                                                 {guest.paxBreakdown.disc2 > 0 && <span className="text-[9px] bg-orange-50 text-orange-600 px-1.5 rounded border border-orange-200 font-bold">D2:{guest.paxBreakdown.disc2}</span>}
                                                             </div>
                                                        ) : (
                                                            !isEditing && guest.seatType && guest.seatType !== 'regular' && (
                                                                <span className="bg-amber-100 text-amber-700 text-[9px] px-1.5 py-0.5 rounded border border-amber-200 font-bold uppercase flex items-center gap-0.5">
                                                                    <Star size={8} fill="currentColor"/> {guest.seatType}
                                                                </span>
                                                            )
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-3 mt-1.5">
                                                        <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1"><Phone size={10}/> {guest.phone || 'N/A'}</span>
                                                        <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                                                        <span className="text-[10px] text-slate-500 font-bold">{guest.seatCount || 1} Seats</span>
                                                        <span className="text-[10px] text-slate-400">@ ৳{guest.unitPrice || 0}</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                                                    <div className="text-right">
                                                        <p className="text-[9px] text-slate-400 font-bold uppercase">Due</p>
                                                        <p className="font-mono font-bold text-emerald-600 text-sm">৳{guest.collection.toLocaleString()}</p>
                                                    </div>

                                                    <div className="flex items-center gap-1">
                                                        {!isEditing && (
                                                            <>
                                                                <button 
                                                                    type="button"
                                                                    onClick={(e) => startEditingSeats(e, agency.id, guest)}
                                                                    className="p-2 text-slate-300 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                                                                    title="Edit Seats"
                                                                >
                                                                    <Edit3 size={16} />
                                                                </button>
                                                                <button 
                                                                    type="button"
                                                                    onClick={(e) => deleteGuest(e, agency.id, guest.id)}
                                                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                                    title="Delete Guest"
                                                                >
                                                                    <Trash size={16} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Granular Seat Editor */}
                                            {isEditing && (
                                                <div className="mt-4 p-4 bg-white border border-slate-200 rounded-xl shadow-lg relative z-20 animate-fade-in">
                                                    <div className="absolute -top-2 right-12 w-4 h-4 bg-white border-t border-l border-slate-200 transform rotate-45"></div>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-3 flex justify-between border-b border-slate-100 pb-2">
                                                        <span>Seat Breakdown (Total Required: {guest.seatCount})</span>
                                                        <span className={isValid ? "text-emerald-500" : "text-rose-500"}>
                                                            Assigned: {breakdownSum}
                                                        </span>
                                                    </p>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        <div>
                                                            <label className="text-[9px] font-bold text-slate-400 block mb-1 uppercase">Regular</label>
                                                            <input type="number" min="0" value={seatBreakdown.regular} onChange={(e) => setSeatBreakdown({...seatBreakdown, regular: safeNum(e.target.value)})} 
                                                                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold text-center outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] font-bold text-slate-400 block mb-1 uppercase">Disc 1</label>
                                                            <input type="number" min="0" value={seatBreakdown.disc1} onChange={(e) => setSeatBreakdown({...seatBreakdown, disc1: safeNum(e.target.value)})} 
                                                                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold text-center outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] font-bold text-slate-400 block mb-1 uppercase">Disc 2</label>
                                                            <input type="number" min="0" value={seatBreakdown.disc2} onChange={(e) => setSeatBreakdown({...seatBreakdown, disc2: safeNum(e.target.value)})} 
                                                                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold text-center outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end gap-2 mt-4">
                                                        <button onClick={() => setEditingGuest(null)} className="px-3 py-2 text-slate-500 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 text-xs font-bold">
                                                            Cancel
                                                        </button>
                                                        <button 
                                                            disabled={!isValid}
                                                            onClick={() => saveSeatBreakdown(guest.seatCount)} 
                                                            className={`px-4 py-2 text-white rounded-lg flex items-center gap-1 text-xs font-bold shadow-sm transition-all ${isValid ? 'bg-violet-600 hover:bg-violet-700' : 'bg-slate-300 cursor-not-allowed'}`}
                                                        >
                                                            <Check size={14} /> Update Breakdown
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
