import React, { useState, useEffect } from 'react';
import { CommonTabProps, Guest, PersonalData } from '../types';
import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ChevronDown, Users, Phone, Armchair, Building, User, Wallet } from 'lucide-react';

const HostGuestList: React.FC<CommonTabProps> = ({ user, tours }) => {
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  const [personalGuests, setPersonalGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(false);

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
             const pGuests: Guest[] = [];
             
             snapshot.forEach(doc => {
                 const data = doc.data() as PersonalData;
                 if (data.guests) {
                     const taggedGuests = data.guests.map(g => ({...g, type: 'personal'})); 
                     pGuests.push(...taggedGuests);
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
  }, [activeTour]);

  if (!activeTour) return (
      <div className="h-full flex flex-col items-center justify-center p-10 text-center text-slate-400">
        <Users size={32} className="mb-2 opacity-50"/>
        <p className="font-bold text-xs">কোন ট্যুর ডাটা পাওয়া যায়নি</p>
      </div>
  );

  const agencyGuests = activeTour.partnerAgencies?.flatMap(agency => 
      (agency.guests || []).map(g => ({
          ...g, 
          agencyName: agency.name,
          type: 'agency'
      }))
  ) || [];

  const allGuests = [...personalGuests, ...agencyGuests];

  return (
    <div className="space-y-4 animate-fade-in font-sans">
      {/* Selector */}
      <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 relative z-20">
        <div className="p-2 bg-teal-50 rounded-xl text-teal-600">
            <Users size={18} />
        </div>
        <div className="flex-1 min-w-0">
            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 truncate">গেস্ট লিস্ট (হোস্ট ভিউ)</label>
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

      {/* Guest List Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-700 text-[10px] uppercase tracking-widest flex items-center gap-2">
                 মোট গেস্ট: {allGuests.reduce((sum, g) => sum + (Number(g.seatCount)||1), 0)}
              </h3>
          </div>
          
          {loading ? (
              <div className="p-8 text-center text-slate-400 text-xs font-bold animate-pulse">লোড হচ্ছে...</div>
          ) : allGuests.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-bold italic">কোনো গেস্ট পাওয়া যায়নি</div>
          ) : (
              <div className="divide-y divide-slate-50">
                  {allGuests.map((guest, idx) => (
                      <div key={`${guest.id}_${idx}`} className="p-4 hover:bg-slate-50/50 transition-colors">
                          <div className="flex justify-between items-start gap-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] font-bold shrink-0 mt-0.5">
                                      {idx + 1}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                      <h4 className="font-bold text-slate-800 text-sm truncate leading-tight mb-1">{guest.name}</h4>
                                      <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="text-[9px] text-slate-500 font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 flex items-center gap-1 truncate max-w-full">
                                              <Phone size={9}/> {guest.phone || 'N/A'}
                                          </span>
                                          {(guest as any).type === 'agency' ? (
                                              <span className="text-[9px] text-violet-600 bg-violet-50 font-bold px-1.5 py-0.5 rounded border border-violet-100 flex items-center gap-1 truncate max-w-full">
                                                  <Building size={9}/> {(guest as any).agencyName}
                                              </span>
                                          ) : (
                                              <span className="text-[9px] text-indigo-600 bg-indigo-50 font-bold px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-1 truncate">
                                                  <User size={9}/> পার্সোনাল
                                              </span>
                                          )}
                                      </div>
                                  </div>
                              </div>
                          </div>
                          
                          <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-50/50">
                                <div className="flex-1 bg-slate-50 rounded-lg p-2 border border-slate-100">
                                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">সিট</p>
                                    <div className="flex items-center gap-1">
                                        <Armchair size={10} className="text-slate-400"/>
                                        <span className="font-bold text-slate-700 text-[10px] break-all">
                                            {guest.seatNumbers || 'N/A'} <span className="text-slate-400">({guest.seatCount})</span>
                                        </span>
                                    </div>
                                </div>
                                <div className="flex-1 bg-emerald-50 rounded-lg p-2 border border-emerald-100">
                                    <p className="text-[8px] text-emerald-400 font-bold uppercase tracking-wider mb-0.5">কালেকশন</p>
                                    <div className="flex items-center gap-1">
                                        <Wallet size={10} className="text-emerald-400"/>
                                        <span className="font-mono font-black text-emerald-600 text-[10px]">৳{Number(guest.collection || 0)}</span>
                                    </div>
                                </div>
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </div>
    </div>
  );
};

export default HostGuestList;