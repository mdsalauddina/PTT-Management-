

import { BusConfig, PartnerAgency, Tour, PersonalData, Guest } from '../types';

// Helper to safely convert to number
export const safeNum = (val: any): number => {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

// Helper to get total seats from a guest entry
const getGuestSeatCount = (guest: Guest): number => {
  return safeNum(guest.seatCount) || 1;
};

// Bus Fare Calculation
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
export const calculateBuyRates = (tour: Tour) => {
    const totalBusSeats = (safeNum(tour.busConfig?.regularSeats) + safeNum(tour.busConfig?.discount1Seats) + safeNum(tour.busConfig?.discount2Seats)) || 1;
    
    const hostFee = safeNum(tour.costs?.hostFee);
    const hotelCost = safeNum(tour.costs?.hotelCost); 
    const otherFixedTotal = calculateTotalOtherFixedCosts(tour);
    const dailyExpensesTotal = calculateTotalDailyExpenses(tour);
    
    const variableCostPerHead = (hostFee + hotelCost + otherFixedTotal + dailyExpensesTotal) / totalBusSeats;
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

  const totalCollection = agency.guests.reduce((sum, guest) => sum + safeNum(guest.collection), 0);
  const agencyExpenses = agency.expenses.reduce((sum, exp) => sum + safeNum(exp.amount), 0);
  const agencyGuestCount = agency.guests.reduce((sum, guest) => sum + getGuestSeatCount(guest), 0);
  
  const rates = calculateBuyRates(tour);

  let totalLiability = 0;

  agency.guests.forEach(guest => {
      const seats = getGuestSeatCount(guest);
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

// Personal Settlement (Updated to match Agency Logic: Income vs Cost)
export const calculatePersonalSettlement = (tour: Tour, personalData: PersonalData) => {
    if (!tour || !personalData) return { totalPersonalIncome: 0, personalExpenses: 0, totalPersonalCost: 0, netResult: 0 };

    const bookingFee = safeNum(personalData.bookingFee);
    const personalExpenses = personalData.customExpenses 
        ? personalData.customExpenses.reduce((sum, e) => sum + safeNum(e.amount), 0)
        : 0;

    const rates = calculateBuyRates(tour);
    
    // Calculate Income (Revenue)
    // If guest list exists, use collection. If not, calculate from counters.
    let totalPersonalIncome = bookingFee;
    let totalPersonalCost = 0;

    if (personalData.guests && personalData.guests.length > 0) {
        personalData.guests.forEach(g => {
             totalPersonalIncome += safeNum(g.collection);
             const seats = getGuestSeatCount(g);
             if (g.seatType === 'disc1') totalPersonalCost += seats * rates.d1;
             else if (g.seatType === 'disc2') totalPersonalCost += seats * rates.d2;
             else totalPersonalCost += seats * rates.regular;
        });
    } else {
        const regCount = safeNum(personalData.personalStandardCount);
        const d1Count = safeNum(personalData.personalDisc1Count);
        const d2Count = safeNum(personalData.personalDisc2Count);

        const regFee = safeNum(tour.fees?.regular);
        const d1Fee = safeNum(tour.fees?.disc1);
        const d2Fee = safeNum(tour.fees?.disc2);

        totalPersonalIncome += (regCount * regFee) + (d1Count * d1Fee) + (d2Count * d2Fee);
        
        // Cost (Liability)
        totalPersonalCost += (regCount * rates.regular) + (d1Count * rates.d1) + (d2Count * rates.d2);
    }

    const netResult = totalPersonalIncome - (totalPersonalCost + personalExpenses);

    return {
        totalPersonalIncome,
        personalExpenses,
        totalPersonalCost, // Equivalent to "Host Share of Bus Rent" or "Agency Liability"
        netResult // Profit or Loss
    };
};