

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
const calculateTotalDailyExpenses = (tour: Tour): number => {
    if (!tour.costs?.dailyExpenses) return 0;
    return tour.costs.dailyExpenses.reduce((sum, day) => 
        sum + safeNum(day.breakfast) + safeNum(day.lunch) + safeNum(day.dinner) + safeNum(day.transport) + safeNum(day.other), 0
    );
};

// Agency Settlement (Updated Logic: Tiered Buy Rates + Hotel Cost)
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

  // 1. Calculate Collections
  const totalCollection = agency.guests.reduce((sum, guest) => sum + safeNum(guest.collection), 0);
  
  // 2. Agency specific expenses
  const agencyExpenses = agency.expenses.reduce((sum, exp) => sum + safeNum(exp.amount), 0);
  
  // 3. Count Guests
  const agencyGuestCount = agency.guests.reduce((sum, guest) => sum + getGuestSeatCount(guest), 0);
  
  // 4. COST CALCULATION (Tiered Buy Rate Logic)
  
  // A. Variable Costs (Host Fee + Hotel Cost + Daily Expenses) distributed over TOTAL SEATS
  const totalBusSeats = safeNum(tour.busConfig?.totalSeats) || 1;
  const hostFee = safeNum(tour.costs?.hostFee);
  const hotelCost = safeNum(tour.costs?.hotelCost); // Added Hotel Cost
  const dailyExpensesTotal = calculateTotalDailyExpenses(tour);
  
  const variableCostPerHead = (hostFee + hotelCost + dailyExpensesTotal) / totalBusSeats;

  // B. Bus Costs (Tiered)
  const busFares = calculateBusFare(tour.busConfig);

  // C. Final Buy Rates (Bus Cost + Variable Cost)
  const rateRegular = Math.ceil(busFares.regularFare + variableCostPerHead);
  const rateD1 = Math.ceil(busFares.discount1Fare + variableCostPerHead);
  const rateD2 = Math.ceil(busFares.discount2Fare + variableCostPerHead);

  // 5. Total Bill (Liability) Calculation based on Guest Seat Types
  let totalLiability = 0;

  agency.guests.forEach(guest => {
      const seats = getGuestSeatCount(guest);
      
      // Use granular breakdown if available
      if (guest.paxBreakdown) {
          const { regular, disc1, disc2 } = guest.paxBreakdown;
          totalLiability += (safeNum(regular) * rateRegular);
          totalLiability += (safeNum(disc1) * rateD1);
          totalLiability += (safeNum(disc2) * rateD2);
      } else {
          // Fallback to primary seatType
          const type = guest.seatType || 'regular';
          if (type === 'disc1') {
              totalLiability += seats * rateD1;
          } else if (type === 'disc2') {
              totalLiability += seats * rateD2;
          } else {
              totalLiability += seats * rateRegular;
          }
      }
  });
  
  // 6. Net Amount
  // Collection - (Liability + Expenses)
  const netAmount = totalCollection - (totalLiability + agencyExpenses); 
  
  return {
    totalCollection,
    agencyExpenses,
    fixedCostShare: totalLiability,
    totalCost: totalLiability + agencyExpenses,
    netAmount,
    totalSeats: agencyGuestCount,
    rates: {
        regular: rateRegular,
        d1: rateD1,
        d2: rateD2
    }
  };
};

// Personal Settlement
export const calculatePersonalSettlement = (tour: Tour, personalData: PersonalData) => {
    if (!tour || !personalData) return { totalPersonalIncome: 0, personalExpenses: 0, hostShareOfBusRent: 0, netResult: 0 };

    const regCount = safeNum(personalData.personalStandardCount);
    const d1Count = safeNum(personalData.personalDisc1Count);
    const d2Count = safeNum(personalData.personalDisc2Count);
    const bookingFee = safeNum(personalData.bookingFee);

    const regFee = safeNum(tour.fees?.regular);
    const d1Fee = safeNum(tour.fees?.disc1);
    const d2Fee = safeNum(tour.fees?.disc2);

    const regIncome = regCount * regFee;
    const d1Income = d1Count * d1Fee;
    const d2Income = d2Count * d2Fee;
    
    const totalPersonalIncome = regIncome + d1Income + d2Income + bookingFee;
    
    const personalExpenses = personalData.customExpenses 
        ? personalData.customExpenses.reduce((sum, e) => sum + safeNum(e.amount), 0)
        : 0;

    const hostGuestCount = regCount + d1Count + d2Count;
    
    // Cost Basis for Personal (Same logic: Per Seat Capacity)
    const totalRent = safeNum(tour.busConfig?.totalRent);
    const hostFee = safeNum(tour.costs?.hostFee);
    const hotelCost = safeNum(tour.costs?.hotelCost); // Added Hotel Cost
    const dailyExpensesTotal = calculateTotalDailyExpenses(tour);
    const totalSeats = safeNum(tour.busConfig?.totalSeats) || 1;

    const perHeadCost = (totalRent + hostFee + hotelCost + dailyExpensesTotal) / totalSeats;
    const hostShareOfBusRent = Math.ceil(perHeadCost * hostGuestCount);

    const netResult = totalPersonalIncome - personalExpenses - hostShareOfBusRent;

    return {
        totalPersonalIncome,
        personalExpenses,
        hostShareOfBusRent,
        netResult
    };
};