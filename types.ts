

export type UserRole = 'admin' | 'host' | 'agency';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  createdAt: any; // Firestore Timestamp
  lastLogin: any;
}

export interface BusConfig {
  totalRent: number;
  totalSeats: number;
  regularSeats: number;
  discount1Seats: number;
  discount1Amount: number;
  discount2Seats: number;
  discount2Amount: number;
}

export interface TourFees {
  regular: number;
  disc1: number;
  disc2: number;
}

export interface DailyExpense {
  day: number;
  breakfast: number;
  lunch: number;
  dinner: number;
  transport: number;
  other: number; // Added field for extra daily expenses
}

export interface TourCosts {
  perHead: number;
  hostFee: number;
  hotelCost: number; // Added field for total hotel cost
  otherFixedCosts: { id: string; name: string; amount: number }[]; // Added dynamic extra fixed costs
  dailyExpenses: DailyExpense[];
}

export interface Guest {
  id: string;
  name: string;
  phone: string;
  seatCount: number; // Number of seats for this group
  seatNumbers?: string; // Added seat numbers (e.g., "A1, A2")
  unitPrice: number; // Per seat collection amount
  collection: number; // Total collection (seatCount * unitPrice)
  seatType: 'regular' | 'disc1' | 'disc2'; // Kept for backward compatibility/default
  
  // Seat Usage (Determines Cost/Liability)
  paxBreakdown?: {
    regular: number;
    disc1: number;
    disc2: number;
  };
  
  // Payment Package (Determines Income) - New Field
  feeBreakdown?: {
    regular: number;
    disc1: number;
    disc2: number;
  };
}

export interface AgencyExpense {
  id: string;
  description: string;
  amount: number;
}

export interface PartnerAgency {
  id: string;
  name: string;
  email: string; // Linked to UserProfile email
  phone: string;
  guests: Guest[];
  expenses: AgencyExpense[];
}

export interface Tour {
  id: string;
  name: string;
  date: string;
  duration: number;
  createdBy: string;
  assignedHostId?: string; // UID of the assigned host
  fees: TourFees;
  busConfig: BusConfig;
  costs: TourCosts;
  partnerAgencies: PartnerAgency[];
  totalGuests?: number; // Total number of confirmed guests (Personal + Agency)
  createdAt: any;
  updatedAt: any;
}

export interface PersonalData {
  tourId: string;
  userId: string;
  personalStandardCount: number;
  personalDisc1Count: number;
  personalDisc2Count: number;
  personalBusRegCount: number;
  personalBusD1Count: number;
  personalBusD2Count: number;
  bookingFee: number;
  customExpenses: { id: string; name: string; amount: number }[];
  guests?: Guest[]; // Added guests list to personal data
  
  // Added for custom pricing override in Personal Tab
  customPricing?: {
    baseFee: number;
    d1Amount: number;
    d2Amount: number;
  };
  
  updatedAt: any;
}

export type TabId = 'entry' | 'analysis' | 'personal' | 'share' | 'final' | 'guest_list' | 'settlement';

// Shared Props Interface
export interface CommonTabProps {
  user: UserProfile;
  allUsers: UserProfile[]; // List of all users (for Admin to select hosts)
  tours: Tour[];
  refreshTours: () => Promise<void>;
}