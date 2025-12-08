

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

// Bus Fare Calculation (Always based on Capacity/Total Seats)
export const calculateBusFare = (busConfig: BusConfig) => {
  if (!busConfig) return { regularFare: 0, discount1Fare: 0, discount2Fare: 0, baseFare: 0, totalDiscountLoss: 0 };

  const totalRent = safeNum(busConfig.totalRent);
  const regularSeats = safeNum(busConfig.regularSeats);
  const discount1Seats = safeNum(busConfig.discount1Seats);
  const discount1Amount = safeNum(busConfig.discount1Amount);
  const discount2Seats = safeNum(busConfig.discount2Seats);
  const discount2Amount = safeNum(busConfig.discount2Amount);
  
  // Requirement: Tour bus seat calculation = regular + discounts
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
// Variable Costs are now divided by TOTAL GUESTS (if > 0), not Total Seats.
// Bus Fare remains divided by Total Seats (handled in calculateBusFare).
export const calculateBuyRates = (tour: Tour) => {
    const totalBusSeats = (safeNum(tour.busConfig?.regularSeats) + safeNum(tour.busConfig?.discount1Seats) + safeNum(tour.busConfig?.discount2Seats)) || 1;
    
    // Divisor for Variable Costs: Use Total Guests if available, else Fallback to Seats
    // IMPORTANT: 'totalGuests' now represents only RECEIVED guests.
    const variableCostDivisor = (tour.totalGuests && tour.totalGuests > 0) ? tour.totalGuests : totalBusSeats;

    const hostFee = safeNum(tour.costs?.hostFee);
    const hotelCost = safeNum(tour.costs?.hotelCost); 
    const otherFixedTotal = calculateTotalOtherFixedCosts(tour);
    const dailyExpensesTotal = calculateTotalDailyExpenses(tour);
    
    // Variable Cost Per Head (based on Guest Count)
    const variableCostPerHead = (hostFee + hotelCost + otherFixedTotal + dailyExpensesTotal) / variableCostDivisor;
    
    // Bus Cost Per Head (based on Bus Capacity/Config)
    const busFares = calculateBusFare(tour.busConfig);

    return {
        regular: Math.ceil(busFares.regularFare + variableCostPerHead),
        d1: Math.ceil(busFares.discount1Fare + variableCostPerHead),
        d2: Math.ceil(busFares.discount2Fare + variableCostPerHead)
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
  
  const rates = calculateBuyRates(tour);

  let totalLiability = 0;
  let totalCollection = 0;

  agency.guests.forEach(guest => {
      const seats = getGuestSeatCount(guest);
      
      // LOGIC CHANGE: Check if Received
      if (guest.isReceived) {
          // If Received: Standard Collection and Liability
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
          // If NOT Received: Penalty Logic (500 Taka per seat)
          const penalty = seats * 500;
          totalCollection += penalty; 
          totalLiability += penalty; // Liability is just the fine they owe
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
                 // Penalty Logic for Personal Guests too
                 const penalty = seats * 500;
                 totalPersonalIncome += penalty; // We collected the fine
                 totalPersonalCost += penalty;   // It counts as a cost to balance or just revenue? 
                 // Actually for personal, if admin is handling, income is fine, cost is liability.
                 // Net Result = 0 for this guest. The 500 helps the main fund.
             }
        });
    } else {
        // Fallback counters (Assume received for legacy)
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
        
        // This tracks the number of guests PRESENT (Received) for variable cost calc
        let totalReceivedGuests = 0; 
        
        // Track bookings to calculate available bus seats (regardless of attendance)
        let totalBookedGuests = 0;

        // 1. Calculate from Partner Agencies
        if (tour.partnerAgencies) {
            tour.partnerAgencies.forEach(agency => {
                if (agency.guests) {
                    agency.guests.forEach(g => {
                        const guestSeats = getGuestSeatCount(g);
                        totalBookedGuests += guestSeats;

                        // Only count for Total Guests (Variable cost divisor) if RECEIVED
                        if (g.isReceived) {
                            totalReceivedGuests += guestSeats;
                        }

                        // Bus Seats are occupied regardless of attendance (unless deleted)
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

        // 2. Calculate from Personal Data (All users for this tour)
        const q = query(collection(db, 'personal'), where('tourId', '==', tourId));
        const pSnaps = await getDocs(q);
        
        pSnaps.forEach(pDoc => {
            const pData = pDoc.data() as PersonalData;
            if (pData.guests && pData.guests.length > 0) {
                 pData.guests.forEach(g => {
                    const guestSeats = getGuestSeatCount(g);
                    totalBookedGuests += guestSeats;

                    // Only count for Total Guests if RECEIVED
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
                // Fallback for old data - assume received
                const d1 = Number(pData.personalDisc1Count || 0);
                const d2 = Number(pData.personalDisc2Count || 0);
                const reg = Number(pData.personalStandardCount || 0);
                
                totalD1_Booked += d1;
                totalD2_Booked += d2;
                
                const total = reg + d1 + d2;
                totalBookedGuests += total;
                totalReceivedGuests += total; // Assume old data is received
            }
        });

        // 3. Update Bus Config and Total Guests
        // Regular seats available = Total Capacity - Booked Discounts
        const regularSeats = Math.max(0, totalBusSeats - totalD1_Booked - totalD2_Booked);
        
        await updateDoc(tourRef, {
            'busConfig.regularSeats': regularSeats,
            'busConfig.discount1Seats': totalD1_Booked,
            'busConfig.discount2Seats': totalD2_Booked,
            'totalGuests': totalReceivedGuests // Storing RECEIVED guests for cost calculation
        });
        
    } catch (e) {
        console.error("Error recalculating seats:", e);
    }
};