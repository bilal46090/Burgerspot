
export interface IngredientRequirement {
  ingredientId: string;
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  cost?: number; // Added for profit calculation
  detailedCost?: {
    [key: string]: number | undefined;
  };
  category: string;
  image?: string;
  ingredients?: IngredientRequirement[];
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
  packetPrice: number;    // Price of the full packet/bulk
  packetSize: number;     // Number of pieces/units in one packet
  costPerUnit: number;    // Calculated: packetPrice / packetSize
}

export interface InventorySnapshot {
  id?: string;
  date: string; // Business date
  items: {
    id: string;
    stock: number;
    costPerUnit: number;
  }[];
}

export interface CashReconciliation {
  id: string;
  date: string; // Business date
  timestamp: number;
  expectedCash: number;
  physicalCash: number;
  difference: number;
  note: string;
  userId: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  action: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR';
  details?: string;
}

export interface Addon {
  id: string;
  name: string;
  price: number;
  ingredients?: IngredientRequirement[];
}

export interface CartItem extends Product {
  qty: number;
  selectedAddons: Addon[];
  note?: string;
  customCharge?: number;
}

export type OrderType = 'TAKEAWAY' | 'DELIVERY' | 'DINE-IN';
export type PaymentMethod = 'CASH' | 'EASYPAISA' | 'JAZZCASH' | 'BANK' | 'SPLIT' | 'CREDIT' | 'SPLIT_UDHAAR';

export interface SplitPaymentDetail {
  method: Exclude<PaymentMethod, 'SPLIT'>;
  amount: number;
  accountName?: string;
}

export interface Customer {
  id?: string;
  name: string;
  mobile: string;
  address: string;
  totalOrders?: number;
  totalSpent?: number;
  lastOrderDate?: string;
  createdAt?: string;
}

export interface Order {
  id: string;
  invoiceNo: number;
  businessDate: string; // YYYY-MM-DD
  timestamp: number;
  dateStr: string; 
  items: CartItem[];
  total: number;
  subtotal?: number;
  customer: Customer;
  customerId?: string | null;
  type: OrderType;
  cashReceived?: number;
  status: 'PAID' | 'UNPAID' | 'UDHAAR' | 'VOIDED';
  paymentMethod?: PaymentMethod;
  discount?: number;
  deliveryCharge?: number;
  tillId?: string | null;
  splitDetails?: SplitPaymentDetail[];
  paymentAccountName?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  mobile: string;
  email?: string;
  address?: string;
  category?: string; // e.g., Meat, Vegetables, Packaging
  totalDue: number;
}

export type POStatus = 'DRAFT' | 'SENT' | 'RECEIVED' | 'CANCELLED';
export type POPaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface POItem {
  itemId: string;
  name: string;
  qty: number;
  unit: string;
  costPrice: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  items: POItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: POStatus;
  paymentStatus: POPaymentStatus;
  amountPaid: number;
  orderDate: number;
  expectedDeliveryDate?: number;
  receivedDate?: number;
  notes?: string;
}

export enum UserRole {
  CASHIER = 'cashier',
  ADMIN = 'admin'
}

export interface User {
  id: string;
  username: string;
  email?: string;
  password?: string;
  role: UserRole;
  name: string;
}

export interface Expense {
  id: string;
  timestamp: number;
  dateStr: string;
  reason: string;
  amount: number;
  category: string;
  userId: string;
}
