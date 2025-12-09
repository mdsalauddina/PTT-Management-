
import React, { useState, useEffect } from 'react';
import { CommonTabProps, Guest, PersonalData, PartnerAgency } from '../types';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { ChevronDown, Users, Phone, Armchair, Building, User, Wallet, MessageCircle, Check, X, MapPin, Calendar, CheckCircle, Info, XCircle } from 'lucide-react';
import { recalculateTourSeats } from '../utils/calculations';

const HostGuestList: React.FC<CommonTabProps> = ({ user, tours, refreshTours }) => {
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  const [personalGuests, setPersonalGuests] = useState<{guest: Guest, docId: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Modal State
  const [selectedGuestModal, setSelectedGuestModal] = useState<{
      guest: Guest, 
      tourName: string, 
      tourDate: string,
      isAgency: boolean,
      agencyName?: string
  } | null>(null);

  useEffect(() => {
    if (tours.length > 0 && !selectedTourId) {
        setSelectedTourId(tours[0].id);
    }
  }, [tours, selectedTourId]);

  const activeTour = tours.find(t => t.id === selectedTourId) || null;

  useEffect(() => {
      const fetchGuests = async () => {
          if (!activeTour) return;
          setLoading(true);
          try {
             const q = query(collection(db, 'personal'), where('tourId', '==', activeTour.id));
             const snapshot = await getDocs(q);
             const pGuests: {guest: Guest, docId: string}[] = [];
             
             snapshot.forEach(doc => {
                 const data = doc.data() as PersonalData;
                 if (data.guests) {
                     data.guests.forEach(g => {
                         pGuests.push({
                             guest: {...g, type: 'personal'} as any,
                             docId: doc.id
                         });
                     });
                 }
             });
             setPersonalGuests(pGuests);
          } catch (e) {
              console.error("Error fetching personal guests for host", e);
          } finally {
              setLoading(false);
          }
      };
      
      fetchGuests();
  }, [activeTour, processingId]); // Reload when processing done

  const toggleGuestStatus = async (e: React.MouseEvent, guestId: string, docId: string, isAgency: boolean, currentStatus: boolean) => {
      e.stopPropagation(); // Prevent modal open
      if (!activeTour) return;
      setProcessingId(guestId);

      try {
          if (isAgency) {
              // Update Agency Guest
              const agencies = [...(activeTour.partnerAgencies || [])];
              let found = false;
              
              const updatedAgencies = agencies.map(agency => {
                  if (found) return agency;
                  const guestIndex = agency.guests.findIndex(g => g.id === guestId);
                  if (guestIndex !== -1) {
                      agency.guests[guestIndex].isReceived = !currentStatus;
                      found = true;
                  }
                  return agency;
              });

              if (found) {
                  const tourRef = doc(db, 'tours', activeTour.id);
                  await updateDoc(tourRef, { partnerAgencies: updatedAgencies, updatedAt: Timestamp.now() });
              }

          } else {
              // Update Personal Guest
              const personalRef = doc(db, 'personal', docId);
              const snap = await getDoc(personalRef);
              if (snap.exists()) {
                  const data = snap.data() as PersonalData;
                  if (data.guests) {
                      const updatedGuests = data.guests.map(g => 
                          g.id === guestId ? { ...g, isReceived: !currentStatus } : g
                      );
                      await updateDoc(personalRef, { guests: updatedGuests, updatedAt: Timestamp.now() });
                  }
              }
          }
          
          await recalculateTourSeats(activeTour.id);
          await refreshTours(); // Refresh parent state
          
      } catch (e) {
          console.error("Error toggling status", e);
          alert("Error updating status");
      } finally {
          setProcessingId(null);
      }
  };

  const getWhatsAppLink = (phone: string) => {
      let p = phone.replace(/[^0-9]/g, '');
      if (p.startsWith('01')) p = '88' + p;
      return `https://wa.me/${p}`;
  };

  if (!activeTour) return (
      <div className="h-full flex flex-col items-center justify-center p-10 text-center text-slate-400">
        <Users size={32} className="mb-2 opacity-50"/>
        <p className="font-bold text-xs">কোন ট্যুর ডাটা পাওয়া যায়নি</p>
      </div>
  );

  const agencyGuests = activeTour.partnerAgencies?.flatMap(agency => 
      (agency.guests || []).map(g => ({
          guest: { ...g, agencyName: agency.name, type: 'agency' } as any,
          docId: agency.id // Using agency ID here, but update logic handles it via tour doc
      }))
  ) || [];

  const allGuests = [...personalGuests, ...agencyGuests];
  
  // Calculate received stats
  const totalGuests = allGuests.reduce((sum, item) => sum + (Number(item.guest.seatCount)||1), 0);
  const receivedGuests = allGuests.reduce((sum, item) => item.guest.isReceived ? sum + (Number(item.guest.seatCount)||1) : sum, 0);

  return (
    <div className="space-y-4 animate-fade-in font-sans pb-24">
      {/* Selector */}
      <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 relative z-20">
        <div className="p-2 bg-teal-50 rounded-xl text-teal-600">
            <Users size={18} />
        </div>
        <div className="flex-1 min-w-0">
            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 truncate">গেস্ট লিস্ট</label>
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

      {/* Stats Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="flex gap-4">
                  <h3 className="font-bold text-slate-500 text-[10px] uppercase tracking-widest">
                     মোট: <span className="text-slate-800 text-xs">{totalGuests}</span>
                  </h3>
                  <h3 className="font-bold text-emerald-600 text-[10px] uppercase tracking-widest">
                     রিসিভড: <span className="text-emerald-700 text-xs">{receivedGuests}</span>
                  </h3>
              </div>
          </div>
          
          {loading ? (
              <div className="p-8 text-center text-slate-400 text-xs font-bold animate-pulse">লোড হচ্ছে...</div>
          ) : allGuests.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-bold italic">কোনো গেস্ট পাওয়া যায়নি</div>
          ) : (
              <div className="divide-y divide-slate-50">
                  {allGuests.map(({guest, docId}, idx) => {
                      const isReceived = guest.isReceived || false;
                      const isProcessing = processingId === guest.id;
                      const isAgency = guest.type === 'agency';
                      const collectionAmount = isReceived ? Number(guest.collection || 0) : (Number(guest.seatCount || 1) * 500);

                      return (
                      <div 
                        key={`${guest.id}_${idx}`} 
                        className={`p-4 transition-colors cursor-pointer active:bg-slate-100 ${isReceived ? 'bg-white' : 'bg-slate-50/30'}`}
                        onClick={() => setSelectedGuestModal({
                            guest, 
                            tourName: activeTour.name, 
                            tourDate: activeTour.date, 
                            isAgency,
                            agencyName: isAgency ? guest.agencyName : undefined
                        })}
                      >
                          <div className="flex justify-between items-start gap-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 transition-colors ${isReceived ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                                      {idx + 1}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                      <h4 className="font-bold text-slate-800 text-sm truncate leading-tight mb-1">{guest.name}</h4>
                                      <div className="flex flex-wrap items-center gap-1.5">
                                          {guest.phone ? (
                                              <div className="flex flex-wrap items-center gap-2 mt-1 mb-2">
                                                   <span className="text-[10px] font-bold text-slate-500">{guest.phone}</span>
                                                   <div className="flex gap-1.5">
                                                      <a href={`tel:${guest.phone}`} onClick={e => e.stopPropagation()} className="text-[10px] text-white font-bold bg-indigo-500 px-2 py-1 rounded-lg shadow-sm shadow-indigo-200 hover:bg-indigo-600 transition-all flex items-center gap-1">
                                                          <Phone size={10}/> কল
                                                      </a>
                                                      <a href={getWhatsAppLink(guest.phone)} onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" className="text-[10px] text-white font-bold bg-green-500 px-2 py-1 rounded-lg shadow-sm shadow-green-200 hover:bg-green-600 transition-all flex items-center gap-1">
                                                          <MessageCircle size={10}/> WA
                                                      </a>
                                                   </div>
                                              </div>
                                          ) : (
                                              <span className="text-[9px] text-slate-400 font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 flex items-center gap-1 truncate max-w-full">
                                                  <Phone size={9}/> N/A
                                              </span>
                                          )}
                                          
                                          {isAgency ? (
                                              <span className="text-[9px] text-violet-600 bg-violet-50 font-bold px-1.5 py-0.5 rounded border border-violet-100 flex items-center gap-1 truncate max-w-full">
                                                  <Building size={9}/> {guest.agencyName}
                                              </span>
                                          ) : (
                                              <span className="text-[9px] text-indigo-600 bg-indigo-50 font-bold px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-1 truncate">
                                                  <User size={9}/> পার্সোনাল
                                              </span>
                                          )}
                                      </div>
                                  </div>
                              </div>

                              {/* TOGGLE SWITCH */}
                              <button 
                                disabled={isProcessing}
                                onClick={(e) => toggleGuestStatus(e, guest.id, docId, isAgency, isReceived)}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[10px] font-bold shadow-sm transition-all active:scale-95 ${
                                    isReceived 
                                    ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600' 
                                    : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                {isProcessing ? '...' : isReceived ? <><Check size={12}/> Received</> : 'Pending'}
                              </button>
                          </div>
                          
                          <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-50/50">
                                <div className="flex-1 bg-slate-50 rounded-lg p-2 border border-slate-100">
                                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">সিট</p>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1">
                                            <Armchair size={10} className="text-slate-400"/>
                                            <span className="font-bold text-slate-700 text-[10px] break-all">
                                                {guest.seatNumbers || 'N/A'} <span className="text-slate-400">({guest.seatCount})</span>
                                            </span>
                                        </div>
                                        {guest.address && (
                                            <div className="flex items-center gap-1">
                                                <MapPin size={10} className="text-slate-400"/>
                                                <span className="font-bold text-slate-500 text-[9px] truncate">{guest.address}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className={`flex-1 rounded-lg p-2 border transition-colors ${isReceived ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                                    <p className={`text-[8px] font-bold uppercase tracking-wider mb-0.5 ${isReceived ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {isReceived ? 'কালেকশন' : 'জরিমানা (Penalty)'}
                                    </p>
                                    <div className="flex items-center gap-1">
                                        <Wallet size={10} className={isReceived ? "text-emerald-400" : "text-rose-400"}/>
                                        <span className={`font-mono font-black text-[10px] ${isReceived ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            ৳{collectionAmount.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                          </div>
                      </div>
                  )})}
              </div>
          )}
      </div>

      {/* GUEST DETAIL MODAL */}
      {selectedGuestModal && (
            <div 
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" 
                onClick={() => setSelectedGuestModal(null)}
            >
                <div 
                    className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden relative" 
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 transform rotate-12"><Users size={100}/></div>
                        <h3 className="text-xl font-black tracking-tight relative z-10 leading-tight">{selectedGuestModal.guest.name}</h3>
                        <div className="flex items-center gap-2 mt-2 relative z-10 opacity-80 text-xs font-bold">
                            {selectedGuestModal.isAgency ? <Building size={14}/> : <User size={14}/>}
                            {selectedGuestModal.isAgency ? selectedGuestModal.agencyName : 'পার্সোনাল বুকিং'}
                        </div>
                        <button onClick={() => setSelectedGuestModal(null)} className="absolute top-4 right-4 bg-white/10 p-2 rounded-full text-white hover:bg-white/20 transition-colors z-20 backdrop-blur-sm">
                            <X size={16}/>
                        </button>
                    </div>
                    
                    <div className="p-6 space-y-5">
                        {/* Event Info */}
                        <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div className="bg-white p-3 rounded-xl border border-slate-100 text-violet-600 shadow-sm">
                                <Calendar size={20}/>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ইভেন্ট ডিটেইলস</p>
                                <p className="text-sm font-black text-slate-800 leading-tight">{selectedGuestModal.tourName}</p>
                                <p className="text-xs font-bold text-slate-500 mt-0.5">{selectedGuestModal.tourDate}</p>
                            </div>
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">ফোন নম্বর</p>
                                <p className="text-xs font-black text-slate-700">{selectedGuestModal.guest.phone || 'N/A'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">ঠিকানা</p>
                                <p className="text-xs font-black text-slate-700 truncate">{selectedGuestModal.guest.address || 'N/A'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">সিট সংখ্যা</p>
                                <p className="text-xs font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded w-fit">{selectedGuestModal.guest.seatCount}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">সিট নম্বর</p>
                                <p className="text-xs font-black text-violet-600 bg-violet-50 px-2 py-0.5 rounded w-fit">{selectedGuestModal.guest.seatNumbers || 'N/A'}</p>
                            </div>
                        </div>

                        {/* Financials */}
                        <div className="border-t border-slate-100 pt-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center">
                                    <p className="text-[9px] font-bold text-emerald-500 uppercase mb-1 tracking-wider">জমা দিয়েছে (Paid)</p>
                                    <p className="text-xl font-black text-emerald-700">
                                        ৳{selectedGuestModal.guest.isReceived ? Number(selectedGuestModal.guest.collection).toLocaleString() : 0}
                                    </p>
                                </div>
                                <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 text-center">
                                    <p className="text-[9px] font-bold text-rose-500 uppercase mb-1 tracking-wider">বাকি আছে (Due)</p>
                                    <p className="text-xl font-black text-rose-700">
                                        ৳{selectedGuestModal.guest.isReceived ? 0 : Number(selectedGuestModal.guest.collection).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            
                            {/* Status Footer */}
                            <div className="mt-4 flex justify-center">
                                {selectedGuestModal.guest.isReceived ? (
                                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                                        <CheckCircle size={12}/> পেমেন্ট রিসিভ করা হয়েছে
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-rose-500 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100">
                                        <Info size={12}/> পেমেন্ট পেন্ডিং (এখনো রিসিভ হয়নি)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
      )}
    </div>
  );
};

export default HostGuestList;