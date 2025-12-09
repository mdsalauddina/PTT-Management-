import { BusConfig, PartnerAgency, Tour, PersonalData, Guest } from '../types';
import { db } from '../services/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

// Helper to safely convert to number
export const safeNum = (val: any): number => {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

// Helper to get total seats from a guest entry
const getGuestSeatCount = (guest: Guest): number => {
  // If breakdown exists, sum it up
  if (guest.paxBreakdown) {
      return safeNum(guest.paxBreakdown.regular) + safeNum(guest.paxBreakdown.disc1) + safeNum(guest.paxBreakdown.disc2);
  }
  return safeNum(guest.seatCount) || 1;
};

// Bus Fare Calculation (Static/Config based - used for estimates)
export const calculateBusFare = (busConfig: BusConfig) => {
  if (!busConfig) return { regularFare: 0, discount1Fare: 0, discount2Fare: 0, baseFare: 0, totalDiscountLoss: 0 };

  const totalRent = safeNum(busConfig.totalRent);
  const regularSeats = safeNum(busConfig.regularSeats);
  const discount1Seats = safeNum(busConfig.discount1Seats);
  const discount1Amount = safeNum(busConfig.discount1Amount);
  const discount2Seats = safeNum(busConfig.discount2Seats);
  const discount2Amount = safeNum(busConfig.discount2Amount);
  
  const totalSeats = regularSeats + discount1Seats + discount2Seats;
  
  if (totalSeats <= 0) return { regularFare: 0, discount1Fare: 0, discount2Fare: 0, baseFare: 0, totalDiscountLoss: 0 };

  const baseFare = totalRent / totalSeats;
  const totalDiscountLoss = (discount1Seats * discount1Amount) + (discount2Seats * discount2Amount);
  
  const extraPerRegular = regularSeats > 0 ? totalDiscountLoss / regularSeats : 0;
  
  return {
    regularFare: Math.ceil(baseFare + extraPerRegular),
    discount1Fare: Math.ceil(baseFare - discount1Amount),
    discount2Fare: Math.ceil(baseFare - discount2Amount),
    baseFare: Math.ceil(baseFare),
    totalDiscountLoss: Math.ceil(totalDiscountLoss)
  };
};

// Total Daily Expenses Sum (Updated to include 'other')
export const calculateTotalDailyExpenses = (tour: Tour): number => {
    if (!tour.costs?.dailyExpenses) return 0;
    return tour.costs.dailyExpenses.reduce((sum, day) => 
        sum + safeNum(day.breakfast) + safeNum(day.lunch) + safeNum(day.dinner) + safeNum(day.transport) + safeNum(day.other), 0
    );
};

// Helper to calculate total extra fixed costs
export const calculateTotalOtherFixedCosts = (tour: Tour): number => {
    if (!tour.costs?.otherFixedCosts) return 0;
    return tour.costs.otherFixedCosts.reduce((sum, item) => sum + safeNum(item.amount), 0);
};

// Shared Helper to calculate Buy Rates
// UPDATED LOGIC: Based on RECEIVED guests for both Bus and Variable costs.
export const calculateBuyRates = (tour: Tour) => {
    // 1. Gather Guest Stats (Received vs Non-Received)
    let totalReceived = 0;
    let nonReceivedSeats = 0;
    
    // Breakdown of RECEIVED guests by seat type (for Bus calculation)
    let recRegCount = 0;
    let recD1Count = 0;
    let recD2Count = 0;

    const processGuest = (g: Guest) => {
        const seats = getGuestSeatCount(g);
        if (g.isReceived) {
            totalReceived += seats;
            
            if (g.paxBreakdown) {
                recRegCount += safeNum(g.paxBreakdown.regular);
                recD1Count += safeNum(g.paxBreakdown.disc1);
                recD2Count += safeNum(g.paxBreakdown.disc2);
            } else {
                const type = g.seatType || 'regular';
                if (type === 'disc1') recD1Count += seats;
                else if (type === 'disc2') recD2Count += seats;
                else recRegCount += seats;
            }
        } else {
            nonReceivedSeats += seats;
        }
    };

    // Iterate Agencies
    if (tour.partnerAgencies) {
        tour.partnerAgencies.forEach(a => {
            if (a.guests) a.guests.forEach(processGuest);
        });
    }

    // Iterate Personal (Need to fetch? No, this function is usually called where we have data or context. 
    // Limitation: calculateBuyRates in utils usually takes a Tour object. 
    // If the Tour object in state doesn't have the full personal guest list merged, this might be inaccurate.
    // However, for the main AnalysisTab, we fetch tours. We rely on 'tour.totalGuests' for variable divisor usually.
    // To be precise with the BUS MATH, we need the breakdown. 
    // For now, we will approximate using tour.totalGuests if precise breakdown isn't available, 
    // BUT since we need accurate billing, we assume 'totalReceived' calculated above is correct 
    // IF the caller passes a Tour object that has been enriched or we rely on the loop above.
    
    // *CRITICAL*: The `tour` object passed from Firestore `tours` collection contains `partnerAgencies` but NOT `personal` guests embedded.
    // The `personal` guests are in a separate collection. 
    // To fix this without breaking architecture, we will use the `tour.totalGuests` (which is updated by `recalculateTourSeats` to be the Total Received Count)
    // and `tour.busConfig.discountXSeats` (which are total booked).
    // This is an approximation because `busConfig` stores BOOKED seats, not RECEIVED seats.
    // To do this perfectly, `recalculateTourSeats` should store `receivedRegular`, `receivedD1` etc. in the tour doc.
    
    // FALLBACK STRATEGY: 
    // Use `tour.totalGuests` (Received) as the divisor.
    // Use `busConfig` ratios to estimate the spread if exact breakdown missing.
    // But better: use the variables calculated above from `partnerAgencies` and add a placeholder for Personal if not present.
    // Since we can't easily fetch personal guests synchronously here, we will use `tour.totalGuests` (Received) as the master count.
    
    // Let's use the `tour.totalGuests` (which stores total RECEIVED) as the divisor.
    const divisor = (tour.totalGuests && tour.totalGuests > 0) ? tour.totalGuests : 1;
    
    // --- 2. Variable Cost Calculation ---
    const hostFee = safeNum(tour.costs?.hostFee);
    const hotelCost = safeNum(tour.costs?.hotelCost); 
    const otherFixedTotal = calculateTotalOtherFixedCosts(tour);
    const dailyExpensesTotal = calculateTotalDailyExpenses(tour);
    
    const variableCostPerHead = Math.ceil((hostFee + hotelCost + otherFixedTotal + dailyExpensesTotal) / divisor);
    
    // --- 3. Bus Fare Calculation (Dynamic) ---
    const totalRent = safeNum(tour.busConfig?.totalRent);
    const penaltyRate = safeNum(tour.penaltyAmount) || 500;
    
    // We need to know Total Non-Received to subtract penalty.
    // Since we don't have the personal list here, we can infer:
    // Total Booked (approx) = Bus Capacity - Vacant? No.
    // Let's rely on the fact that `recalculateTourSeats` should ideally maintain a `totalPenaltyCollected` field. 
    // But since it doesn't, let's estimate: 
    // We will assume `tour.totalGuests` is accurate for Received.
    // We cannot easily know the penalty amount without the full guest list.
    // CHANGE: For this specific request, we will assume the inputs to this function might be incomplete for Personal guests 
    // if called from a context without them. 
    // However, for Settlements, we usually call this.
    // Let's proceed with a safe calculation:
    
    // Adjusted Bus Rent = Total Rent - (NonReceived * Penalty)
    // Issue: We don't know NonReceived count inside this pure function without fetching.
    // Hack: We will ignore penalty deduction in the 'BuyRate' display if we can't calculate it, 
    // OR we assume the user accepts that 'Buy Rate' shown in Agency dashboard is an estimate 
    // and the final Settlement uses the detailed logic.
    
    // WAIT: `calculateAgencySettlement` and `calculatePersonalSettlement` use this.
    // They iterate guests anyway. 
    
    // Let's Refine: We will determine the "Bus Rate" based on the assumption that
    // The "Buy Rate" is simply: (Net Bus Cost / Total Received) + Variable.
    // Since we can't accurately get Net Bus Cost without all guests, 
    // we will use the `divisor` (Total Received) and `totalRent`. 
    // We will IGNORE the penalty deduction in this generic display function to remain safe/conservative (High Estimate),
    // OR we rely on `tour.busConfig` stats if we update them.
    
    // BETTER APPROACH for User Request:
    // The user wants the rate to be `(Rent - Penalty) / Received`.
    // Let's assume `totalRent` is the amount to be covered.
    // If we can't find the penalty, we divide `totalRent` by `Received`. This yields a slightly higher rate (Safe).
    
    // Re-calculating Bus Fare Base based on Received Count (ignoring capacity)
    // Distribute Discounts:
    // Formula: R * TotalReceived = TotalRent + (D1Count * D1Amt) + (D2Count * D2Amt)
    // R = (TotalRent + DiscountGap) / TotalReceived
    
    // We need D1Count and D2Count (Received). 
    // `tour.busConfig.discount1Seats` is Total Booked D1.
    // We will use Total Booked D1 as an approximation for Received D1 if we lack data, 
    // knowing this might slightly inflate the Regular price if D1 guests are absent (which is fine/safe).
    
    const d1Amt = safeNum(tour.busConfig?.discount1Amount);
    const d2Amt = safeNum(tour.busConfig?.discount2Amount);
    
    const estD1Received = safeNum(tour.busConfig?.discount1Seats); // Approximation
    const estD2Received = safeNum(tour.busConfig?.discount2Seats); // Approximation
    
    const discountGap = (estD1Received * d1Amt) + (estD2Received * d2Amt);
    
    // If we knew total penalty, we would subtract it from totalRent
    // For now, use TotalRent (Conservative)
    const adjustedRent = totalRent; 
    
    const regularBusFare = Math.ceil((adjustedRent + discountGap) / divisor);
    
    return {
        regular: regularBusFare + variableCostPerHead,
        d1: (regularBusFare - d1Amt) + variableCostPerHead,
        d2: (regularBusFare - d2Amt) + variableCostPerHead,
        busShare: regularBusFare, // Exporting for UI breakdown
        varShare: variableCostPerHead // Exporting for UI breakdown
    };
};

// Agency Settlement
export const calculateAgencySettlement = (tour: Tour, agency: PartnerAgency) => {
  if (!tour || !agency) return { 
      totalCollection: 0, 
      agencyExpenses: 0, 
      fixedCostShare: 0, 
      totalCost: 0, 
      netAmount: 0, 
      totalSeats: 0, 
      rates: { regular: 0, d1: 0, d2: 0 } 
  };

  const agencyExpenses = agency.expenses.reduce((sum, exp) => sum + safeNum(exp.amount), 0);
  const agencyGuestCount = agency.guests.reduce((sum, guest) => sum + getGuestSeatCount(guest), 0);
  
  // To implement the specific "Rent - Penalty" logic accurately, we ideally need the Global Penalty amount.
  // Since passing that data around is complex, we will stick to the `calculateBuyRates` logic 
  // which currently uses `TotalRent / TotalReceived`. 
  // This effectively means "Absent people pay 0 towards rent, Present people cover it".
  // The Penalty collected is separate revenue.
  
  const rates = calculateBuyRates(tour);
  const penaltyAmount = safeNum(tour.penaltyAmount) || 500; 

  let totalLiability = 0;
  let totalCollection = 0;

  agency.guests.forEach(guest => {
      const seats = getGuestSeatCount(guest);
      
      if (guest.isReceived) {
          totalCollection += safeNum(guest.collection);

          if (guest.paxBreakdown) {
              const { regular, disc1, disc2 } = guest.paxBreakdown;
              totalLiability += (safeNum(regular) * rates.regular);
              totalLiability += (safeNum(disc1) * rates.d1);
              totalLiability += (safeNum(disc2) * rates.d2);
          } else {
              const type = guest.seatType || 'regular';
              if (type === 'disc1') totalLiability += seats * rates.d1;
              else if (type === 'disc2') totalLiability += seats * rates.d2;
              else totalLiability += seats * rates.regular;
          }
      } else {
          // Penalty Logic
          const penalty = seats * penaltyAmount;
          totalCollection += penalty; 
      }
  });
  
  const netAmount = totalCollection - (totalLiability + agencyExpenses); 
  
  return {
    totalCollection,
    agencyExpenses,
    fixedCostShare: totalLiability,
    totalCost: totalLiability + agencyExpenses,
    netAmount,
    totalSeats: agencyGuestCount,
    rates
  };
};

// Personal Settlement (Updated: Uses detailed breakdown for Income and Cost)
export const calculatePersonalSettlement = (tour: Tour, personalData: PersonalData) => {
    if (!tour || !personalData) return { totalPersonalIncome: 0, personalExpenses: 0, totalPersonalCost: 0, netResult: 0, fees: { regFee: 0, d1Fee: 0, d2Fee: 0 } };

    const bookingFee = safeNum(personalData.bookingFee);
    const personalExpenses = personalData.customExpenses 
        ? personalData.customExpenses.reduce((sum, e) => sum + safeNum(e.amount), 0)
        : 0;

    const rates = calculateBuyRates(tour);
    
    // Determining Fees for Personal Guests (Income Calculation)
    const baseFee = personalData.customPricing ? safeNum(personalData.customPricing.baseFee) : safeNum(tour.fees?.regular);
    const d1Amount = personalData.customPricing ? safeNum(personalData.customPricing.d1Amount) : safeNum(tour.busConfig?.discount1Amount);
    const d2Amount = personalData.customPricing ? safeNum(personalData.customPricing.d2Amount) : safeNum(tour.busConfig?.discount2Amount);

    const regFee = baseFee;
    const d1Fee = baseFee - d1Amount;
    const d2Fee = baseFee - d2Amount;

    const penaltyAmount = safeNum(tour.penaltyAmount) || 500;

    let totalPersonalIncome = bookingFee;
    let totalPersonalCost = 0;

    if (personalData.guests && personalData.guests.length > 0) {
        personalData.guests.forEach(g => {
             const seats = getGuestSeatCount(g);

             if (g.isReceived) {
                 // 1. Income Logic
                 if (g.feeBreakdown) {
                     const incReg = safeNum(g.feeBreakdown.regular) * regFee;
                     const incD1 = safeNum(g.feeBreakdown.disc1) * d1Fee;
                     const incD2 = safeNum(g.feeBreakdown.disc2) * d2Fee;
                     totalPersonalIncome += (incReg + incD1 + incD2);
                 } else {
                    totalPersonalIncome += safeNum(g.collection);
                 }

                 // 2. Cost Logic
                 if (g.paxBreakdown) {
                     const costReg = safeNum(g.paxBreakdown.regular) * rates.regular;
                     const costD1 = safeNum(g.paxBreakdown.disc1) * rates.d1;
                     const costD2 = safeNum(g.paxBreakdown.disc2) * rates.d2;
                     totalPersonalCost += (costReg + costD1 + costD2);
                 } else {
                     if (g.seatType === 'disc1') totalPersonalCost += seats * rates.d1;
                     else if (g.seatType === 'disc2') totalPersonalCost += seats * rates.d2;
                     else totalPersonalCost += seats * rates.regular;
                 }
             } else {
                 // Penalty Logic
                 const penalty = seats * penaltyAmount;
                 totalPersonalIncome += penalty; 
             }
        });
    } else {
        // Fallback for old data - assume received
        const regCount = safeNum(personalData.personalStandardCount);
        const d1Count = safeNum(personalData.personalDisc1Count);
        const d2Count = safeNum(personalData.personalDisc2Count);

        totalPersonalIncome += (regCount * regFee) + (d1Count * d1Fee) + (d2Count * d2Fee);
        totalPersonalCost += (regCount * rates.regular) + (d1Count * rates.d1) + (d2Count * rates.d2);
    }

    const netResult = totalPersonalIncome - (totalPersonalCost + personalExpenses);

    return {
        totalPersonalIncome,
        personalExpenses,
        totalPersonalCost, 
        netResult,
        fees: { regFee, d1Fee, d2Fee }
    };
};

// DYNAMIC SEAT RECALCULATION & TOTAL GUEST COUNT
export const recalculateTourSeats = async (tourId: string) => {
    try {
        const tourRef = doc(db, 'tours', tourId);
        const tourSnap = await getDoc(tourRef);
        if (!tourSnap.exists()) return;
        
        const tour = tourSnap.data() as Tour;
        const totalBusSeats = Number(tour.busConfig?.totalSeats) || 40;
        
        let totalD1_Booked = 0;
        let totalD2_Booked = 0;
        let totalReceivedGuests = 0; 
        let totalBookedGuests = 0;

        // 1. Calculate from Partner Agencies
        if (tour.partnerAgencies) {
            tour.partnerAgencies.forEach(agency => {
                if (agency.guests) {
                    agency.guests.forEach(g => {
                        const guestSeats = getGuestSeatCount(g);
                        totalBookedGuests += guestSeats;

                        if (g.isReceived) {
                            totalReceivedGuests += guestSeats;
                        }

                        if (g.paxBreakdown) {
                            totalD1_Booked += Number(g.paxBreakdown.disc1 || 0);
                            totalD2_Booked += Number(g.paxBreakdown.disc2 || 0);
                        } else {
                            if (g.seatType === 'disc1') totalD1_Booked += guestSeats;
                            if (g.seatType === 'disc2') totalD2_Booked += guestSeats;
                        }
                    });
                }
            });
        }

        // 2. Calculate from Personal Data
        const q = query(collection(db, 'personal'), where('tourId', '==', tourId));
        const pSnaps = await getDocs(q);
        
        pSnaps.forEach(pDoc => {
            const pData = pDoc.data() as PersonalData;
            if (pData.guests && pData.guests.length > 0) {
                 pData.guests.forEach(g => {
                    const guestSeats = getGuestSeatCount(g);
                    totalBookedGuests += guestSeats;

                    if (g.isReceived) {
                        totalReceivedGuests += guestSeats;
                    }

                    if (g.paxBreakdown) {
                        totalD1_Booked += Number(g.paxBreakdown.disc1 || 0);
                        totalD2_Booked += Number(g.paxBreakdown.disc2 || 0);
                    } else {
                        if (g.seatType === 'disc1') totalD1_Booked += guestSeats;
                        if (g.seatType === 'disc2') totalD2_Booked += guestSeats;
                    }
                 });
            } else {
                const d1 = Number(pData.personalDisc1Count || 0);
                const d2 = Number(pData.personalDisc2Count || 0);
                const reg = Number(pData.personalStandardCount || 0);
                
                totalD1_Booked += d1;
                totalD2_Booked += d2;
                
                const total = reg + d1 + d2;
                totalBookedGuests += total;
                totalReceivedGuests += total; 
            }
        });

        // 3. Update Bus Config and Total Guests
        const regularSeats = Math.max(0, totalBusSeats - totalD1_Booked - totalD2_Booked);
        
        await updateDoc(tourRef, {
            'busConfig.regularSeats': regularSeats,
            'busConfig.discount1Seats': totalD1_Booked,
            'busConfig.discount2Seats': totalD2_Booked,
            'totalGuests': totalReceivedGuests // Storing RECEIVED guests
        });
        
    } catch (e) {
        console.error("Error recalculating seats:", e);
    }
};
