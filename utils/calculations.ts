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
export const calculateBuyRates = (tour: Tour) => {
    // 1. Gather Guest Stats (Received vs Non-Received, Couple vs Regular)
    let totalReceived = 0;
    let recCoupleCount = 0; // Total seats occupied by couples
    let recRegularCount = 0; // Total seats occupied by regular/discount guests
    
    // Iterate Agencies to count
    if (tour.partnerAgencies) {
        tour.partnerAgencies.forEach(a => {
            if (a.guests) a.guests.forEach(g => {
                const seats = getGuestSeatCount(g);
                if (g.isReceived) {
                    totalReceived += seats;
                    if (g.isCouple) {
                        recCoupleCount += seats;
                    } else {
                        recRegularCount += seats;
                    }
                }
            });
        });
    }

    // Use stored total if available and reliable, otherwise use derived
    // 'tour.totalGuests' is updated by recalculateTourSeats to be the Received Count
    const storedTotal = tour.totalGuests || 0;
    const variableDivisor = (storedTotal > 0) ? storedTotal : (totalReceived > 0 ? totalReceived : 1);
    
    // Couple Unit Divisor (Pairs):
    // 2 seats = 1 Couple Unit
    const coupleUnitDivisor = recCoupleCount > 0 ? (recCoupleCount / 2) : 1;
    // Regular Divisor (Persons):
    const regularDivisor = recRegularCount > 0 ? recRegularCount : 1;

    // --- Variable Cost Calculation ---
    const hostFee = safeNum(tour.costs?.hostFee);
    const otherFixedTotal = calculateTotalOtherFixedCosts(tour);
    const dailyExpensesTotal = calculateTotalDailyExpenses(tour);
    
    // Common Variable (Food, Transport, Host, Other Fixed) -> Divided by TOTAL RECEIVED PERSONS
    const commonVariablePerHead = Math.ceil((hostFee + otherFixedTotal + dailyExpensesTotal) / variableDivisor);
    
    // Hotel Cost (Split)
    const totalHotelCost = safeNum(tour.costs?.hotelCost); // Regular
    const totalCoupleHotelCost = safeNum(tour.costs?.coupleHotelCost); // Couple
    
    // Bus Fare Logic (Total Rent - Penalty) / Total Received Persons
    const totalRent = safeNum(tour.busConfig?.totalRent);
    const penaltyAmount = safeNum(tour.penaltyAmount) || 500;
    
    // Calculate Penalty deduction (roughly)
    // Ideally we sum actual penalty collected from absent guests. 
    // Here we assume: Adjusted Bus Rent = Total Rent - (Penalty Collected)
    // For simplicity in this helper without full guest iteration again, we use Total Rent.
    // *Refinement*: AnalysisTab usually handles the gross/net logic. Here we need a Buy Rate.
    // We will use Total Rent. If penalty offsets rent, the profit margin increases in Analysis.
    const adjustedRent = totalRent;
    
    // Distribute Discounts Gap
    const d1Amt = safeNum(tour.busConfig?.discount1Amount);
    const d2Amt = safeNum(tour.busConfig?.discount2Amount);
    const estD1 = safeNum(tour.busConfig?.discount1Seats); 
    const estD2 = safeNum(tour.busConfig?.discount2Seats); 
    
    const discountGap = (estD1 * d1Amt) + (estD2 * d2Amt);
    const regularBusFare = Math.ceil((adjustedRent + discountGap) / variableDivisor);

    // Calculate Estimated Totals per Seat Type
    
    // Regular Hotel Per Head (Regular Guests only)
    const regHotelPerHead = Math.ceil(totalHotelCost / regularDivisor);
    
    // Couple Hotel Per Unit (Couple Pair)
    const coupleHotelPerUnit = Math.ceil(totalCoupleHotelCost / coupleUnitDivisor);

    // Total Buy Rates
    const regularRate = regularBusFare + commonVariablePerHead + regHotelPerHead;
    const d1Rate = (regularBusFare - d1Amt) + commonVariablePerHead + regHotelPerHead;
    const d2Rate = (regularBusFare - d2Amt) + commonVariablePerHead + regHotelPerHead;
    
    // Couple Package Rate (Per Pair)
    // 2 People Bus + 2 People Variable + 1 Couple Hotel Unit
    const couplePackageRate = (regularBusFare * 2) + (commonVariablePerHead * 2) + coupleHotelPerUnit;

    // Rates Output
    return {
        regularBus: regularBusFare, 
        d1Bus: regularBusFare - d1Amt,
        d2Bus: regularBusFare - d2Amt,
        commonVariable: commonVariablePerHead,
        
        // Hotel Totals
        totalHotelCost,
        totalCoupleHotelCost,
        
        // Divisors
        variableDivisor,
        coupleUnitDivisor,
        partialRecRegular: recRegularCount,

        // Final Rates
        regular: regularRate,
        d1: d1Rate,
        d2: d2Rate,
        couplePackageRate: couplePackageRate
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
      rates: { regular: 0, d1: 0, d2: 0, couple: 0 } 
  };

  const agencyExpenses = agency.expenses.reduce((sum, exp) => sum + safeNum(exp.amount), 0);
  const agencyGuestCount = agency.guests.reduce((sum, guest) => sum + getGuestSeatCount(guest), 0);
  
  const ratesObj = calculateBuyRates(tour);
  
  const rates = {
      regular: ratesObj.regular,
      d1: ratesObj.d1,
      d2: ratesObj.d2,
      couple: ratesObj.couplePackageRate
  };

  const penaltyAmount = safeNum(tour.penaltyAmount) || 500; 

  let totalLiability = 0;
  let totalCollection = 0;

  agency.guests.forEach(guest => {
      const seats = getGuestSeatCount(guest);
      
      if (guest.isReceived) {
          totalCollection += safeNum(guest.collection);

          // Liability Calculation
          let guestLiability = 0;
          
          if (guest.isCouple) {
              // Couple Liability is the Package Rate (covers 2 seats + hotel)
              guestLiability = rates.couple;
          } else {
              if (guest.paxBreakdown) {
                  const { regular, disc1, disc2 } = guest.paxBreakdown;
                  guestLiability += (safeNum(regular) * rates.regular);
                  guestLiability += (safeNum(disc1) * rates.d1);
                  guestLiability += (safeNum(disc2) * rates.d2);
              } else {
                   const type = guest.seatType || 'regular';
                   if (type === 'disc1') guestLiability += seats * rates.d1;
                   else if (type === 'disc2') guestLiability += seats * rates.d2;
                   else guestLiability += seats * rates.regular;
              }
          }

          totalLiability += guestLiability;

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

// Personal Settlement
export const calculatePersonalSettlement = (tour: Tour, personalData: PersonalData) => {
    if (!tour || !personalData) return { totalPersonalIncome: 0, personalExpenses: 0, totalPersonalCost: 0, netResult: 0, fees: { regFee: 0, d1Fee: 0, d2Fee: 0 } };

    const bookingFee = safeNum(personalData.bookingFee);
    const personalExpenses = personalData.customExpenses 
        ? personalData.customExpenses.reduce((sum, e) => sum + safeNum(e.amount), 0)
        : 0;

    const ratesObj = calculateBuyRates(tour);
    
    const rates = {
        regular: ratesObj.regular,
        d1: ratesObj.d1,
        d2: ratesObj.d2,
        couple: ratesObj.couplePackageRate
    };

    // Income Config
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
                 if (g.isCouple) {
                     // Couple uses manual collection or package price
                     totalPersonalIncome += safeNum(g.collection);
                 } else {
                     if (g.feeBreakdown) {
                         const incReg = safeNum(g.feeBreakdown.regular) * regFee;
                         const incD1 = safeNum(g.feeBreakdown.disc1) * d1Fee;
                         const incD2 = safeNum(g.feeBreakdown.disc2) * d2Fee;
                         totalPersonalIncome += (incReg + incD1 + incD2);
                     } else {
                        totalPersonalIncome += safeNum(g.collection);
                     }
                 }

                 // 2. Cost Logic
                 let guestCost = 0;
                 if (g.isCouple) {
                     guestCost = rates.couple;
                 } else {
                     if (g.paxBreakdown) {
                         const costReg = safeNum(g.paxBreakdown.regular) * rates.regular;
                         const costD1 = safeNum(g.paxBreakdown.disc1) * rates.d1;
                         const costD2 = safeNum(g.paxBreakdown.disc2) * rates.d2;
                         guestCost += (costReg + costD1 + costD2);
                     } else {
                         if (g.seatType === 'disc1') guestCost += seats * rates.d1;
                         else if (g.seatType === 'disc2') guestCost += seats * rates.d2;
                         else guestCost += seats * rates.regular;
                     }
                 }
                 totalPersonalCost += guestCost;

             } else {
                 // Penalty Logic
                 const penalty = seats * penaltyAmount;
                 totalPersonalIncome += penalty; 
             }
        });
    } else {
        // Fallback for old data
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