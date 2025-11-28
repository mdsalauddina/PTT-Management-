
import React, { useState, useEffect } from 'react';
import { CommonTabProps, PartnerAgency, Guest } from '../types';
import { db } from '../services/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { calculateAgencySettlement, safeNum } from '../utils/calculations';
import { Users, Phone, Plus, Trash, ChevronDown, ChevronUp, UserPlus, Briefcase, Calculator, Mail, Star, Edit3, X, Check } from 'lucide-react';

const ShareTourTab: React.FC<CommonTabProps> = ({ user, tours, refreshTours }) => {
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  const [showAddAgency, setShowAddAgency] = useState(false);
  const [newAgency, setNewAgency] = useState({ name: '', phone: '', email: '' });
  const [expandedAgency, setExpandedAgency] = useState<string | null>(null);

  const [newBooking, setNewBooking] = useState({ name: '', phone: '', seatCount: '', unitPrice: '' });
  const [isAddingBooking, setIsAddingBooking] = useState<string | null>(null);
  
  // State for granular seat editing
  const [editingGuest, setEditingGuest] = useState<{ agencyId: string, guestId: string } | null>(null);
  const [seatBreakdown, setSeatBreakdown] = useState({ regular: 0, disc1: 0, disc2: 0 });

  useEffect(() => {
    if (tours.length > 0 && !selectedTourId) {
        setSelectedTourId(tours[0].id);
    }
  }, [tours, selectedTourId]);

  // Derive activeTour directly from props to ensure we always have latest data
  const activeTour = tours.find(t => t.id === selectedTourId) || null;

  if (user.role !== 'admin') return <div className="h-full flex items-center justify-center text-rose-400 font-bold p-10 bg-rose-50 m-4 rounded-3xl border border-rose-100">শুধুমাত্র এডমিন এক্সেস</div>;
  
  if (!activeTour) return (
    <div className="h-full flex flex-col items-center justify-center p-10 text-center text-slate-400">
        <div className="bg-slate-100 p-6 rounded-full mb-4"><Users size={32} /></div>
        <p className="font-bold text-sm">কোন ট্যুর ডাটা পাওয়া যায়নি</p>
    </div>
  );

  const updateTourAgencies = async (agencies: PartnerAgency[]) => {
      if (!activeTour || !activeTour.id) {
          alert("Error: Active tour ID missing");
          return;
      }
      try {
          const tourRef = doc(db, 'tours', activeTour.id);
          // Recursively sanitize to ensure clean JS objects are sent
          const cleanAgencies = JSON.parse(JSON.stringify(agencies));

          await updateDoc(tourRef, { partnerAgencies: cleanAgencies, updatedAt: Timestamp.now() });
          await refreshTours();
      } catch (e) {
          console.error("Error updating tour agencies", e);
          alert("Error updating data. Please try again.");
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
    
    // Deep clone existing agencies
    const currentAgencies = activeTour.partnerAgencies ? [...activeTour.partnerAgencies] : [];
    const updatedAgencies = [...currentAgencies, agency];
    
    await updateTourAgencies(updatedAgencies);
    setNewAgency({ name: '', phone: '', email: '' });
    setShowAddAgency(false);
  };

  const addBookingToAgency = async (agencyId: string) => {
      if (!newBooking.name || !newBooking.seatCount) {
          alert("নাম এবং সিট সংখ্যা দিন");
          return;
      }

      const agencies = activeTour.partnerAgencies ? [...activeTour.partnerAgencies] : [];
      const agencyIndex = agencies.findIndex((a: PartnerAgency) => a.id === agencyId);
      if (agencyIndex === -1) return;

      const seatCount = parseInt(newBooking.seatCount) || 0;
      const unitPrice = parseInt(newBooking.unitPrice) || 0;

      // Ensure guests array exists and clone it
      const currentGuests = agencies[agencyIndex].guests ? [...agencies[agencyIndex].guests] : [];
      
      const newGuest: Guest = {
          id: `g_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Robust ID
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
      // Critical Stop Propagation
      if (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
      }

      if(!window.confirm("আপনি কি নিশ্চিত এই গেস্ট ডিলিট করতে চান?")) return;
      
      if (!activeTour.partnerAgencies) {
          console.error("No partner agencies data found");
          return;
      }

      // Robust Deep Copy Logic to avoid mutation issues
      const agencies = activeTour.partnerAgencies.map(a => ({
          ...a,
          guests: a.guests ? [...a.guests] : []
      }));

      const agIdx = agencies.findIndex((a: PartnerAgency) => a.id === agencyId);
      
      if (agIdx !== -1) {
          const initialLen = agencies[agIdx].guests.length;
          // Filter out the guest
          agencies[agIdx].guests = agencies[agIdx].guests.filter((g: Guest) => g.id !== guestId);
          
          if (agencies[agIdx].guests.length !== initialLen) {
              console.log(`Deleting guest ${guestId} from agency ${agencyId}`);
              await updateTourAgencies(agencies);
          } else {
             console.warn("Guest not found with ID", guestId);
             alert("Error: Guest not found or already deleted.");
          }
      } else {
          alert("Error: Agency not found.");
      }
  };

  // Setup editing state
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
    <div className="p-4 space-y-6 animate-fade-in pb-24 lg:pb-10 max-w-6xl mx-auto">
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

      <div className="flex justify-between items-center bg-white/80 backdrop-blur p-4 rounded-2xl shadow-sm border border-slate-100">
        <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Partner Management</p>
        </div>
        <button onClick={() => setShowAddAgency(true)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm flex items-center font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 uppercase tracking-wide">
            <Plus size={16} className="mr-2"/> যুক্ত করুন
        </button>
      </div>

      {showAddAgency && (
          <div className="bg-white p-6 rounded-[1.5rem] shadow-xl border border-blue-100 animate-fade-in mb-4 relative overflow-hidden max-w-lg mx-auto">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
              <h3 className="text-xs font-bold text-blue-600 mb-4 uppercase tracking-widest flex items-center gap-2">
                  <Briefcase size={14}/> নতুন এজেন্সির তথ্য
              </h3>
              <div className="space-y-4">
                  <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">এজেন্সির নাম</label>
                      <input placeholder="যেমন: স্কাই ট্রাভেলস" className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold" value={newAgency.name} onChange={e => setNewAgency({...newAgency, name: e.target.value})} />
                  </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">এজেন্সির ইমেইল (লগইন এর জন্য)</label>
                      <input type="email" placeholder="agent@gmail.com" className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold" value={newAgency.email} onChange={e => setNewAgency({...newAgency, email: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">মোবাইল নাম্বার</label>
                      <input placeholder="017..." className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold" value={newAgency.phone} onChange={e => setNewAgency({...newAgency, phone: e.target.value})} />
                  </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setShowAddAgency(false)} className="px-5 py-2.5 rounded-xl text-slate-500 text-xs hover:bg-slate-100 transition-colors font-bold uppercase tracking-wide">বাতিল</button>
                  <button onClick={handleAddAgency} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all uppercase tracking-wide">তৈরি করুন</button>
              </div>
          </div>
      )}

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {activeTour.partnerAgencies && activeTour.partnerAgencies.map(agency => {
            const settlement = calculateAgencySettlement(activeTour, agency);
            const isExpanded = expandedAgency === agency.id;
            
            return (
              <div key={agency.id} className={`bg-white rounded-[1.5rem] shadow-sm border overflow-hidden transition-all duration-300 flex flex-col ${isExpanded ? 'border-violet-200 ring-4 ring-violet-50 col-span-1 lg:col-span-2' : 'border-slate-100'}`}>
                  <div 
                    onClick={() => setExpandedAgency(isExpanded ? null : agency.id)}
                    className={`p-5 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50 border-b border-slate-100' : ''}`}
                  >
                      <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-violet-600 shadow-sm transition-colors ${isExpanded ? 'bg-white shadow-md' : 'bg-violet-50'}`}>
                              <Users size={20} />
                          </div>
                          <div>
                              <h3 className="font-bold text-slate-800 text-lg leading-tight">{agency.name}</h3>
                              <p className="text-[11px] text-slate-500 font-medium flex items-center mt-1"><Mail size={10} className="mr-1"/> {agency.email || 'No Email'}</p>
                          </div>
                      </div>
                      <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-[9px] text-slate-400 uppercase font-bold">নিট সেটেলমেন্ট</p>
                              <p className={`text-sm font-black ${settlement.netAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {settlement.netAmount >= 0 ? '+' : ''}{settlement.netAmount} ৳
                              </p>
                          </div>
                          {isExpanded ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                      </div>
                  </div>

                  {isExpanded && (
                    <div className="p-5 animate-fade-in">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                <p className="text-[9px] text-slate-400 font-bold uppercase">গেস্ট / সিট</p>
                                <p className="text-lg font-black text-slate-800">{settlement.totalSeats}</p>
                            </div>
                            <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 text-center">
                                <p className="text-[9px] text-orange-600 font-bold uppercase flex justify-center items-center gap-1">
                                    <Calculator size={10}/> Buy Rate (Regular)
                                </p>
                                <p className="text-lg font-black text-orange-700">৳{settlement.rates.regular.toLocaleString()}</p>
                            </div>
                            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-center">
                                <p className="text-[9px] text-emerald-600 font-bold uppercase">Host Collected (Due)</p>
                                <p className="text-lg font-black text-emerald-700">৳{settlement.totalCollection.toLocaleString()}</p>
                            </div>
                             <div className={`p-3 rounded-xl border text-center ${settlement.netAmount >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-rose-50 border-rose-100'}`}>
                                <p className={`text-[9px] font-bold uppercase ${settlement.netAmount >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                                    {settlement.netAmount >= 0 ? 'এজেন্সি পাবে' : 'এজেন্সি দিবে'}
                                </p>
                                <p className={`text-lg font-black ${settlement.netAmount >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>৳{Math.abs(settlement.netAmount).toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-violet-100 overflow-hidden">
                            <div className="bg-violet-50/50 p-4 border-b border-violet-100 flex justify-between items-center">
                                <h4 className="text-[10px] font-bold text-violet-700 uppercase tracking-widest">বুকিং তালিকা (Guest List)</h4>
                                <button onClick={() => setIsAddingBooking(agency.id)} className="text-violet-700 text-[10px] bg-white px-3 py-1.5 rounded-lg border border-violet-200 flex items-center font-bold hover:bg-violet-50 shadow-sm transition-all uppercase tracking-wide">
                                    <UserPlus size={12} className="mr-1.5" /> নতুন গেস্ট
                                </button>
                            </div>
                            
                            {isAddingBooking === agency.id && (
                                <div className="p-4 bg-violet-50 border-b border-violet-100 animate-fade-in">
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div className="col-span-2">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">গেস্টের নাম</label>
                                            <input className="w-full border border-slate-200 bg-white p-2.5 rounded-xl text-sm outline-none font-semibold" placeholder="নাম" value={newBooking.name} onChange={e => setNewBooking({...newBooking, name: e.target.value})} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">গেস্ট মোবাইল</label>
                                            <input className="w-full border border-slate-200 bg-white p-2.5 rounded-xl text-sm outline-none font-semibold" placeholder="017..." value={newBooking.phone} onChange={e => setNewBooking({...newBooking, phone: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">মোট সিট</label>
                                            <input type="number" className="w-full border border-slate-200 bg-white p-2.5 rounded-xl text-sm outline-none font-bold text-center" placeholder="0" value={newBooking.seatCount} onChange={e => setNewBooking({...newBooking, seatCount: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">জনপ্রতি কালেকশন (Due)</label>
                                            <input type="number" className="w-full border border-emerald-200 bg-emerald-50 p-2.5 rounded-xl text-sm outline-none font-bold text-center text-emerald-700" placeholder="0" value={newBooking.unitPrice} onChange={e => setNewBooking({...newBooking, unitPrice: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="text-xs font-bold text-slate-500">
                                            মোট কালেকশন (Due): <span className="text-violet-600">৳{((parseInt(newBooking.seatCount)||0) * (parseInt(newBooking.unitPrice)||0)).toLocaleString()}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setIsAddingBooking(null)} className="px-3 py-1.5 rounded-lg text-slate-400 text-xs font-bold hover:bg-slate-100">বাতিল</button>
                                            <button onClick={() => addBookingToAgency(agency.id)} className="bg-violet-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-md hover:bg-violet-700">সেভ করুন</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!agency.guests || agency.guests.length === 0 ? (
                                <p className="text-center text-xs text-slate-400 py-8 italic font-medium">এখনও কোন গেস্ট বুকিং নেই</p>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {agency.guests.map(guest => {
                                        const isEditing = editingGuest?.agencyId === agency.id && editingGuest?.guestId === guest.id;
                                        const breakdownSum = safeNum(seatBreakdown.regular) + safeNum(seatBreakdown.disc1) + safeNum(seatBreakdown.disc2);
                                        const isValid = breakdownSum === safeNum(guest.seatCount);

                                        return (
                                        <div key={guest.id} className="p-4 flex flex-col hover:bg-slate-50 transition-colors group">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
                                                <div className="flex-1">
                                                    <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                        {guest.name}
                                                        {/* Show badges for current breakdown if not editing */}
                                                        {!isEditing && guest.paxBreakdown ? (
                                                             <div className="flex gap-1 ml-2">
                                                                 {guest.paxBreakdown.regular > 0 && <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 rounded border border-slate-200">R: {guest.paxBreakdown.regular}</span>}
                                                                 {guest.paxBreakdown.disc1 > 0 && <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 rounded border border-amber-200">D1: {guest.paxBreakdown.disc1}</span>}
                                                                 {guest.paxBreakdown.disc2 > 0 && <span className="text-[9px] bg-orange-50 text-orange-600 px-1.5 rounded border border-orange-200">D2: {guest.paxBreakdown.disc2}</span>}
                                                             </div>
                                                        ) : (
                                                            !isEditing && guest.seatType && guest.seatType !== 'regular' && (
                                                                <span className="bg-amber-100 text-amber-700 text-[9px] px-1.5 py-0.5 rounded border border-amber-200 font-bold uppercase flex items-center gap-0.5">
                                                                    <Star size={8} fill="currentColor"/> {guest.seatType}
                                                                </span>
                                                            )
                                                        )}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold border border-slate-200 flex items-center gap-1"><Phone size={8}/> {guest.phone || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded font-bold border border-violet-100">{guest.seatCount || 1} সিট</span>
                                                        <span className="text-[10px] text-slate-400">× ৳{guest.unitPrice || 0} (Due/Head)</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                                                    <div className="text-right mr-2">
                                                        <p className="text-[9px] text-slate-400 font-bold">Total Due</p>
                                                        <p className="font-mono font-bold text-emerald-600">৳{guest.collection.toLocaleString()}</p>
                                                    </div>

                                                    {/* Edit Button */}
                                                    {!isEditing && (
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => startEditingSeats(e, agency.id, guest)}
                                                            className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                                                            title="Edit Seats"
                                                        >
                                                            <Edit3 size={14} />
                                                        </button>
                                                    )}
                                                    
                                                    {/* Delete Button */}
                                                    {!isEditing && (
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => deleteGuest(e, agency.id, guest.id)}
                                                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                            title="Delete Guest"
                                                        >
                                                            <Trash size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Granular Seat Editor */}
                                            {isEditing && (
                                                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl animate-fade-in">
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex justify-between">
                                                        <span>Seat Breakdown (Total: {guest.seatCount})</span>
                                                        <span className={isValid ? "text-emerald-500" : "text-rose-500"}>
                                                            Current: {breakdownSum}
                                                        </span>
                                                    </p>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div>
                                                            <label className="text-[9px] font-bold text-slate-400 block mb-1">Regular</label>
                                                            <input type="number" min="0" value={seatBreakdown.regular} onChange={(e) => setSeatBreakdown({...seatBreakdown, regular: safeNum(e.target.value)})} 
                                                                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold text-center outline-none focus:border-violet-400" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] font-bold text-slate-400 block mb-1">Disc 1</label>
                                                            <input type="number" min="0" value={seatBreakdown.disc1} onChange={(e) => setSeatBreakdown({...seatBreakdown, disc1: safeNum(e.target.value)})} 
                                                                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold text-center outline-none focus:border-violet-400" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] font-bold text-slate-400 block mb-1">Disc 2</label>
                                                            <input type="number" min="0" value={seatBreakdown.disc2} onChange={(e) => setSeatBreakdown({...seatBreakdown, disc2: safeNum(e.target.value)})} 
                                                                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold text-center outline-none focus:border-violet-400" />
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end gap-2 mt-3">
                                                        <button onClick={() => setEditingGuest(null)} className="p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-100">
                                                            <X size={14} />
                                                        </button>
                                                        <button 
                                                            disabled={!isValid}
                                                            onClick={() => saveSeatBreakdown(guest.seatCount)} 
                                                            className={`p-2 text-white rounded-lg flex items-center gap-1 text-xs font-bold shadow-sm ${isValid ? 'bg-violet-600 hover:bg-violet-700' : 'bg-slate-300 cursor-not-allowed'}`}
                                                        >
                                                            <Check size={14} /> Update
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
