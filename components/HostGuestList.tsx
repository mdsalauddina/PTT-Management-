import React, { useState, useEffect } from 'react';
import { CommonTabProps, Guest, PersonalData } from '../types';
import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ChevronDown, Users, Phone, Armchair, Building, User } from 'lucide-react';

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

  // Fetch all personal guests for this tour (consolidated)
  useEffect(() => {
      const fetchGuests = async () => {
          if (!activeTour) return;
          setLoading(true);
          try {
             // We need to fetch all personal records for this tourId
             // Since ID is `${tourId}_${userId}`, we can't easily query by ID prefix without a separate field.
             // We added `tourId` to PersonalData interface, so we should query by that field.
             const q = query(collection(db, 'personal'), where('tourId', '==', activeTour.id));
             const snapshot = await getDocs(q);
             const pGuests: Guest[] = [];
             
             snapshot.forEach(doc => {
                 const data = doc.data() as PersonalData;
                 if (data.guests) {
                     // Tag them as personal/admin guests
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

  // Combine Guests
  const agencyGuests = activeTour.partnerAgencies?.flatMap(agency => 
      (agency.guests || []).map(g => ({
          ...g, 
          agencyName: agency.name,
          type: 'agency'
      }))
  ) || [];

  const allGuests = [...personalGuests, ...agencyGuests];

  // Helper to safely display collection amount
  const getCollection = (g: any) => {
      // Host sees collection amount to verify payment status if needed, 
      // or simply as info. Requirement said: "collection fee show korbe"
      return Number(g.collection) || 0;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-24 max-w-4xl mx-auto font-sans">
      {/* Selector */}
      <div className="bg-white p-2 rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-100 flex items-center gap-4 relative z-20">
        <div className="p-3 bg-teal-50 rounded-2xl text-teal-600 ring-4 ring-teal-50/50">
            <Users size={20} />
        </div>
        <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">গেস্ট লিস্ট (হোস্ট ভিউ)</label>
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

      {/* Guest Table/List */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
              <h3 className="font-bold text-slate-700 text-xs uppercase tracking-widest flex items-center gap-2">
                  সর্বমোট গেস্ট: {allGuests.reduce((sum, g) => sum + (Number(g.seatCount)||1), 0)}
              </h3>
          </div>
          
          {loading ? (
              <div className="p-10 text-center text-slate-400 text-xs font-bold animate-pulse">লোড হচ্ছে...</div>
          ) : allGuests.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-xs font-bold italic">কোনো গেস্ট পাওয়া যায়নি</div>
          ) : (
              <div className="divide-y divide-slate-100">
                  {allGuests.map((guest, idx) => (
                      <div key={`${guest.id}_${idx}`} className="p-5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold shrink-0 mt-1 sm:mt-0">
                                  {idx + 1}
                              </div>
                              <div>
                                  <h4 className="font-bold text-slate-800 text-sm">{guest.name}</h4>
                                  <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                                          <Phone size={10}/> {guest.phone || 'N/A'}
                                      </span>
                                      {(guest as any).type === 'agency' ? (
                                          <span className="text-[10px] text-violet-600 bg-violet-50 font-bold px-2 py-0.5 rounded flex items-center gap-1">
                                              <Building size={10}/> {(guest as any).agencyName}
                                          </span>
                                      ) : (
                                          <span className="text-[10px] text-indigo-600 bg-indigo-50 font-bold px-2 py-0.5 rounded flex items-center gap-1">
                                              <User size={10}/> পার্সোনাল
                                          </span>
                                      )}
                                  </div>
                              </div>
                          </div>
                          
                          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end ml-11 sm:ml-0">
                                <div className="text-right">
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">সিট</p>
                                    <div className="flex items-center gap-1 justify-end">
                                        <Armchair size={12} className="text-slate-400"/>
                                        <span className="font-bold text-slate-700 text-xs">{guest.seatNumbers || 'Not Assigned'} ({guest.seatCount})</span>
                                    </div>
                                </div>
                                <div className="text-right pl-4 border-l border-slate-100">
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">কালেকশন</p>
                                    <p className="font-mono font-black text-emerald-600 text-sm">৳{getCollection(guest)}</p>
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