
import React, { useState, useEffect } from 'react';
import { CommonTabProps, PersonalData, SettlementStatus } from '../types';
import { db } from '../services/firebase';
import { doc, collection, query, where, getDocs, updateDoc, Timestamp } from 'firebase/firestore';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';
import { TrendingUp, Activity, Wallet, Building, Coffee, Car, Utensils, Users, ChevronDown, AlertCircle, Bus, Tags, PlusCircle, TrendingDown, CheckCircle, XCircle, Clock, Heart, BarChart3 } from 'lucide-react';
import { calculateTotalOtherFixedCosts, safeNum, calculateBuyRates } from '../utils/calculations';

const AnalysisTab: React.FC<CommonTabProps> = ({ tours, user, refreshTours }) => {
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  const [personalGuestCount, setPersonalGuestCount] = useState<number>(0);
  const [personalCollection, setPersonalCollection] = useState<number>(0);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  // Store Guests locally for accurate Couple Calc in Analysis
  const [allGuestsReceivedStats, setAllGuestsReceivedStats] = useState({ totalReceived: 0, regularRec: 0, coupleRec: 0 });

  // New state for Host Settlement
  const [hostCollection, setHostCollection] = useState<number>(0);

  useEffect(() => {
    if (tours.length > 0 && !selectedTourId) {
        setSelectedTourId(tours[0].id);
    }
  }, [tours, selectedTourId]);

  const activeTour = tours.find(t => t.id === selectedTourId) || null;

  useEffect(() => {
    if (!activeTour) return;

    const fetchAllData = async () => {
        try {
            // 1. Fetch Personal Data
            let pGuestsCount = 0;
            let pCollection = 0;
            let pReceivedTotal = 0;
            let pReceivedCouple = 0;
            let pReceivedRegular = 0;
            let pHostCashInHand = 0;

            const pQuery = query(collection(db, 'personal'), where('tourId', '==', activeTour.id));
            const pDocs = await getDocs(pQuery);
            
            pDocs.forEach(doc => {
                 const data = doc.data() as PersonalData;
                 const bookingFee = safeNum(data.bookingFee);
                 
                 // Calc Collection & Guests
                 if (data.guests && data.guests.length > 0) {
                     data.guests.forEach(g => {
                         const seats = Number(g.seatCount) || 1;
                         pGuestsCount += seats;
                         
                         // If received, add to collection for Host Settlement View
                         if (g.isReceived) {
                            const collected = safeNum(g.collection);
                            const totalBill = safeNum(g.totalBillAmount);
                            // If collection is 0 but confirmed received, assume full bill was collected (Due Taka)
                            const cash = collected > 0 ? collected : totalBill;
                            
                            pCollection += cash;
                            pHostCashInHand += cash;

                            pReceivedTotal += seats;
                            if (g.isCouple) pReceivedCouple += seats;
                            else pReceivedRegular += seats;
                         } else {
                             const penalty = safeNum(activeTour.penaltyAmount) || 500;
                             pCollection += (seats * penalty);
                             pHostCashInHand += (seats * penalty); // Penalty collected by Host
                         }
                     });
                 } else {
                     // Legacy
                     const reg = safeNum(data.personalStandardCount);
                     const d1 = safeNum(data.personalDisc1Count);
                     const d2 = safeNum(data.personalDisc2Count);
                     pGuestsCount += (reg + d1 + d2);
                     pReceivedTotal += (reg + d1 + d2);
                     pReceivedRegular += (reg + d1 + d2);

                     const regFee = Number(activeTour.fees?.regular) || 0;
                     const d1Fee = Number(activeTour.fees?.disc1) || 0;
                     const d2Fee = Number(activeTour.fees?.disc2) || 0;
                     
                     const amount = (reg * regFee) + (d1 * d1Fee) + (d2 * d2Fee);
                     pCollection += amount;
                     pHostCashInHand += amount;
                 }
                 pCollection += bookingFee;
                 pHostCashInHand += bookingFee;
            });
            
            setPersonalGuestCount(pGuestsCount);
            setPersonalCollection(pCollection);

            // 2. Fetch Agency Data (Already in activeTour)
            let aReceivedTotal = 0;
            let aReceivedCouple = 0;
            let aReceivedRegular = 0;
            let aHostCashInHand = 0;
            
            if (activeTour.partnerAgencies) {
                activeTour.partnerAgencies.forEach(ag => {
                    if (ag.guests) {
                        ag.guests.forEach(g => {
                            const seats = Number(g.seatCount) || 1;
                            if (g.isReceived) {
                                const collected = safeNum(g.collection);
                                const totalBill = safeNum(g.totalBillAmount);
                                // Fallback: If 0, use Total Bill
                                const cash = collected > 0 ? collected : totalBill;
                                
                                aHostCashInHand += cash;
                                aReceivedTotal += seats;
                                if (g.isCouple) aReceivedCouple += seats;
                                else aReceivedRegular += seats;
                            } else {
                                const penalty = safeNum(activeTour.penaltyAmount) || 500;
                                aHostCashInHand += (seats * penalty);
                            }
                        });
                    }
                });
            }
            
            setHostCollection(pHostCashInHand + aHostCashInHand); 
            
            setAllGuestsReceivedStats({
                totalReceived: pReceivedTotal + aReceivedTotal,
                regularRec: pReceivedRegular + aReceivedRegular,
                coupleRec: pReceivedCouple + aReceivedCouple
            });

        } catch (e) {
            console.error(e);
        }
    };
    
    fetchAllData();
  }, [activeTour, user]);

  const updateHostSettlementStatus = async (status: SettlementStatus) => {
      if (!activeTour) return;
      if (status === 'paid' && !window.confirm(`Payment Complete?`)) return;
      if (status === 'settled' && !window.confirm(`Accept payment?`)) return;

      setIsUpdatingStatus(true);
      try {
          const tourRef = doc(db, 'tours', activeTour.id);
          await updateDoc(tourRef, { 
              hostSettlementStatus: status,
              updatedAt: Timestamp.now()
          });
          await refreshTours();
      } catch (e) {
          console.error("Error updating status", e);
          alert("Failed to update status");
      } finally {
          setIsUpdatingStatus(false);
      }
  };

  if (!activeTour) return (
      <div className="h-full flex flex-col items-center justify-center p-10 text-center text-slate-400">
         <BarChart3 size={32} className="mb-2 opacity-50"/>
         <p className="font-bold text-xs">কোন ট্যুর ডাটা পাওয়া যায়নি</p>
      </div>
  );
  
  if (!activeTour.busConfig || !activeTour.costs) return <div className="p-6 text-center text-rose-500 bg-rose-50 rounded-2xl border border-rose-100 text-xs font-bold">Incomplete Config</div>;

  // --- CALCULATIONS ---
  const agencyGuests = activeTour.partnerAgencies 
    ? activeTour.partnerAgencies.reduce((sum, a) => sum + (a.guests?.reduce((gSum, g) => gSum + (Number(g.seatCount)||1), 0) || 0), 0) 
    : 0;

  const totalBooked = agencyGuests + personalGuestCount;
  const totalSeats = safeNum(activeTour.busConfig.regularSeats) + safeNum(activeTour.busConfig.discount1Seats) + safeNum(activeTour.busConfig.discount2Seats) || 40;
  
  const occupancyRate = totalSeats > 0 ? Math.min((totalBooked / totalSeats) * 100, 100) : 0;
  const vacantSeats = Math.max(0, totalSeats - totalBooked);

  // Note: agencyCollection calculated above is for Host Settlement view (Received + Penalty).
  // This 'totalIncome' is specifically for Profit/Loss chart (usually considers full collection)
  // But for accurate Host Settlement, we use 'hostCollection' state.
  
  // Expenses Breakdown
  const totalBusRent = Number(activeTour.busConfig.totalRent || 0);
  const totalHostFee = Number(activeTour.costs.hostFee || 0);
  const totalHotelCost = Number(activeTour.costs.hotelCost || 0); // Regular
  const totalCoupleHotelCost = Number(activeTour.costs.coupleHotelCost || 0); // Couple
  
  const totalOtherFixed = calculateTotalOtherFixedCosts(activeTour);
  
  const totalDailyMeals = activeTour.costs?.dailyExpenses 
    ? activeTour.costs.dailyExpenses.reduce((sum, day) => sum + Number(day.breakfast||0) + Number(day.lunch||0) + Number(day.dinner||0), 0)
    : 0;
  
  const totalDailyTransport = activeTour.costs?.dailyExpenses 
    ? activeTour.costs.dailyExpenses.reduce((sum, day) => sum + Number(day.transport||0), 0)
    : 0;

  const totalDailyExtra = activeTour.costs?.dailyExpenses 
    ? activeTour.costs.dailyExpenses.reduce((sum, day) => sum + Number(day.other||0), 0)
    : 0;

  const totalExpenses = totalBusRent + totalHostFee + totalHotelCost + totalCoupleHotelCost + totalOtherFixed + totalDailyMeals + totalDailyTransport + totalDailyExtra;
  // This 'netProfit' is for the graph, using personalCollection (derived) + some agency estimation
  // For the graph we use hostCollection as a proxy for total income
  const netProfit = hostCollection - totalExpenses;

  // Host Settlement Balance
  const hostBusShare = Math.max(0, totalBusRent - safeNum(activeTour.busConfig?.adminPaidRent));
  const hostSpending = (totalDailyMeals + totalDailyTransport + totalDailyExtra) + totalOtherFixed + hostBusShare;
  
  const hostSettlementBalance = hostCollection - hostSpending;
  const hostStatus = activeTour.hostSettlementStatus || 'unpaid';
  const isAdminPayer = hostSettlementBalance < 0;

  // Per Head Logic:
  const costPerSeat = calculateBuyRates(activeTour);
  const variableDivisor = costPerSeat.variableDivisor;
  const regularDivisor = costPerSeat.partialRecRegular > 0 ? costPerSeat.partialRecRegular : 1;
  const coupleUnitDivisor = costPerSeat.coupleUnitDivisor; // Number of couples (pairs)

  const calcPerHeadVariable = (amount: number) => Math.ceil(amount / variableDivisor);
  const busPerRegular = Math.ceil(costPerSeat.regularBus || 0);

  const financialData = [
    { name: 'ব্যয়', amount: totalExpenses, fill: '#ef4444' },
    { name: 'আয়', amount: hostCollection, fill: '#10b981' },
  ];

  return (
    <div className="space-y-4 animate-fade-in pb-20 max-w-5xl mx-auto font-sans text-slate-800">
      
      {/* Selector */}
      <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 relative z-20">
        <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
            <BarChart3 size={18} />
        </div>
        <div className="flex-1 min-w-0">
            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 truncate">এনালাইসিস রিপোর্ট</label>
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
      
      {/* Host Settlement Card */}
      <div className={`p-5 rounded-2xl border shadow-sm flex flex-col gap-4 ${hostSettlementBalance >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
           <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${hostSettlementBalance >= 0 ? 'bg-blue-200/50 text-blue-700' : 'bg-orange-200/50 text-orange-700'}`}>
                      {hostSettlementBalance >= 0 ? <TrendingUp size={24}/> : <TrendingDown size={24}/>}
                  </div>
                  <div>
                      <div className="flex items-center gap-2">
                          <h3 className={`font-black uppercase text-sm tracking-wide ${hostSettlementBalance >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>হোস্ট সেটেলমেন্ট</h3>
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 mt-1">
                          কালেকশন (Due Taka): ৳{hostCollection.toLocaleString()} - খরচ: ৳{hostSpending.toLocaleString()}
                      </p>
                  </div>
              </div>
              <div className="text-right">
                  <p className={`text-3xl font-black ${hostSettlementBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                      {Math.abs(hostSettlementBalance).toLocaleString()} ৳
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                      {hostSettlementBalance >= 0 ? 'অ্যাডমিন পাবে' : 'হোস্ট পাবে'}
                  </p>
              </div>
          </div>
          {/* ... Buttons ... */}
          {user.role === 'admin' && (
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200/50">
                   {!isAdminPayer && (
                      hostStatus === 'paid' ? (
                        <>
                            <button disabled={isUpdatingStatus} onClick={() => updateHostSettlementStatus('unpaid')} className="px-3 py-2 bg-white text-rose-600 text-[10px] font-bold uppercase tracking-wider rounded-xl shadow-sm border border-rose-100 hover:bg-rose-50 flex items-center gap-1.5"><XCircle size={14} /> Decline</button>
                            <button disabled={isUpdatingStatus} onClick={() => updateHostSettlementStatus('settled')} className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 flex items-center gap-1.5"><CheckCircle size={14} /> Accept</button>
                        </>
                      ) : (hostStatus !== 'settled' && <span className="text-xs font-bold text-slate-400 italic">হোস্ট পেমেন্টের অপেক্ষায়...</span>)
                  )}
                  {isAdminPayer && (
                      hostStatus === 'paid' ? (
                          <div className="px-3 py-2 bg-amber-50 text-amber-600 text-[10px] font-bold uppercase tracking-wider rounded-xl border border-amber-100 flex items-center gap-1.5"><Clock size={14} /> হোস্ট কনফার্মেশনের অপেক্ষায়</div>
                      ) : hostStatus === 'settled' ? (<button onClick={() => updateHostSettlementStatus('unpaid')} className="text-[10px] text-slate-400 underline">Reopen</button>) : (
                          <button disabled={isUpdatingStatus} onClick={() => updateHostSettlementStatus('paid')} className="px-4 py-2 bg-white text-slate-900 text-[10px] font-bold uppercase tracking-wider rounded-xl shadow-md border border-slate-100 hover:bg-slate-50 flex items-center gap-1.5"><CheckCircle size={14} /> পেমেন্ট কমপ্লিট করুন</button>
                      )
                  )}
                  {hostStatus === 'settled' && !isAdminPayer && (<button onClick={() => updateHostSettlementStatus('unpaid')} className="text-[10px] text-slate-400 underline">Reopen</button>)}
              </div>
          )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Detailed Cost Breakdown Table */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
             <div className="px-5 py-3 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                 <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                     <Activity size={14} className="text-slate-400"/> খরচের ব্রেকডাউন (Based on {variableDivisor} Total Received)
                 </h3>
             </div>
             
             <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse min-w-[300px]">
                    <thead>
                        <tr className="border-b border-slate-100">
                            <th className="p-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider">খাত</th>
                            <th className="p-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right">মোট</th>
                            <th className="p-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right bg-slate-50/50">জনপ্রতি / ইউনিট</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs font-bold text-slate-600">
                        {/* Bus Rent */}
                        <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 flex items-center gap-2 whitespace-nowrap"><div className="w-1.5 h-1.5 rounded-full bg-violet-600"></div>বাস ভাড়া (Base)</td>
                            <td className="p-3 text-right font-mono text-slate-700">৳{totalBusRent.toLocaleString()}</td>
                            <td className="p-3 text-right font-mono text-slate-500 bg-slate-50/30">৳{busPerRegular} <span className="text-[8px] opacity-50 block sm:inline sm:ml-1 font-sans">(÷{variableDivisor})</span></td>
                        </tr>

                        {/* Hotel Regular */}
                         <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 flex items-center gap-2 whitespace-nowrap"><div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>হোটেল (Regular)</td>
                            <td className="p-3 text-right font-mono text-slate-700">৳{totalHotelCost.toLocaleString()}</td>
                            <td className="p-3 text-right font-mono text-slate-500 bg-slate-50/30">৳{Math.ceil(totalHotelCost / regularDivisor)} <span className="text-[8px] opacity-50 block sm:inline sm:ml-1 font-sans">(÷{regularDivisor} Persons)</span></td>
                        </tr>

                        {/* Hotel Couple */}
                        {totalCoupleHotelCost > 0 && (
                             <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors bg-pink-50/20">
                                <td className="p-3 flex items-center gap-2 whitespace-nowrap"><div className="w-1.5 h-1.5 rounded-full bg-pink-600"></div>হোটেল (Couple)</td>
                                <td className="p-3 text-right font-mono text-slate-700">৳{totalCoupleHotelCost.toLocaleString()}</td>
                                <td className="p-3 text-right font-mono text-slate-500 bg-slate-50/30">
                                    ৳{Math.ceil(totalCoupleHotelCost / coupleUnitDivisor)} 
                                    <span className="text-[8px] opacity-50 block sm:inline sm:ml-1 font-sans">
                                        (÷{coupleUnitDivisor} Pairs)
                                    </span>
                                </td>
                            </tr>
                        )}

                        {/* Variable Costs */}
                        {[
                            { label: 'খাবার', total: totalDailyMeals, icon: Utensils, color: 'text-orange-600' },
                            { label: 'লোকাল গাড়ি', total: totalDailyTransport, icon: Car, color: 'text-blue-600' },
                            { label: 'হোস্ট খরচ', total: totalHostFee, icon: Users, color: 'text-teal-600' },
                            { label: 'অন্যান্য ফিক্সড', total: totalOtherFixed, icon: PlusCircle, color: 'text-teal-500' },
                            { label: 'দৈনিক অন্যান্য', total: totalDailyExtra, icon: Coffee, color: 'text-slate-600' },
                        ].map((item, i) => (
                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                <td className="p-3 flex items-center gap-2 whitespace-nowrap"><div className={`w-1.5 h-1.5 rounded-full ${item.color.replace('text', 'bg')}`}></div>{item.label}</td>
                                <td className="p-3 text-right font-mono text-slate-700">৳{item.total.toLocaleString()}</td>
                                <td className="p-3 text-right font-mono text-slate-500 bg-slate-50/30">৳{calcPerHeadVariable(item.total)} <span className="text-[8px] opacity-50 block sm:inline sm:ml-1 font-sans">(÷{variableDivisor})</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
          </div>

          {/* Right: Summary & Chart (existing) */}
          <div className="space-y-4">
               {/* Net Profit */}
               <div className={`rounded-2xl p-5 border shadow-sm relative overflow-hidden flex flex-col justify-between h-28 ${netProfit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                   <div>
                       <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>নেট প্রফিট / লস</p>
                       <h2 className={`text-3xl font-black tracking-tight ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                           {netProfit >= 0 ? '+' : ''}{netProfit.toLocaleString()}<span className="text-sm opacity-70 ml-1">৳</span>
                       </h2>
                   </div>
               </div>
               {/* Chart */}
               <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm h-48">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 text-center">আয় বনাম ব্যয়</p>
                    <ResponsiveContainer width="100%" height="80%">
                        <BarChart data={financialData} margin={{top: 5, right: 0, left: 0, bottom: 0}}>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} dy={5}/>
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold'}} />
                            <Bar dataKey="amount" radius={[6, 6, 6, 6]} barSize={40}>
                                {financialData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
               </div>
          </div>
      </div>
      
      {/* COST PER SEAT TYPE BREAKDOWN */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-5">
          <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2 mb-4">
              <Tags size={14} className="text-slate-400"/> সিট টাইপ অনুযায়ী আসল খরচ (Buy Rate)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {/* Regular */}
              <div className="bg-violet-50 p-4 rounded-xl border border-violet-100 text-center relative overflow-hidden">
                  <p className="text-[9px] font-bold text-violet-400 uppercase mb-1">রেগুলার সিট</p>
                  <p className="text-xl font-black text-violet-700 mb-2">৳{costPerSeat.regular}</p>
                  <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[9px] font-bold bg-white/60 px-2 py-1.5 rounded-lg border border-violet-100/50">
                          <span className="text-violet-400">বাস ভাড়া</span>
                          <span className="text-violet-600">৳{costPerSeat.regularBus}</span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] font-bold bg-white/60 px-2 py-1.5 rounded-lg border border-violet-100/50">
                          <span className="text-violet-400">অন্যান্য</span>
                          <span className="text-violet-600">৳{costPerSeat.commonVariable}</span>
                      </div>
                  </div>
              </div>

              {/* D1 */}
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-center relative overflow-hidden">
                  <p className="text-[9px] font-bold text-amber-500 uppercase mb-1">ডিসকাউন্ট ১</p>
                  <p className="text-xl font-black text-amber-600 mb-2">৳{costPerSeat.d1}</p>
                  <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[9px] font-bold bg-white/60 px-2 py-1.5 rounded-lg border border-amber-100/50"><span className="text-amber-500/70">বাস ভাড়া</span><span className="text-amber-600">৳{costPerSeat.d1Bus}</span></div>
                      <div className="flex justify-between items-center text-[9px] font-bold bg-white/60 px-2 py-1.5 rounded-lg border border-amber-100/50"><span className="text-amber-500/70">অন্যান্য</span><span className="text-amber-600">৳{costPerSeat.commonVariable}</span></div>
                  </div>
              </div>

              {/* D2 */}
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-center relative overflow-hidden">
                  <p className="text-[9px] font-bold text-orange-500 uppercase mb-1">ডিসকাউন্ট ২</p>
                  <p className="text-xl font-black text-orange-600 mb-2">৳{costPerSeat.d2}</p>
                  <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[9px] font-bold bg-white/60 px-2 py-1.5 rounded-lg border border-orange-100/50"><span className="text-orange-500/70">বাস ভাড়া</span><span className="text-orange-600">৳{costPerSeat.d2Bus}</span></div>
                      <div className="flex justify-between items-center text-[9px] font-bold bg-white/60 px-2 py-1.5 rounded-lg border border-orange-100/50"><span className="text-orange-500/70">অন্যান্য</span><span className="text-orange-600">৳{costPerSeat.commonVariable}</span></div>
                  </div>
              </div>
              
              {/* Couple Package Rate (Per Pair) */}
              {costPerSeat.couplePackageRate > 0 && (
                  <div className="bg-pink-50 p-4 rounded-xl border border-pink-100 text-center relative overflow-hidden">
                      <p className="text-[9px] font-bold text-pink-500 uppercase mb-1">কাপল প্যাকেজ (২ জন)</p>
                      <p className="text-xl font-black text-pink-600 mb-2">৳{costPerSeat.couplePackageRate}</p>
                      <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-center text-[9px] font-bold bg-white/60 px-2 py-1.5 rounded-lg border border-pink-100/50">
                              <span className="text-pink-400">বাস+ভেরিয়েবল (x2)</span>
                              <span className="text-pink-600">৳{(costPerSeat.regularBus + costPerSeat.commonVariable) * 2}</span>
                          </div>
                          <div className="flex justify-between items-center text-[9px] font-bold bg-white/60 px-2 py-1.5 rounded-lg border border-pink-100/50">
                              <span className="text-pink-400">কাপল রুম (x1)</span>
                              <span className="text-pink-600">৳{Math.ceil(totalCoupleHotelCost / coupleUnitDivisor)}</span>
                          </div>
                      </div>
                  </div>
              )}
          </div>
          <p className="text-[9px] text-slate-400 mt-3 text-center leading-relaxed">
              * খরচ = (বাস ভাড়া + ডিসকাউন্ট গ্যাপ) ÷ উপস্থিত গেস্ট + (অন্যান্য খরচ ÷ উপস্থিত গেস্ট) + (হোটেল খরচ)
          </p>
      </div>

    </div>
  );
};

export default AnalysisTab;
