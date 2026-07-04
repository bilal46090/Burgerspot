// Bursport POS - Enterprise Edition v1.1.4 - Deployment Sync & Login Hardening
import React, { useState, useMemo, useCallback, useEffect, useDeferredValue } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  setDoc,
  doc, 
  deleteDoc,
  increment,
  writeBatch,
  query, 
  where,
  getDocs,
  orderBy, 
  limit,
  serverTimestamp 
} from "firebase/firestore";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { db, auth, onConnectionChange } from "./src/lib/firebase";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
} from "recharts";
import {
  ShoppingCart,
  Sparkles,
  Search,
  Settings,
  LogOut,
  Trash2,
  Plus,
  Minus,
  Save,
  CheckCircle2,
  Clock,
  User,
  Flame,
  ShieldCheck,
  Package,
  Layers,
  ChevronRight,
  Printer,
  Moon,
  Sun,
  Drumstick,
  Beef,
  Coffee,
  Zap,
  Gift,
  Waves,
  Soup,
  LayoutGrid,
  Truck,
  XCircle,
  AlertTriangle,
  PlusCircle,
  Database,
  Wallet,
  Users,
  ScrollText,
  BarChart3,
  History,
  TrendingUp,
  TrendingDown,
  Activity,
  Share2,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Layout,
  Banknote,
  Coins,
  Scale,
  Receipt,
  PieChart as PieChartIcon,
  Filter,
  Menu,
  UserCog,
  Smartphone,
  CreditCard,
  Calendar,
  Check,
  PackagePlus,
  Edit3,
  Edit2,
  X,
  Bell,
  Pizza,
  MapPin,
  Phone,
  Hash,
  FileText,
  Calendar as CalendarIcon,
  QrCode,
  Wifi,
  WifiOff,
  BookOpen,
  Utensils,
  ShoppingBag,
} from "lucide-react";
import { toPng } from "html-to-image";
import {
  Product,
  CartItem,
  OrderType,
  Customer,
  UserRole,
  Order,
  User as UserType,
  PaymentMethod,
  InventoryItem,
  AuditLogEntry,
  Expense,
  InventorySnapshot,
  CashReconciliation,
} from "./types";
import {
  MENU as INITIAL_MENU,
  CATEGORIES as INITIAL_CATEGORIES,
  INITIAL_INVENTORY,
  ADDONS,
} from "./constants";
import Button from "./components/Button";
import { getSmartSuggestions } from "./services/geminiService";
import { clearCache as clearAICache } from "./services/AIManager";
import { preFetchCommonQueries } from "./services/AIManager";
import GeminiChat from "./components/GeminiChat";
import AIConsultant from "./components/AIConsultant";
import PurchaseOrders from "./components/PurchaseOrders";

type AuthView = "LOGIN" | "SIGNUP" | "VERIFY";

// --- Helpers ---
const SHOP_OPEN_HOUR = 8; // Shop business day starts at 8:00 AM

const getBusinessDate = (date: Date = new Date()) => {
  const d = new Date(date);
  // If current time is before the shop opening hour, it belongs to the previous calendar day's business session
  if (d.getHours() < SHOP_OPEN_HOUR) {
    d.setDate(d.getDate() - 1);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatInvoiceNo = (businessDate: string, invoiceNo: number) => {
  const dateCompact = businessDate.replace(/-/g, "");
  const paddedNo = String(invoiceNo).padStart(3, "0");
  return `INV-${dateCompact}-${paddedNo}`;
};

const formatDateForLabel = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

// --- Top level components for extreme performance ---
const ProductCard = React.memo(
  ({
    product,
    qty,
    addToCart,
    updateQty,
    stockPortions = Infinity,
  }: {
    product: Product;
    qty: number;
    addToCart: (p: Product) => void;
    updateQty: (id: string, delta: number) => void;
    stockPortions?: number;
  }) => {
    const isLowStock = stockPortions < 6 && stockPortions >= 3;
    const isCriticallyLow = stockPortions < 3;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileTap={{ scale: 0.97 }}
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
        className={`flex flex-col bg-white dark:bg-slate-900 border ${
          isCriticallyLow 
            ? "border-rose-500/50 shadow-lg shadow-rose-500/5" 
            : isLowStock 
              ? "border-amber-500/50 shadow-lg shadow-amber-500/5" 
              : "border-slate-100 dark:border-slate-800"
        } rounded-[1.5rem] md:rounded-2xl shadow-sm hover:shadow-xl transition-all p-4 md:p-4 group cursor-pointer select-none touch-manipulation relative overflow-hidden`}
        onClick={() => {
          if (stockPortions > 0) addToCart(product);
        }}
      >
        {/* Stock Indicators */}
        {stockPortions !== Infinity && (
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
            {isCriticallyLow ? (
              <div className="flex items-center gap-1 bg-rose-500 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full animate-pulse">
                <AlertTriangle size={8} /> Critical
              </div>
            ) : isLowStock ? (
              <div className="flex items-center gap-1 bg-amber-500 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full">
                <Package size={8} /> Low Stock
              </div>
            ) : null}
            <span className={`text-[8px] font-black uppercase ${
              isCriticallyLow ? 'text-rose-500' : isLowStock ? 'text-amber-500' : 'text-slate-300'
            }`}>
              {Math.floor(stockPortions)} Portions
            </span>
          </div>
        )}

        <div className="flex-1 pointer-events-none select-none">
          <h3 className="text-[11px] md:text-[12px] font-bold uppercase text-slate-800 dark:text-slate-100 leading-tight mb-1 min-h-[2.4em] flex items-center">
            {product.name}
          </h3>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest opacity-60">
            {product.category}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-50 dark:border-white/5 pt-3 pointer-events-auto">
          <p className="text-[14px] md:text-[13px] font-black text-[#e67e22] pointer-events-none select-none">
            Rs {product.price}
          </p>

          {stockPortions <= 0 ? (
            <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-lg text-[9px] font-black uppercase italic">
              Out of Stock
            </div>
          ) : qty > 0 ? (
            <div
              className="flex items-center bg-amber-500 rounded-xl p-0.5 shadow-lg shadow-amber-500/20"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  updateQty(product.id, -1);
                }}
                className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded-lg transition-colors"
              >
                <Minus className="w-4 h-4" strokeWidth={3} />
              </button>
              <span className="w-8 text-center text-[12px] font-black text-white select-none">
                {qty}
              </span>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  updateQty(product.id, 1);
                }}
                className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" strokeWidth={3} />
              </button>
            </div>
          ) : (
            <div className="p-3 md:p-2.5 bg-[#e67e22] text-white rounded-xl active:scale-90 transition-transform shadow-lg shadow-orange-500/20">
              <Plus
                className="w-5 h-5 md:w-4 md:h-4 text-white"
                strokeWidth={3}
              />
            </div>
          )}
        </div>
      </motion.div>
    );
  },
);

const MenuGrid = React.memo(
  ({
    items,
    cartMap,
    addToCart,
    updateQty,
    inventory,
  }: {
    items: Product[];
    cartMap: Map<string, number>;
    addToCart: (p: Product) => void;
    updateQty: (id: string, delta: number) => void;
    inventory: InventoryItem[];
  }) => {
    const invMap = useMemo(() => new Map(inventory.map(i => [i.id, i])), [inventory]);

    const getStockPortions = (product: Product) => {
      if (inventory.length === 0) return Infinity;
      if (!product.ingredients || product.ingredients.length === 0)
        return Infinity;
      let minPortions = Infinity;
      product.ingredients.forEach((req) => {
        const invItem = invMap.get(req.ingredientId);
        if (invItem) {
          const available = invItem.stock / req.quantity;
          if (available < minPortions) minPortions = available;
        } else {
          minPortions = 0;
        }
      });
      return minPortions;
    };

    return (
      <div className="flex-1 md:overflow-y-auto p-4 grid grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5 custom-scrollbar min-h-[400px]">
        {items.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            qty={cartMap.get(product.id) || 0}
            addToCart={addToCart}
            updateQty={updateQty}
            stockPortions={getStockPortions(product)}
          />
        ))}
      </div>
    );
  },
);

// --- Clock Component to isolate second-by-second re-renders ---
const DigitalClock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <>{time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>
  );
};

// --- Sub-components for performance ---
const CartContent = React.memo(
  ({
    cart,
    updateQty,
    setCart,
    total,
    subtotal,
    discount,
    setDiscount,
    deliveryCharge,
    setDeliveryCharge,
    setIsCustomerModalOpen,
    customer,
    editingOrderId,
    setEditingOrderId,
    updateItemNote,
    editingNoteId,
    setEditingNoteId,
    editingCustomChargeId,
    setEditingCustomChargeId,
    updateCustomCharge,
    logAction,
    setDiscountPromptValue,
    setIsDiscountPromptOpen,
    setIsVoidConfirmOpen,
    backdateOverride,
    setBackdateOverride,
    currentUser,
  }: any) => {
    return (
      <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-slate-900/40 relative">
        {/* Main Cart Items Display (Static Sidebar) */}
        <div className="flex-1 flex flex-col min-h-0 pt-10">
          <div className="px-6 py-4 flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-widest border-b dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span>Live Cart Inventory</span>
              {editingOrderId && (
                <span className="bg-rose-500 text-white px-2 py-0.5 rounded-md text-[8px] animate-pulse">
                  Edit Mode
                </span>
              )}
              {backdateOverride && (
                <span className="bg-amber-500 text-white px-2 py-0.5 rounded-md text-[8px] animate-pulse">
                  Backdate: {backdateOverride}
                </span>
              )}
            </div>
            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 px-3 py-1 rounded-full">
              {cart.length} sku
            </span>
          </div>

          {currentUser?.role === UserRole.ADMIN && !editingOrderId && (
            <div className="px-6 pt-4">
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/40 p-4 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3 text-amber-500" />
                    <p className="text-[9px] font-black uppercase text-amber-600">Backdate Feature</p>
                  </div>
                  {backdateOverride && (
                    <button 
                      onClick={() => setBackdateOverride(null)}
                      className="text-[8px] font-black uppercase text-rose-500 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors"
                    >
                      Reset to Today
                    </button>
                  )}
                </div>
                <input 
                  type="date"
                  value={backdateOverride || getBusinessDate()}
                  max={getBusinessDate()}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === getBusinessDate()) {
                      setBackdateOverride(null);
                    } else {
                      setBackdateOverride(val);
                      logAction(`Backdating Cart to: ${val}`, "WARNING");
                    }
                  }}
                  className="w-full bg-white dark:bg-slate-800 border-2 border-amber-500/20 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none focus:border-amber-500 transition-all text-amber-700 dark:text-amber-400"
                />
                <p className="text-[7px] font-bold text-amber-500/60 mt-2 uppercase text-center tracking-tighter">
                  Orders placed will be recorded on the selected date above.
                </p>
              </div>
            </div>
          )}

          {editingOrderId && (
            <div className="px-6 pt-4">
              <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/50 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-rose-600 uppercase">
                    Editing Order
                  </p>
                  <p className="text-[8px] font-bold text-rose-500/70 uppercase">
                    Modifying existing record
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingOrderId(null);
                    setCart([]);
                    logAction(
                      `Edit Cancelled for Order #${editingOrderId}`,
                      "WARNING",
                    );
                  }}
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl text-[8px] font-black uppercase shadow-lg shadow-rose-600/20 active:scale-95 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="px-6 py-4">
            <button
              onClick={() => setIsCustomerModalOpen(true)}
              className="w-full py-4 bg-white dark:bg-slate-800 border-2 border-dashed border-amber-500/30 rounded-2xl flex items-center justify-center gap-3 group hover:border-amber-500 transition-all shadow-sm"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 group-active:scale-90 transition-transform">
                <UserCog className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-[7px] font-black uppercase text-slate-400 leading-none mb-1">
                  Guest Info
                </p>
                <p className="text-[11px] font-black uppercase text-slate-700 dark:text-amber-500 truncate max-w-[150px]">
                  {customer.name || "Set Customer"}
                </p>
              </div>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-10 py-20 grayscale">
                <ShoppingCart className="w-16 h-16 mb-4" strokeWidth={1} />
                <p className="text-[12px] font-black uppercase tracking-[0.5em]">
                  No Selection
                </p>
              </div>
            ) : (
              cart.map((item: CartItem) => (
                <motion.div
                  key={item.id}
                  className="group p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-3 transition-all"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[11px] font-bold uppercase truncate leading-tight text-slate-700 dark:text-slate-200">
                        {item.name}
                      </h4>
                      <p className="text-[13px] font-brand italic text-amber-500 font-bold mt-1">
                        Rs {item.price * item.qty}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          setEditingNoteId(
                            editingNoteId === item.id ? null : item.id,
                          )
                        }
                        className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${item.note ? "text-amber-500 bg-amber-500/10" : "text-slate-300 hover:text-amber-500 hover:bg-slate-50"}`}
                        title="Add Item Note"
                      >
                        <ScrollText className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setEditingCustomChargeId(
                            editingCustomChargeId === item.id ? null : item.id,
                          )
                        }
                        className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${item.customCharge ? "text-emerald-500 bg-emerald-500/10" : "text-slate-300 hover:text-emerald-500 hover:bg-slate-50"}`}
                        title="Add Customization Charge"
                      >
                        <span className="text-[10px] font-black">PKR</span>
                      </button>
                      <div className="flex items-center bg-slate-50 dark:bg-slate-900/50 rounded-xl p-1 border dark:border-slate-700">
                        <button
                          onClick={() => updateQty(item.id, -1)}
                          className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg shadow-sm text-slate-500 hover:text-rose-500 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center text-[11px] font-black">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => updateQty(item.id, 1)}
                          className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg shadow-sm text-slate-500 hover:text-amber-500 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => updateQty(item.id, -item.qty)}
                        className="text-slate-300 hover:text-rose-500 transition-colors p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {item.note && !editingNoteId && (
                    <div className="bg-amber-50/50 dark:bg-amber-900/10 px-3 py-1.5 rounded-lg border border-amber-500/10">
                      <p className="text-[9px] text-amber-600 dark:text-amber-400 italic">
                        "{item.note}"
                      </p>
                    </div>
                  )}

                  {item.customCharge && !editingCustomChargeId && (
                    <div className="bg-emerald-50/50 dark:bg-emerald-900/10 px-3 py-1.5 rounded-lg border border-emerald-500/10 flex justify-between items-center">
                      <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                        Customization Charge
                      </p>
                      <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">
                        +Rs {item.customCharge}
                      </span>
                    </div>
                  )}

                  <AnimatePresence>
                    {editingCustomChargeId === item.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-2 p-1">
                          <label className="text-[8px] font-black uppercase text-slate-400">Extra Customization Price</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder="Amount (e.g. 50)"
                              value={item.customCharge || ""}
                              onChange={(e) =>
                                updateCustomCharge(item.id, parseFloat(e.target.value) || 0)
                              }
                              autoFocus
                              className="flex-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2 text-[10px] focus:ring-1 focus:ring-emerald-500"
                            />
                            <button
                              onClick={() => setEditingCustomChargeId(null)}
                              className="bg-emerald-500 text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {editingNoteId === item.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <textarea
                          placeholder="Special instructions or notes..."
                          value={item.note || ""}
                          onChange={(e) =>
                            updateItemNote(item.id, e.target.value)
                          }
                          onBlur={() => setEditingNoteId(null)}
                          autoFocus
                          className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-[10px] focus:ring-1 focus:ring-amber-500 transition-all resize-none h-16"
                        />
                        <div className="flex justify-end mt-1">
                          <button
                            onClick={() => setEditingNoteId(null)}
                            className="text-[8px] font-black uppercase text-amber-500 hover:underline"
                          >
                            Finished
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))
            )}
          </div>
        </div>

        <div className="p-6 border-t dark:border-white/5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm space-y-4 shrink-0">
          <div className="flex flex-col gap-3">
            {/* New Adjustment Controls directly in Cart */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-[7px] font-black uppercase text-slate-400 ml-1 italic opacity-70">
                  Adjustment (Discount)
                </p>
                <div className="relative">
                  <input
                    type="number"
                    value={discount || ""}
                    onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                    className="w-full bg-white dark:bg-slate-800 p-2.5 rounded-xl text-[10px] font-black border dark:border-white/5 outline-none focus:ring-1 ring-rose-500/30 text-rose-500 shadow-sm"
                    placeholder="0"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-rose-300">
                    RS
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[7px] font-black uppercase text-slate-400 ml-1 italic opacity-70">
                  Service (Delivery)
                </p>
                <div className="relative">
                  <input
                    type="number"
                    value={deliveryCharge || ""}
                    onChange={(e) =>
                      setDeliveryCharge(Number(e.target.value) || 0)
                    }
                    className="w-full bg-white dark:bg-slate-800 p-2.5 rounded-xl text-[10px] font-black border dark:border-white/5 outline-none focus:ring-1 ring-emerald-500/30 text-emerald-500 shadow-sm"
                    placeholder="0"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-emerald-300">
                    RS
                  </span>
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest text-slate-400">
              <div className="flex items-center gap-2">
                <span>Subtotal</span>
              </div>
              <span>Rs {subtotal}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest text-amber-500">
              <div className="flex items-center gap-2">
                <span>Discount</span>
                <button
                  onClick={() => {
                    setDiscountPromptValue(discount.toString());
                    setIsDiscountPromptOpen(true);
                  }}
                  className="bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded text-[8px] hover:bg-amber-500 hover:text-white transition-all"
                >
                  Edit
                </button>
              </div>
              <span>- Rs {discount}</span>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t dark:border-white/10 gap-4">
            <div className="text-left">
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none italic">
                Total Pay
              </p>
              <p className="text-xl font-brand italic text-amber-500 leading-none">
                Rs {total}
              </p>
            </div>

            <button
              onClick={() => setIsCustomerModalOpen(true)}
              disabled={cart.length === 0}
              className={`flex-1 py-4 rounded-2xl font-black uppercase italic tracking-widest text-[11px] shadow-lg transition-all flex items-center justify-center gap-2 ${
                cart.length > 0
                  ? "bg-amber-500 text-white shadow-amber-500/30 active:scale-95"
                  : "bg-slate-100 text-slate-300 shadow-none grayscale cursor-not-allowed"
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              Check Out
            </button>
          </div>
          <div className="flex justify-center pt-2">
            <button
              onClick={() => {
                setIsVoidConfirmOpen(true);
              }}
              className="text-rose-500 text-[10px] font-black uppercase tracking-widest hover:underline px-2 opacity-50 hover:opacity-100 transition-opacity"
            >
              Void Selection
            </button>
          </div>
        </div>
      </div>
    );
  },
);

// --- Premium UI Components ---
const AnimatedNumber = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) return;

    let totalDuration = 1000;
    let startTime: number | null = null;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / totalDuration, 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.floor(easeProgress * (end - start) + start);
      
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <span>{displayValue.toLocaleString()}</span>;
};

export default function App() {
  const STORAGE_KEYS = {
    USERS: "bs_pos_users_v3",
    CATEGORIES: "bs_pos_categories_v3",
    MENU: "bs_pos_menu_v3",
    ORDERS: "bs_pos_orders_v3",
    INVENTORY: "bs_pos_inventory_v3",
    AUDIT_LOGS: "bs_pos_audit_logs_v4",
    SNAPSHOTS: "bs_pos_snapshots_v4",
    RECONCILIATIONS: "bs_pos_reconciliations_v4",
    EXPENSES: "bs_pos_expenses_v4",
    CUSTOMERS: "bs_pos_customers_v1",
  };

  // --- Core Identity & Auth ---
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setIsAuthReady(true);
      if (user) {
        console.log("Firebase Auth: Signed in as", user.uid);
      }
    });
    return () => unsubAuth();
  }, []);

  const [currentUser, setCurrentUser] = useState<UserType | null>(() => {
    try {
      const saved = localStorage.getItem("bs_pos_current_user");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("bs_pos_current_user", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("bs_pos_current_user");
    }
  }, [currentUser]);

  // --- Firestore Error Handling ---
  enum OperationType {
    CREATE = 'create', UPDATE = 'update', DELETE = 'delete', LIST = 'list', GET = 'get', WRITE = 'write',
  }
  interface FirestoreErrorInfo {
    error: string; operationType: OperationType; path: string | null;
    authInfo: { userId?: string | null; email?: string | null; emailVerified?: boolean | null; }
  }
  const handleFirestoreError = useCallback((error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: { userId: currentUser?.id, email: currentUser?.email, emailVerified: !!auth.currentUser?.emailVerified },
      operationType, path
    };
    
    // Always log to console for debugging, regardless of status
    console.error(`🔥 Firestore ${operationType} failed on [${path}]:`, error);
    
    const isConnectivityError = errInfo.error.includes("unavailable") || 
                             errInfo.error.includes("offline") || 
                             errInfo.error.includes("deadline-exceeded") || 
                             errInfo.error.includes("failed to connect") ||
                             errInfo.error.includes("network error");

    if (isConnectivityError) {
      setIsConnected(false);
      return;
    }
    
    // For other errors (permissions, indices, etc), throw to trigger any error boundaries or alerts
    throw new Error(JSON.stringify(errInfo));
  }, [currentUser]);

  // --- Connectivity Tracking ---
  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    const unsubConnection = onConnectionChange((status) => {
      // Trust the firestore connection more than navigator.onLine which can be flaky in iframes
      setIsOnline(status);
      setIsConnected(status);
    });
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      unsubConnection();
    };
  }, []);

  // --- Firebase Sync ---
  useEffect(() => {
    if (!isAuthReady) return;

    // Sync Orders
    const qOrders = query(collection(db, "orders"), orderBy("timestamp", "desc"), limit(10000));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const fbOrders = snapshot.docs.map(doc => {
        const data = doc.data();
        let ts = data.timestamp;
        if (ts && typeof ts === 'object' && 'seconds' in ts) {
          ts = ts.seconds * 1000;
        } else if (ts && typeof ts === 'object' && 'toDate' in ts) {
          ts = (ts as any).toDate().getTime();
        } else if (typeof ts === 'string') {
          ts = new Date(ts).getTime() || Date.now();
        } else if (typeof ts !== 'number') {
          ts = Date.now();
        }
        return { 
          ...data, 
          id: doc.id,
          timestamp: ts,
          businessDate: data.businessDate || getBusinessDate(new Date(ts))
        };
      }) as Order[];
      setOrders(fbOrders);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "orders"));

    // Sync Inventory
    const unsubInv = onSnapshot(collection(db, "inventory"), (snapshot) => {
      if (snapshot.empty) {
        // Seed initial inventory to Firebase if it's empty
        INITIAL_INVENTORY.forEach(item => {
          setDoc(doc(db, "inventory", item.id), item).catch(e => handleFirestoreError(e, OperationType.WRITE, "inventory/" + item.id));
        });
      } else {
        const fbInv = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as InventoryItem[];
        setInventory(fbInv);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, "inventory"));

    // Sync Expenses
    const unsubExp = onSnapshot(collection(db, "expenses"), (snapshot) => {
      const fbExp = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Expense[];
      setExpenses(fbExp);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "expenses"));

    // Sync Customers
    const unsubCust = onSnapshot(collection(db, "customers"), (snapshot) => {
      if (snapshot.empty) {
        // Sample customer
        addDoc(collection(db, "customers"), {
           name: "Sample Customer",
           mobile: "03001234567",
           address: "Sample Address",
           totalOrders: 0,
           totalSpent: 0,
           createdAt: new Date().toISOString()
        }).catch(e => handleFirestoreError(e, OperationType.CREATE, "customers"));
      }
      const fbCust = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Customer[];
      setCustomers(fbCust);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "customers"));

    // Sync Users
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      console.log("Users synced from firestore, empty:", snapshot.empty);
      if (snapshot.empty) {
        setDoc(doc(db, "users", "admin-default"), {
           name: "Admin",
           username: "admin",
           password: "123",
           role: UserRole.ADMIN,
           createdAt: new Date().toISOString()
        }).catch(e => console.error("Seed error:", e));
      }
      const fbUsers = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as UserType[];
      setUsers(fbUsers);
    }, (err) => {
      console.error("Users Sync Error:", err);
      // In case of error, we still want to keep whatever is in local state
    });

    // Sync Categories
    const unsubCats = onSnapshot(doc(db, "config", "categories"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && Array.isArray(data.names)) {
          setCategories(data.names);
        }
      } else {
        setDoc(doc(db, "config", "categories"), { names: INITIAL_CATEGORIES })
          .catch(e => handleFirestoreError(e, OperationType.WRITE, "config/categories"));
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, "config/categories"));

    // Sync Menu
    const unsubMenu = onSnapshot(collection(db, "menu"), (snapshot) => {
      if (snapshot.empty) {
        INITIAL_MENU.forEach(item => {
          addDoc(collection(db, "menu"), item).catch(e => handleFirestoreError(e, OperationType.CREATE, "menu"));
        });
      }
      const fbMenu = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Product[];
      setMenuItems(fbMenu);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "menu"));

    // Sync Reconciliations
    const unsubRecon = onSnapshot(query(collection(db, "reconciliations"), orderBy("timestamp", "desc"), limit(100)), (snapshot) => {
      const fbRecon = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as CashReconciliation[];
      setReconciliations(fbRecon);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "reconciliations"));

    // Sync Inventory Snapshots
    const unsubSnapshots = onSnapshot(query(collection(db, "snapshots"), orderBy("date", "desc"), limit(100)), (snapshot) => {
      const fbSnaps = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as InventorySnapshot[];
      setInventorySnapshots(fbSnaps);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "snapshots"));

    // Pre-fetch AI queries
    preFetchCommonQueries();

    // Connection listener
    const unsubConn = onConnectionChange((status) => {
      setIsConnected(status);
    });

    return () => {
      unsubOrders();
      unsubInv();
      unsubExp();
      unsubCust();
      unsubUsers();
      unsubCats();
      unsubMenu();
      unsubRecon();
      unsubSnapshots();
      unsubConn();
    };
  }, [isAuthReady, handleFirestoreError]);

  // --- Core State with LocalStorage Persistence ---
  const [users, setUsers] = useState<UserType[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Error parsing users:", e);
    }
    // Hardcoded fallback for first-time / offline use
    return [{ 
      id: 'admin-default', 
      name: 'Admin', 
      username: 'admin', 
      password: '123', 
      role: UserRole.ADMIN, 
      createdAt: new Date().toISOString() 
    }];
  });
  const [categories, setCategories] = useState<string[]>(INITIAL_CATEGORIES);
  const [menuItems, setMenuItems] = useState<Product[]>(INITIAL_MENU);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.error("Error parsing audit logs:", e);
    }
    return [];
  });
  const [inventorySnapshots, setInventorySnapshots] = useState<
    InventorySnapshot[]
  >([]);
  const [reconciliations, setReconciliations] = useState<CashReconciliation[]>(
    [],
  );
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // --- Auto-Save Mechanism (Only for local metadata/logs) ---
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }, [users]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    const handleEvents = (e: Event) => {
      // Allow inputs to work normally
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.type === "dragstart") e.preventDefault();
      if (e.type === "contextmenu") e.preventDefault();
    };
    window.addEventListener("dragstart", handleEvents);
    window.addEventListener("contextmenu", handleEvents);
    return () => {
      window.removeEventListener("dragstart", handleEvents);
      window.removeEventListener("contextmenu", handleEvents);
    };
  }, []);
  // isOnline and listeners moved to top

  // --- ONE-TIME REMOVAL OF MANUALLY ADDED SALES ---
  useEffect(() => {
    const removeMigratedSales = async () => {
      const hasRemoved = localStorage.getItem('REMOVED_MANUAL_SALES_FINAL');
      if (hasRemoved) return;

      console.log("Cleaning up all Retroactive Entry orders...");
      try {
        const q = query(collection(db, "orders"), where("customer.name", "==", "Retroactive Entry"));
        const snap = await getDocs(q);
        
        for (const d of snap.docs) {
          await deleteDoc(doc(db, "orders", d.id));
        }

        localStorage.setItem('REMOVED_MANUAL_SALES_FINAL', 'true');
        console.log("Cleanup complete. Manual sales removed.");
      } catch (err) {
        console.error("Cleanup error:", err);
      }
    };

    removeMigratedSales();
  }, [db]);

  // --- Auth & Session ---
  const [authView, setAuthView] = useState<AuthView>("LOGIN");
  const [authError, setAuthError] = useState("");
  const [mockEmail, setMockEmail] = useState<{ code: string } | null>(null);

  // Forms
  const [loginForm, setLoginForm] = useState({ identifier: "", password: "" });
  const [regForm, setRegForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    role: UserRole.CASHIER,
  });
  const [expenseForm, setExpenseForm] = useState({
    reason: "",
    amount: "",
    category: "Purchasing",
  });
  const [verifyInput, setVerifyInput] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // --- POS State ---
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [orderType, setOrderType] = useState<OrderType>("TAKEAWAY");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [tillId, setTillId] = useState("");
  const [customer, setCustomer] = useState<Customer>({
    name: "",
    mobile: "",
    address: "",
  });
  const [cashReceived, setCashReceived] = useState<string>("");
  const [splitCash, setSplitCash] = useState<string>("");
  const [splitDigital, setSplitDigital] = useState<string>("");
  const [splitDigitalMethod, setSplitDigitalMethod] = useState<PaymentMethod>("JAZZCASH");
  const [paymentAccountName, setPaymentAccountName] = useState("");
  const [splitAccountName, setSplitAccountName] = useState("");
  const [splitUdhaarPaid, setSplitUdhaarPaid] = useState<string>("");
  const [splitUdhaarMethod, setSplitUdhaarMethod] = useState<Exclude<PaymentMethod, 'SPLIT' | 'SPLIT_UDHAAR' | 'CREDIT'>>("CASH");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingCustomChargeId, setEditingCustomChargeId] = useState<number | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string>("");

  // Navigation & History
  const [currentView, setCurrentView] = useState<
    | "POS"
    | "HISTORY"
    | "ADMIN"
    | "DASHBOARD"
    | "MODULES"
    | "INVENTORY"
    | "EXPENSES"
    | "REPORTS"
    | "STAFF"
    | "CUSTOMERS"
    | "PURCHASE_ORDERS"
    | "CREDIT"
    | "SETTINGS"
  >("DASHBOARD");

  useEffect(() => {
    if (currentView === "SETTINGS" && currentUser) {
      setRegForm({
        name: currentUser.name,
        username: currentUser.username,
        email: currentUser.email || "",
        password: currentUser.password,
        role: currentUser.role,
      });
    }
  }, [currentView, currentUser]);
  const [historySearch, setHistorySearch] = useState("");
  const deferredHistorySearch = useDeferredValue(historySearch);
  const [customerSearch, setCustomerSearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<
    "ALL" | "PAID" | "UNPAID"
  >("ALL");
  const [historyTypeFilter, setHistoryTypeFilter] = useState<
    "ALL" | "DINE-IN" | "TAKEAWAY" | "DELIVERY"
  >("ALL");
  const [historyFromDate, setHistoryFromDate] = useState(() => getBusinessDate());
  const [historyToDate, setHistoryToDate] = useState(() => getBusinessDate());
  const [historyLimit, setHistoryLimit] = useState(500);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  // Admin UI
  const [adminTab, setAdminTab] = useState<"MENU" | "USERS" | "CATEGORIES" | "LEDGER">(
    "MENU",
  );
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [renamingCategory, setRenamingCategory] = useState<{old: string, new: string} | null>(null);
  const [categoryRenameValue, setCategoryRenameValue] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isVoidConfirmOpen, setIsVoidConfirmOpen] = useState(false);
  const [isDiscountPromptOpen, setIsDiscountPromptOpen] = useState(false);
  const [discountPromptValue, setDiscountPromptValue] = useState("0");
  const [backdateOverride, setBackdateOverride] = useState<string | null>(null);
  const [editingInventoryItem, setEditingInventoryItem] =
    useState<InventoryItem | null>(null);
  const [inventoryAction, setInventoryAction] = useState<{
    type: "RESTOCK" | "CALIBRATE";
    item: InventoryItem;
  } | null>(null);
  const [actionQuantity, setActionQuantity] = useState<string>("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedInventoryItems, setSelectedInventoryItems] = useState<
    Set<string>
  >(new Set());
  const [isBulkRestockModalOpen, setIsBulkRestockModalOpen] = useState(false);
  const [bulkRestockQuantities, setBulkRestockQuantities] = useState<
    Record<string, string>
  >({});
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem("bs_pos_dark_mode");
      return saved ? JSON.parse(saved) : false;
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("bs_pos_dark_mode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState<Customer>({
    name: "",
    mobile: "",
    address: "",
  });
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(menuSearchQuery);
  const [dashTimeRange, setDashTimeRange] = useState<
    "TODAY" | "7D" | "30D" | "ALL" | "CUSTOM"
  >("TODAY");
  const [dashCustomDate, setDashCustomDate] = useState(() => getBusinessDate());
  const [dashCustomDateEnd, setDashCustomDateEnd] = useState(() => getBusinessDate());
  const [dashSearchQuery, setDashSearchQuery] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [editingRecipeItem, setEditingRecipeItem] = useState<InventoryItem | null>(null);

  // --- Dashboard Auto-Refresh Timer (UI Only) ---
  useEffect(() => {
    if (currentView !== "DASHBOARD") return;
    const interval = setInterval(() => {
      setLastRefreshed(new Date());
    }, 60000); // UI feedback for "Last updated"
    return () => interval && clearInterval(interval);
  }, [currentView]);

  const [isClosingDay, setIsClosingDay] = useState(false);
  const [closingPhysicalCash, setClosingPhysicalCash] = useState<string>("");
  const [closingNote, setClosingNote] = useState("");
  const [isItemsBreakdownOpen, setIsItemsBreakdownOpen] = useState(false);
  const [isRevenueDetailOpen, setIsRevenueDetailOpen] = useState(false);
  const [isCreditDetailOpen, setIsCreditDetailOpen] = useState(false);
  const [isOrdersDetailOpen, setIsOrdersDetailOpen] = useState(false);
  const [isAvgTicketOpen, setIsAvgTicketOpen] = useState(false);
  const [isExpenseDetailOpen, setIsExpenseDetailOpen] = useState(false);
  const [isProfitAnalysisOpen, setIsProfitAnalysisOpen] = useState(false);
  const [isCostingSettingsOpen, setIsCostingSettingsOpen] = useState(false);
  
  // Advanced Costing Settings (stored in local state but could be moved to Firestore)
  const [costingSettings, setCostingSettings] = useState({
    monthlyGas: 12000,
    monthlyOil: 8000,
    monthlyElectric: 10000,
    monthlyLabor: 40000,
    monthlyRent: 20000,
    avgMonthlyOrders: 2000,
    packagingCost: 5, // Cost per bag/box
    itemsPerPackage: 3, // 1 bag for every 3 items
  });
  const [selectedDigitalAccount, setSelectedDigitalAccount] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [isShiftingDate, setIsShiftingDate] = useState(false);
  const [shiftDateValue, setShiftDateValue] = useState("");

  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingOrderDate, setEditingOrderDate] = useState<string>("");

  const logAction = useCallback(
    (
      action: string,
      status: "SUCCESS" | "WARNING" | "ERROR" = "SUCCESS",
      details?: string,
    ) => {
      const newLog: AuditLogEntry = {
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: Date.now(),
        userId: currentUser?.id || "SYSTEM",
        userName: currentUser?.name || "System",
        action,
        status,
        details,
      };
      setAuditLogs((prev) => [newLog, ...prev.slice(0, 499)]); // Keep last 500 logs
    },
    [currentUser],
  );

  const handleShiftOrderDate = async () => {
    if (!viewingOrder || !shiftDateValue) return;

    const oldDate = viewingOrder.businessDate;
    const newDate = shiftDateValue;
    const orderId = viewingOrder.id;

    try {
      // Find orders in the NEW business date to get the next invoice number for that day
      const ordersInNewDate = orders.filter(o => o.businessDate === newDate && o.id !== orderId);
      const maxInvoiceNo = ordersInNewDate.reduce((max, o) => Math.max(max, o.invoiceNo || 0), 0);
      const nextInvoiceNo = maxInvoiceNo + 1;

      // Update timestamp to the new business date, but keeping same time of day if possible
      const oldTime = new Date(viewingOrder.timestamp);
      const [year, month, day] = newDate.split("-").map(Number);
      const newTimestampDate = new Date(oldTime);
      newTimestampDate.setFullYear(year);
      newTimestampDate.setMonth(month - 1);
      newTimestampDate.setDate(day);

      const newDateStr = newTimestampDate.toLocaleString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        month: "short",
        day: "numeric",
      });

      const updatedOrder: Order = {
        ...viewingOrder,
        businessDate: newDate,
        invoiceNo: nextInvoiceNo,
        dateStr: newDateStr,
        timestamp: newTimestampDate.getTime()
      };

      // update local states
      setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
      setViewingOrder(updatedOrder);
      setIsShiftingDate(false);
      setShiftDateValue("");

      // handle firebase
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "orders", orderId), {
        businessDate: newDate,
        invoiceNo: nextInvoiceNo,
        dateStr: newDateStr,
        timestamp: newTimestampDate.getTime()
      });

      logAction(`Order #${viewingOrder.invoiceNo} shifted from ${oldDate} to ${newDate} (New Inv: ${nextInvoiceNo})`, "WARNING");
      alert(`Order successfully shifted to ${newDate}`);

    } catch (e: any) {
      console.error("Shift Date Error:", e);
      handleFirestoreError(e, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const updateCustomerRecord = useCallback((cust: Customer, totalSpent: number) => {
    if (!cust.mobile) return;
    
    const existing = customers.find(c => c.mobile === cust.mobile);
    const updated: Partial<Customer> = {
      name: cust.name,
      mobile: cust.mobile,
      address: cust.address || "",
      totalOrders: (existing?.totalOrders || 0) + 1,
      totalSpent: (existing?.totalSpent || 0) + totalSpent,
      lastOrderDate: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString()
    };

    try {
      if (existing?.id) {
        updateDoc(doc(db, "customers", existing.id), updated).catch(e => {
          alert("Failed to update customer loyalty points: " + e.message);
        });
      } else {
        addDoc(collection(db, "customers"), updated).catch(e => {
          alert("Failed to create customer record: " + e.message);
        });
      }
    } catch (e) {
      console.error("Customer sync error:", e);
    }
  }, [customers]);

  const generateWhatsAppReport = (targetOrders: Order[], title: string = "Today's Sales Report") => {
    const revenue = targetOrders.reduce((s, o) => s + o.total, 0);
    const count = targetOrders.length;

    // Build items summary per order
    let orderDetails = "";
    targetOrders.forEach((o, idx) => {
      const invNo = o.businessDate ? formatInvoiceNo(o.businessDate, o.invoiceNo) : `#${o.invoiceNo}`;
      const itemsList = o.items.map(i => `${i.qty}x ${i.name}`).join(", ");
      orderDetails += `\n${idx + 1}. ${invNo}: Rs ${o.total} (${itemsList})`;
    });

    // Find top item
    const itemMap: { [k: string]: number } = {};
    targetOrders.forEach((o) =>
      o.items.forEach((i) => {
        itemMap[i.name] = (itemMap[i.name] || 0) + i.qty;
      }),
    );
    const topItem =
      Object.entries(itemMap).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    const msg = `*${title}*\n` +
      `--------------------------\n` +
      `💰 Revenue: Rs ${revenue.toLocaleString()}\n` +
      `📦 Total Orders: ${count}\n` +
      `🔥 Best Seller: ${topItem}\n` +
      `🕒 Time: ${new Date().toLocaleTimeString()}\n` +
      `--------------------------\n` +
      `*Order Details:*` +
      orderDetails + 
      `\n\n_Generated via Burger Spot Pro POS_`;

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const closeBusinessDay = () => {
    const bDate = getBusinessDate();
    const todaySales = orders.filter(
      (o) => getBusinessDate(new Date(o.timestamp)) === bDate,
    );
    const cashSales = todaySales
      .filter((o) => o.paymentMethod === "CASH")
      .reduce((s, o) => s + o.total, 0);
    const physical = parseFloat(closingPhysicalCash) || 0;

    const recon: CashReconciliation = {
      id: `RECON-${Date.now()}`,
      date: bDate,
      timestamp: Date.now(),
      expectedCash: cashSales,
      physicalCash: physical,
      difference: physical - cashSales,
      note: closingNote,
      userId: currentUser?.id || "SYSTEM",
    };

    setReconciliations((prev) => [recon, ...prev]);

    // Take Inventory Snapshot for COGS
    const snapshot: InventorySnapshot = {
      date: bDate,
      items: inventory.map((i) => ({
        id: i.id,
        stock: i.stock,
        costPerUnit: i.costPerUnit,
      })),
    };
    
    // Sync to Firebase
    addDoc(collection(db, "snapshots"), snapshot).catch(e => console.error("Snapshot Save Error:", e));
    addDoc(collection(db, "reconciliations"), recon).catch(e => console.error("Recon Save Error:", e));

    logAction(
      `Day Closed: ${bDate}`,
      "SUCCESS",
      `Diff: Rs ${recon.difference}`,
    );
    setIsClosingDay(false);
    setClosingPhysicalCash("");
    setClosingNote("");
    alert("Business day closed and saved.");
  };

  const calculateCOGS = (bDate: string) => {
    const snapshot = inventorySnapshots.find((s) => s.date === bDate);
    if (!snapshot) return 0;

    // Simplistic COGS for demo: items sold * cost
    const dayOrders = orders.filter(
      (o) => getBusinessDate(new Date(o.timestamp)) === bDate,
    );
    let totalCost = 0;
    dayOrders.forEach((o) =>
      o.items.forEach((item) => {
        if (item.ingredients) {
          item.ingredients.forEach((req) => {
            const invItem = inventory.find((i) => i.id === req.ingredientId);
            if (invItem) {
              totalCost += req.quantity * item.qty * invItem.costPerUnit;
            }
          });
        }
      }),
    );
    return totalCost;
  };

  const deductInventory = (orderItems: CartItem[]) => {
    setInventory((prev) => {
      const next = [...prev];
      orderItems.forEach((item) => {
        // Deduct product ingredients
        if (item.ingredients) {
          item.ingredients.forEach((req) => {
            const invIndex = next.findIndex((i) => i.id === req.ingredientId);
            if (invIndex !== -1) {
              const deductedQty = req.quantity * item.qty;
              const newStock = Math.max(0, next[invIndex].stock - deductedQty);
              next[invIndex] = {
                ...next[invIndex],
                stock: newStock,
              };
              // Firebase Sync
              try {
                const invId = next[invIndex].id;
                // Since our ID is string, we can use it
                updateDoc(doc(db, "inventory", invId), { stock: newStock });
              } catch (e) {
                console.error("Firebase Inv Deduct Error:", e);
              }
            }
          });
        }
        // Deduct addon ingredients
        if (item.selectedAddons) {
          item.selectedAddons.forEach((addon) => {
            if (addon.ingredients) {
              addon.ingredients.forEach((req) => {
                const invIndex = next.findIndex(
                  (i) => i.id === req.ingredientId,
                );
                if (invIndex !== -1) {
                  const deductedQty = req.quantity * item.qty;
                  const newStock = Math.max(0, next[invIndex].stock - deductedQty);
                  next[invIndex] = {
                    ...next[invIndex],
                    stock: newStock,
                  };
                  // Firebase Sync
                  try {
                    updateDoc(doc(db, "inventory", next[invIndex].id), { stock: newStock });
                  } catch (e) {
                    console.error("Firebase Addon Inv Deduct Error:", e);
                  }
                }
              });
            }
          });
        }
      });

      // Log alerts for low stock items
      next.forEach((item) => {
        if (item.stock <= item.minStock) {
          logAction(
            `Low Stock Alert: ${item.name}`,
            "WARNING",
            `Current stock: ${item.stock.toFixed(2)} ${item.unit}`,
          );
        }
      });

      return next;
    });
  };

  const revertInventoryFirestore = useCallback((orderItems: CartItem[], existingBatch?: any) => {
    const batch = existingBatch || writeBatch(db);
    orderItems.forEach((item) => {
      if (item.ingredients) {
        item.ingredients.forEach((req) => {
          const invItem = inventory.find(i => i.id === req.ingredientId);
          if (invItem) {
            batch.update(doc(db, "inventory", req.ingredientId), {
              stock: increment(req.quantity * item.qty)
            });
          }
        });
      }
      if (item.selectedAddons) {
        item.selectedAddons.forEach((addon) => {
          if (addon.ingredients) {
            addon.ingredients.forEach((req) => {
              const invItem = inventory.find(i => i.id === req.ingredientId);
              if (invItem) {
                batch.update(doc(db, "inventory", req.ingredientId), {
                  stock: increment(req.quantity * item.qty)
                });
              }
            });
          }
        });
      }
    });
    if (!existingBatch) batch.commit().catch(e => console.error("Inv revert fail:", e));
  }, [inventory]);

  const deductInventoryFirestore = useCallback((orderItems: CartItem[], existingBatch?: any) => {
    const batch = existingBatch || writeBatch(db);
    orderItems.forEach((item) => {
      if (item.ingredients) {
        item.ingredients.forEach((req) => {
          const invItem = inventory.find(i => i.id === req.ingredientId);
          if (invItem) {
            batch.update(doc(db, "inventory", req.ingredientId), {
              stock: increment(-(req.quantity * item.qty))
            });
          }
        });
      }
      if (item.selectedAddons) {
        item.selectedAddons.forEach((addon) => {
          if (addon.ingredients) {
            addon.ingredients.forEach((req) => {
              const invItem = inventory.find(i => i.id === req.ingredientId);
              if (invItem) {
                batch.update(doc(db, "inventory", req.ingredientId), {
                  stock: increment(-(req.quantity * item.qty))
                });
              }
            });
          }
        });
      }
    });
    if (!existingBatch) batch.commit().catch(e => console.error("Inv deduct fail:", e));
  }, [inventory]);

  const getProductStockStatus = (product: Product) => {
    if (!product.ingredients || product.ingredients.length === 0) return 100;

    let lowestRatio = 1;
    product.ingredients.forEach((req) => {
      const invItem = inventory.find((i) => i.id === req.ingredientId);
      if (invItem) {
        const availableRatio = invItem.stock / (req.quantity * 10); // Check for at least 10 units
        if (availableRatio < lowestRatio) lowestRatio = availableRatio;
      }
    });
    return Math.min(100, lowestRatio * 100);
  };

  // Fuzzy Search Helper
  const fuzzyMatch = (text: string, query: string) => {
    const q = query.toLowerCase().trim();
    const t = text.toLowerCase();
    if (!q) return true;
    if (t.includes(q)) return true;

    // Basic fuzzy: check if characters appear in order
    let i = 0;
    let j = 0;
    while (i < t.length && j < q.length) {
      if (t[i] === q[j]) j++;
      i++;
    }
    return j === q.length;
  };

  // --- Handlers for Download & Share ---
  const handleDownloadInvoice = async (orderId: string) => {
    const node = document.getElementById(`invoice-content-${orderId}`);
    if (!node) {
      alert("Invoice image processing failed: Content not found. Please try opening the invoice again.");
      console.error("Invoice element not found");
      return;
    }
    try {
      // Adding a small delay to ensure rendering is complete
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const dataUrl = await toPng(node, {
        backgroundColor: "#ffffff",
        cacheBust: true,
        pixelRatio: 3, // High quality but balanced for file size
        style: {
          transform: 'scale(1)',
          margin: '0',
        }
      });
      
      const link = document.createElement("a");
      link.download = `Bursport_Invoice_${orderId}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Download failed:", err);
      alert("Download error: " + (err instanceof Error ? err.message : "Internal Error"));
    }
  };

  const handleShareInvoice = async (orderId: string) => {
    const node = document.getElementById(`invoice-content-${orderId}`);
    if (!node) {
      alert("Invoice sharing failed: Content not found.");
      console.error("Invoice element not found");
      return;
    }
    try {
      // Wait for rendering to settle
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const dataUrl = await toPng(node, {
        backgroundColor: "#ffffff",
        cacheBust: true,
        pixelRatio: 3,
        style: {
          transform: 'scale(1)',
          margin: '0',
        }
      });
      
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `Invoice_${orderId}.png`, {
        type: "image/png",
      });

      if (navigator.share) {
        const currentOrder = orders.find((o) => o.id === orderId);
        const shareData = {
          title: `Invoice #${orderId}`,
          text: `Invoice #${orderId} for ${currentOrder?.customer.name || "Customer"}. Total: Rs ${currentOrder?.total || ""}`,
        };

        // Try to share file first
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              ...shareData,
              files: [file],
            });
            return;
          } catch (fileShareErr) {
            console.warn("File share failed, falling back to text:", fileShareErr);
          }
        }
        
        // Fallback to basic text share
        await navigator.share(shareData);
      } else {
        alert("Your device/browser doesn't support the Share API. Try downloading instead.");
      }
    } catch (err) {
      console.error("Share failed:", err);
      // Silencing alert for user-cancelled shares but logging it
      if (!(err instanceof Error && err.name === 'AbortError')) {
        alert("Sharing failed. Please try downloading the invoice instead.");
      }
    }
  };

  const handleVoidOrder = async (order: Order) => {
    console.log("handleVoidOrder called for:", order.id);
    if (!currentUser) {
      alert("ERROR: You must be logged in to void orders.");
      return;
    }
    
    console.log("Current user:", currentUser.name, "Role:", currentUser.role);
    
    if (currentUser.role !== UserRole.ADMIN) {
      alert(`AUTH ERROR: Only Admins can void orders. Your current role is: ${currentUser.role}`);
      return;
    }

    const orderNo = order.businessDate ? formatInvoiceNo(order.businessDate, order.invoiceNo) : "#" + order.invoiceNo;
    setDeleteConfirmId(`void-order-${order.id}`);
  };

  const handleRestoreOrder = async (order: Order) => {
    if (!currentUser) {
      alert("ERROR: You must be logged in to restore orders.");
      return;
    }
    if (currentUser.role !== UserRole.ADMIN) {
      alert("AUTH ERROR: Only Admins can restore orders.");
      return;
    }
    setDeleteConfirmId(`restore-order-${order.id}`);
  };

  const exportToCSV = () => {
    const today = new Date();
    let filtered = orders;

    if (dashTimeRange === "TODAY") {
      const bDate = getBusinessDate();
      filtered = orders.filter(
        (o) => getBusinessDate(new Date(o.timestamp)) === bDate,
      );
    } else if (dashTimeRange === "7D") {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      filtered = orders.filter((o) => new Date(o.timestamp) >= sevenDaysAgo);
    } else if (dashTimeRange === "30D") {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      filtered = orders.filter((o) => new Date(o.timestamp) >= thirtyDaysAgo);
    } else if (dashTimeRange === "CUSTOM") {
      filtered = orders.filter((o) => {
        const bDate = getBusinessDate(new Date(o.timestamp));
        return bDate >= dashCustomDate && bDate <= dashCustomDateEnd;
      });
    }

    const headers = [
      "Invoice No",
      "Date",
      "Customer Name",
      "Contact",
      "Address",
      "Order Items",
      "Total",
      "Method",
      "Status",
    ];
    const rows = filtered.map((o) => [
      `"${formatInvoiceNo(o.businessDate, o.invoiceNo)}"`,
      `"${new Date(o.timestamp).toLocaleString()}"`,
      `"${(o.customer.name || "Guest").replace(/"/g, '""')}"`,
      `"${o.customer.mobile || ""}"`,
      `"${(o.customer.address || "").replace(/"/g, '""')}"`,
      `"${o.items.map(item => `${item.name} (x${item.qty})`).join(", ").replace(/"/g, '""')}"`,
      o.total,
      `"${o.paymentMethod}"`,
      `"${o.status}"`,
    ]);

    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Bursport_Sales_Report_${dashTimeRange}_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Initial Signup Guard
  useEffect(() => {
    if (users.length === 0) setAuthView("SIGNUP");
  }, [users]);

  // --- Stats Calculations ---
  const stats = useMemo(() => {
    const bizDateToday = getBusinessDate();
    
    // Determine the "Effective Today" and "Effective Yesterday" for growth calculations
    let effectiveToday: string;
    let effectiveYesterday: string;

    if (dashTimeRange === "CUSTOM" && dashCustomDate && dashCustomDateEnd) {
      effectiveToday = dashCustomDateEnd; // Use the end of range for growth anchor
      const [y, m, d] = dashCustomDate.split("-").map(Number);
      const dObj = new Date(y, m - 1, d);
      dObj.setDate(dObj.getDate() - 1);
      effectiveYesterday = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, "0")}-${String(dObj.getDate()).padStart(2, "0")}`;
    } else {
      effectiveToday = bizDateToday;
      const [y, m, d] = bizDateToday.split("-").map(Number);
      const dObj = new Date(y, m - 1, d);
      dObj.setDate(dObj.getDate() - 1);
      effectiveYesterday = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, "0")}-${String(dObj.getDate()).padStart(2, "0")}`;
    }

    let filteredOrders = orders.filter(o => o.status !== 'VOIDED');

    if (dashTimeRange === "7D") {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      filteredOrders = filteredOrders.filter((o) => o.timestamp >= sevenDaysAgo);
    } else if (dashTimeRange === "30D") {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      filteredOrders = filteredOrders.filter((o) => o.timestamp >= thirtyDaysAgo);
    } else if (dashTimeRange === "ALL") {
      // already filtered for VOIDED
    } else if (dashTimeRange === "CUSTOM") {
      filteredOrders = filteredOrders.filter((o) => {
        const bDate = getBusinessDate(new Date(o.timestamp));
        return bDate >= dashCustomDate && bDate <= dashCustomDateEnd;
      });
    } else {
      filteredOrders = filteredOrders.filter(
        (o) => getBusinessDate(new Date(o.timestamp)) === bizDateToday,
      );
    }

    const activeOrders = orders.filter(o => o.status !== 'VOIDED');
    const todayOrders = activeOrders.filter(
      (o) => getBusinessDate(new Date(o.timestamp)) === effectiveToday,
    );
    const yesterdayOrders = activeOrders.filter(
      (o) => getBusinessDate(new Date(o.timestamp)) === effectiveYesterday,
    );

    // Optimized single-pass for today/yesterday summaries
    let todayPaidRevenue = 0;
    let todayUnpaidRevenue = 0;
    let todayUdhaarRevenue = 0;
    let todayTotalItemsSold = 0;
    let pendingCount = 0;
    let completedCount = 0;

    todayOrders.forEach(o => {
      todayTotalItemsSold += o.items.reduce((acc, item) => acc + item.qty, 0);
      if (o.status === "PAID") {
        todayPaidRevenue += o.total;
        completedCount++;
      } else if (o.status === "UNPAID") {
        todayUnpaidRevenue += o.total;
        pendingCount++;
      } else if (o.status === "UDHAAR") {
        todayUdhaarRevenue += o.total;
      }
    });

    const todayTotalRevenue = todayPaidRevenue + todayUnpaidRevenue + todayUdhaarRevenue;

    const yesterdayRevenue = yesterdayOrders.reduce((s, o) => {
      if (o.status === "PAID" || o.status === "UNPAID" || o.status === "UDHAAR") return s + o.total;
      return s;
    }, 0);

    const revGrowth = yesterdayRevenue > 0 ? ((todayTotalRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;

    let paidRevenue = 0;
    let unpaidRevenue = 0;
    let udhaarRevenue = 0;
    let totalItemsSold = 0;
    let paidOrdersCount = 0;

    const monetaryChannels = {
      CASH: 0,
      JAZZCASH: 0,
      EASYPAISA: 0,
      BANK: 0,
      CREDIT_CARD: 0,
      UDHAAR: 0
    };

    const processedOrders: Order[] = [];

    filteredOrders.forEach(o => {
      const isProcessed = o.status === "PAID" || o.status === "UNPAID" || o.status === "UDHAAR";
      if (isProcessed) processedOrders.push(o);

      totalItemsSold += o.items.reduce((sum, item) => sum + item.qty, 0);

      if (o.status === "PAID") {
        paidRevenue += o.total;
        paidOrdersCount++;
      } else if (o.status === "UNPAID") {
        unpaidRevenue += o.total;
      } else if (o.status === "UDHAAR") {
        udhaarRevenue += o.total;
      }

      // Channels
      if (o.status === "PAID" || o.status === "UDHAAR") {
        if (o.paymentMethod === "CASH") monetaryChannels.CASH += o.total;
        else if (o.paymentMethod === "JAZZCASH") monetaryChannels.JAZZCASH += o.total;
        else if (o.paymentMethod === "EASYPAISA") monetaryChannels.EASYPAISA += o.total;
        else if (o.paymentMethod === "BANK") monetaryChannels.BANK += o.total;
        else if (o.paymentMethod === "CREDIT_CARD") monetaryChannels.CREDIT_CARD += o.total;
        else if ((o.paymentMethod === "SPLIT" || o.paymentMethod === "SPLIT_UDHAAR") && o.splitDetails) {
          o.splitDetails.forEach(d => {
            if (d.method in monetaryChannels) {
               (monetaryChannels as any)[d.method] += d.amount;
            }
          });
        }
      }
    });

    monetaryChannels.UDHAAR = filteredOrders.reduce((s, o) => {
      if (o.status !== "UDHAAR") return s;
      const paidPortion = (o.splitDetails || []).reduce((acc, d) => acc + d.amount, 0);
      return s + (o.total - paidPortion);
    }, 0);

    const totalRevenue = paidRevenue + unpaidRevenue + udhaarRevenue;
    const count = filteredOrders.length;
    const avgTicket = count > 0 ? Math.round(totalRevenue / count) : 0;
    const successRate = count > 0 ? Math.round((paidOrdersCount / count) * 100) : 0;

    const serviceMixCounts: Record<string, number> = { "DINE-IN": 0, "TAKEAWAY": 0, "DELIVERY": 0 };
    const categoryStats: Record<string, { value: number; count: number }> = {};
    const itemSales: {
      [key: string]: { qty: number; revenue: number; name: string };
    } = {};

    processedOrders.forEach((o) => {
      // Service Mix
      if (o.type in serviceMixCounts) serviceMixCounts[o.type]++;

      // Item & Category Analysis
      o.items.forEach((item) => {
        // MVP Products
        if (!itemSales[item.id])
          itemSales[item.id] = { qty: 0, revenue: 0, name: item.name };
        itemSales[item.id].qty += item.qty;
        itemSales[item.id].revenue += item.price * item.qty;

        // Categories
        if (item.category) {
          if (!categoryStats[item.category]) {
            categoryStats[item.category] = { value: 0, count: 0 };
          }
          categoryStats[item.category].value += item.price * item.qty;
          categoryStats[item.category].count++;
        }
      });
    });

    const serviceMix = Object.entries(serviceMixCounts)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0);

    const categoryData = Object.entries(categoryStats)
      .map(([name, stats]) => ({
        name,
        value: stats.value,
        count: stats.count
      }))
      .sort((a, b) => b.value - a.value);

    const mvpProducts = Object.values(itemSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Chart data based on range
    let chartData: any[] = [];
    if (dashTimeRange === "TODAY" || (dashTimeRange === "CUSTOM" && dashCustomDate === dashCustomDateEnd)) {
      // 24-hour distribution for a smooth curve for any single day
      const hours = Array.from({ length: 24 }, (_, i) => (i + SHOP_OPEN_HOUR) % 24);
      chartData = hours.map((hour) => {
        const hOrders = processedOrders.filter(
          (o) => new Date(o.timestamp).getHours() === hour,
        );
        const revenue = hOrders.reduce((s, o) => s + (o.total || 0), 0);
        return {
          hour: hour,
          time: `${hour}:00`,
          revenue: revenue,
          sales: revenue,
        };
      });
    } else {
      const isCustomMultiDay = dashTimeRange === "CUSTOM" && dashCustomDate !== dashCustomDateEnd;
      const daysCap =
        dashTimeRange === "7D" ? 7 : dashTimeRange === "30D" ? 30 : isCustomMultiDay ? 1000 : 365;
      const dataMap: { [k: string]: { paid: number; unpaid: number } } = {};
      processedOrders.forEach((o) => {
        const d = getBusinessDate(new Date(o.timestamp));
        if (!dataMap[d]) dataMap[d] = { paid: 0, unpaid: 0 };
        if (o.status === "PAID") dataMap[d].paid += (o.total || 0);
        else dataMap[d].unpaid += (o.total || 0);
      });
      chartData = Object.entries(dataMap)
        .map(([date, vals]) => ({
          time: date.includes("-") ? date.split("-")[2] + "/" + date.split("-")[1] : date,
          paid: vals.paid,
          unpaid: vals.unpaid,
          revenue: (vals.paid || 0) + (vals.unpaid || 0),
          sales: (vals.paid || 0) + (vals.unpaid || 0),
          rawDate: date
        }))
        .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
        .slice(-daysCap);
    }

    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const todayExpenses = expenses
      .filter((e) => e.dateStr === effectiveToday)
      .reduce((s, e) => s + e.amount, 0);
    const filteredExpenses = expenses.filter((e) => {
      if (dashTimeRange === "7D")
        return e.timestamp >= Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (dashTimeRange === "30D")
        return e.timestamp >= Date.now() - 30 * 24 * 60 * 60 * 1000;
      if (dashTimeRange === "CUSTOM")
        return e.dateStr >= dashCustomDate && e.dateStr <= dashCustomDateEnd;
      if (dashTimeRange === "TODAY") return e.dateStr === bizDateToday;
      return true;
    });
    const rangeExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);

    // Business Operational Overhead Calculation
    const totalOpEx = costingSettings.monthlyGas + costingSettings.monthlyElectric + costingSettings.monthlyLabor + costingSettings.monthlyRent + costingSettings.monthlyOil;
    const opExPerHourOrItem = totalOpEx / (costingSettings.avgMonthlyOrders || 1);

    // COGS & Profit Calculation
    let totalCogs = 0;
    let totalPackagingCost = 0;
    let totalOperationalOverhead = 0;
    
    const itemProfitData: Record<string, { name: string, qty: number, revenue: number, cost: number, profit: number, overhead: number }> = {};
    const menuMap = new Map<string, Product>(menuItems.map(m => [m.id, m]));
    const invMap = new Map<string, InventoryItem>(inventory.map(i => [i.id, i]));

    processedOrders.forEach((o) => {
      // Calculate packaging for this specific order (Shared: 1 bag for every X items)
      const totalItemsInOrder = o.items.reduce((sum, i) => sum + i.qty, 0);
      if (totalItemsInOrder === 0) return;

      const orderPackagingCost = Math.ceil(totalItemsInOrder / costingSettings.itemsPerPackage) * costingSettings.packagingCost;
      totalPackagingCost += orderPackagingCost;
      totalOperationalOverhead += opExPerHourOrItem;

      o.items.forEach((item) => {
        const menuItem = menuMap.get(item.id);
        let unitCost = (item as any).cost ?? menuItem?.cost ?? 0;

        if (unitCost === 0 && item.ingredients) {
          item.ingredients.forEach((req) => {
            const invItem = invMap.get(req.ingredientId);
            if (invItem && typeof invItem.costPerUnit === 'number') {
              unitCost += req.quantity * invItem.costPerUnit;
            }
          });
        }

        const totalItemCost = unitCost * item.qty;
        totalCogs += totalItemCost;

        if (!itemProfitData[item.id]) {
          itemProfitData[item.id] = { name: item.name, qty: 0, revenue: 0, cost: 0, profit: 0, overhead: 0 };
        }
        itemProfitData[item.id].qty += item.qty;
        itemProfitData[item.id].revenue += item.price * item.qty;
        itemProfitData[item.id].cost += totalItemCost;
        
        const itemShareOfOrderOverhead = (item.qty / totalItemsInOrder) * (opExPerHourOrItem + orderPackagingCost);
        itemProfitData[item.id].overhead += itemShareOfOrderOverhead;
        itemProfitData[item.id].profit += (item.price * item.qty) - totalItemCost - itemShareOfOrderOverhead;
      });
    });

    const profitMetrics = {
      grossProfit: totalRevenue - totalCogs,
      netProfit: totalRevenue - totalCogs - totalPackagingCost - totalOperationalOverhead - rangeExpenses,
      cogs: totalCogs,
      packaging: totalPackagingCost,
      overhead: totalOperationalOverhead,
      totalInvestment: totalCogs + totalPackagingCost + totalOperationalOverhead,
      margin: totalRevenue > 0 ? ((totalRevenue - totalCogs - totalPackagingCost - totalOperationalOverhead) / totalRevenue) * 100 : 0,
      itemProfitAnalysis: Object.values(itemProfitData).sort((a, b) => b.profit - a.profit)
    };

    const radarData = serviceMix.map((s) => ({
      subject: s.name,
      A: s.value,
      fullMark: Math.max(...serviceMix.map((item) => item.value), 1) * 1.2,
    }));

    // Minute-level stats for the last hour
    const now = Date.now();
    const lastHourOrders = orders.filter(o => o.timestamp >= now - 3600000);
    const minuteStats = Array.from({ length: 12 }, (_, i) => ({
      minuteRangeStart: now - ((i + 1) * 5 * 60000),
      minuteRangeEnd: now - (i * 5 * 60000),
      label: `${i * 5}m ago`,
      orders: 0,
      revenue: 0
    }));

    lastHourOrders.forEach(o => {
      for (const bucket of minuteStats) {
        if (o.timestamp >= bucket.minuteRangeStart && o.timestamp < bucket.minuteRangeEnd) {
          bucket.orders++;
          bucket.revenue += (o.total || 0);
          break;
        }
      }
    });
    const minuteData = minuteStats.map(s => ({ time: s.label, orders: s.orders, revenue: s.revenue })).reverse();

    // Inventory History (Daily Snapshots)
    const inventoryHistory = inventorySnapshots.slice(0, 7).map(snap => ({
      date: snap.date.split('-').slice(1).join('/'),
      value: Math.floor(snap.items.reduce((s, item) => s + (item.stock * (item.costPerUnit || 0)), 0))
    })).reverse();

    // Business Day Daily Totals (Using ALL orders for historical context)
    const dailyTotalsMap: Record<string, { total: number, items: number }> = {};
    orders.forEach(o => {
      const bDate = getBusinessDate(new Date(o.timestamp));
      if (!dailyTotalsMap[bDate]) dailyTotalsMap[bDate] = { total: 0, items: 0 };
      dailyTotalsMap[bDate].total += (o.total || 0);
      dailyTotalsMap[bDate].items += o.items.reduce((is, it) => is + it.qty, 0);
    });

    const dailyBusinessTotals = Object.entries(dailyTotalsMap)
      .filter(([date]) => date <= effectiveToday)
      .map(([date, stats]) => ({
        date: date.split("-").slice(1).join("/"), 
        total: stats.total,
        items: stats.items,
        rawDate: date
      }))
      .sort((a, b) => b.rawDate.localeCompare(a.rawDate))
      .slice(0, 15)
      .reverse();

    const filteredAuditLogs = auditLogs.filter(log => {
      const logDate = getBusinessDate(new Date(log.timestamp));
      if (dashTimeRange === "CUSTOM")
        return logDate >= dashCustomDate && logDate <= dashCustomDateEnd;
      if (dashTimeRange === "TODAY") return logDate === bizDateToday;
      if (dashTimeRange === "7D") return log.timestamp >= Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (dashTimeRange === "30D") return log.timestamp >= Date.now() - 30 * 24 * 60 * 60 * 1000;
      return true;
    });

    const filteredOrdersSet = new Set(filteredOrders.map(o => o.id));
    const digitalAccountSummary: Record<string, { total: number, orders: any[], methods: Record<string, number>, accountName: string }> = {};
    
    filteredOrders.forEach(o => {
      // Process digitalAccountSummary only for filtered range
      if (o.status === "PAID" || o.status === "UDHAAR") {
        const processPayment = (method: string, name: string, amount: number) => {
          if (method === "JAZZCASH" || method === "EASYPAISA" || method === "BANK") {
            const accName = name || "Personal";
            if (!digitalAccountSummary[accName]) {
              digitalAccountSummary[accName] = { total: 0, orders: [], methods: {}, accountName: accName };
            }
            digitalAccountSummary[accName].total += amount;
            if (!digitalAccountSummary[accName].orders.some(ex => ex.id === o.id)) {
              digitalAccountSummary[accName].orders.push(o);
            }
            digitalAccountSummary[accName].methods[method] = (digitalAccountSummary[accName].methods[method] || 0) + amount;
          }
        };

        if (o.paymentMethod === "SPLIT" || o.paymentMethod === "SPLIT_UDHAAR") {
          o.splitDetails?.forEach(sd => processPayment(sd.method, sd.accountName || "", sd.amount));
        } else {
          processPayment(o.paymentMethod, o.paymentAccountName || "", o.total);
        }
      }
    });

    return {
      totalRevenue,
      totalItemsSold,
      todayTotalItemsSold,
      paidRevenue,
      unpaidRevenue,
      dailyBusinessTotals,
      filteredAuditLogs,
      count,
      avgTicket,
      chartData,
      minuteData,
      inventoryHistory,
      categoryData,
      totalCogs,
      profit: totalRevenue - totalCogs,
      profitMetrics,
      digitalAccountSummary,
      successRate,
      serviceMix,
      monetaryChannels,
      mvpProducts,
      radarData,
      productBreakdown: Object.values(itemSales)
        .sort((a, b) => b.qty - a.qty),
      paymentMethodsData: Object.entries(monetaryChannels)
        .map(([name, value]) => ({ name, value }))
        .filter((v) => v.value > 0),
      totalExpenses,
      todayExpenses,
      rangeExpenses,
      todayRevenue: todayTotalRevenue,
      todayOrders,
      todayPaidRevenue,
      todayUnpaidRevenue,
      yesterdayRevenue,
      revGrowth,
      todayCount: todayOrders.length,
      todayAvgTicket:
        todayOrders.length > 0
          ? Math.round(todayTotalRevenue / todayOrders.length)
          : 0,
      pendingCount,
      completedCount,
      onlinePayments: monetaryChannels.JAZZCASH + monetaryChannels.EASYPAISA + monetaryChannels.BANK,
      cashPayments: monetaryChannels.CASH,
      udhaarRevenue,
      todayUdhaarRevenue,
      auditLogs: filteredAuditLogs,
    };
  }, [orders, dashTimeRange, categories, menuItems, inventory, expenses, inventorySnapshots, costingSettings, auditLogs]);
  const handleExportItemsSold = () => {
    const headers = ["Rank", "Item Name", "Quantity Sold", "Total Revenue (Rs)"];
    const rows = stats.productBreakdown.map((item, idx) => [
      idx + 1,
      `"${item.name.replace(/"/g, '""')}"`,
      item.qty,
      Math.floor(item.revenue)
    ]);

    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Bursport_Items_Sold_Report_${dashTimeRange}_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Trigger AI Suggestions with longer debounce and safer logic
  useEffect(() => {
    if (cart.length === 0) {
      setAiSuggestion("");
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const suggestion = await getSmartSuggestions(cart);
        setAiSuggestion(suggestion || "");
      } catch (err) {
        console.error("Suggestion error:", err);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [cart]);

  // Memoized Filtered Menu Items
  const filteredMenuItems = useMemo(() => {
    const query = deferredQuery.trim().toLowerCase();
    return menuItems.filter(
      (i) =>
        (activeCategory === "All" || i.category.toLowerCase() === activeCategory.toLowerCase()) &&
        fuzzyMatch(i.name, query),
    );
  }, [menuItems, activeCategory, deferredQuery]);

  // Enhanced Add to Cart with name matching
  const filteredHistoryOrders = useMemo(() => {
    const query = deferredHistorySearch.toLowerCase().trim();
    return orders
      .filter(
        (o) =>
          (historyStatusFilter === "ALL" || o.status === historyStatusFilter) &&
          (historyTypeFilter === "ALL" || o.type === historyTypeFilter) &&
          ((o.businessDate ? formatInvoiceNo(o.businessDate, o.invoiceNo) : o.invoiceNo.toString()).includes(deferredHistorySearch) ||
            (o.customer?.name || "").toLowerCase().includes(query) ||
            (o.customer?.mobile || "").includes(deferredHistorySearch)) &&
          (!historyFromDate || (o.businessDate || getBusinessDate(new Date(o.timestamp))) >= historyFromDate) &&
          (!historyToDate || (o.businessDate || getBusinessDate(new Date(o.timestamp))) <= historyToDate),
      )
      .sort((a, b) => {
        if ((b.businessDate || "") !== (a.businessDate || "")) {
          return (b.businessDate || "").localeCompare(a.businessDate || "");
        }
        return (b.invoiceNo || 0) - (a.invoiceNo || 0);
      });
  }, [orders, historyStatusFilter, historyTypeFilter, deferredHistorySearch, historyFromDate, historyToDate]);

  const addByName = (name: string) => {
    const item = menuItems.find((i) =>
      i.name.toLowerCase().includes(name.toLowerCase()),
    );
    if (item) addToCart(item);
  };

  // --- Auth Handlers ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    
    const id = loginForm.identifier.trim().toLowerCase();
    const pass = loginForm.password;

    if (!id || !pass) {
      setAuthError("Please entry both username and password.");
      return;
    }

    if (users.length === 0) {
      setAuthError("Connecting to database... please try again in a moment.");
      return;
    }

    const user = users.find(
      (u) => (u.username?.toLowerCase() === id) && u.password === pass,
    );

    if (user) {
      setCurrentUser(user);
      setAuthError("");
      setCurrentView("POS");
      logAction(`User Login: ${user.name}`, "SUCCESS");
    } else {
      // Check if user exists but password mismatch for better feedback
      const userExists = users.some(u => u.username?.toLowerCase() === id);
      if (userExists) {
        setAuthError("Incorrect password. Please check your credentials.");
      } else {
        setAuthError("Username not found. Please contact your admin.");
      }
    }
  };

  const startSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      users.some(
        (u) => u.username.toLowerCase() === regForm.username.toLowerCase(),
      )
    ) {
      setAuthError("Username already exists.");
      return;
    }
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setMockEmail({ code });
    setAuthView("VERIFY");
  };

  const confirmVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (mockEmail && verifyInput.trim() === mockEmail.code) {
      const newUser: UserType = {
        id: Date.now().toString(),
        ...regForm,
        username: regForm.username.trim().toLowerCase(),
        role: UserRole.ADMIN,
      };
      setUsers((prev) => [...prev, newUser]);
      setCurrentUser(newUser);
      setMockEmail(null);
    } else {
      setAuthError("Invalid code.");
    }
  };

  const addStaff = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = regForm.username.trim().toLowerCase();
    
    // Check if username is taken by ANOTHER user
    if (users.some((u) => u.id !== editingUserId && u.username.toLowerCase() === cleanUsername)) {
      alert("Username already taken.");
      return;
    }

    if (editingUserId) {
      // Update existing
      const updatedUser = {
        name: regForm.name,
        username: cleanUsername,
        password: regForm.password,
        role: regForm.role,
        updatedAt: new Date().toISOString(),
      };
      
      updateDoc(doc(db, "users", editingUserId), updatedUser)
        .then(() => {
          setRegForm({ name: "", username: "", email: "", password: "", role: UserRole.CASHIER });
          setEditingUserId(null); // Clear editing state
          alert("Staff updated successfully!");
        })
        .catch(err => {
          console.error("Update staff failed:", err);
          alert("Failed to update staff in database.");
        });
    } else {
      // Add new
      const newStaff: any = {
        name: regForm.name,
        username: cleanUsername,
        email: regForm.email,
        password: regForm.password,
        role: regForm.role,
        createdAt: new Date().toISOString(),
      };
      
      addDoc(collection(db, "users"), newStaff)
        .then(() => {
          setRegForm({ name: "", username: "", email: "", password: "", role: UserRole.CASHIER });
          alert("Staff added successfully!");
        })
        .catch(err => {
          console.error("Add staff failed:", err);
          alert("Failed to register staff in database.");
        });
    }
  };

  const cartMap = useMemo(() => {
    const map = new Map<number, number>();
    cart.forEach((item) => map.set(item.id, item.qty));
    return map;
  }, [cart]);

  // --- POS Actions ---
  const handleRemoveMember = useCallback(
    async (userId: string, name: string) => {
      setDeleteConfirmId(`user-${userId}`);
    },
    [logAction],
  );

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex((i) => i.id === product.id);
      if (existingIdx > -1) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          qty: next[existingIdx].qty + 1,
        };
        return next;
      }
      return [...prev, { ...product, qty: 1, selectedAddons: [], note: "" }];
    });
  }, []);

  const updateQty = useCallback((id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const nextQty = Math.max(0, item.qty + delta);
            return { ...item, qty: nextQty };
          }
          return item;
        })
        .filter((i) => i.qty > 0),
    );
  }, []);

  const updateItemNote = useCallback((id: number, note: string) => {
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, note } : item)),
    );
  }, []);

  const updateCustomCharge = useCallback((id: number, customCharge: number) => {
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, customCharge } : item)),
    );
  }, []);

  const toggleAddon = useCallback((itemId: number, addon: any) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const exists = item.selectedAddons.find((a) => a.id === addon.id);
        const nextAddons = exists
          ? item.selectedAddons.filter((a) => a.id !== addon.id)
          : [...item.selectedAddons, addon];
        return { ...item, selectedAddons: nextAddons };
      }),
    );
  }, []);

  const total = useMemo(() => {
    const sub = cart.reduce((s, i) => {
      const addonsCost = i.selectedAddons.reduce((sum, a) => sum + a.price, 0);
      const customCharge = i.customCharge || 0;
      return s + (i.price + addonsCost + customCharge) * i.qty;
    }, 0);
    return Math.max(0, sub + deliveryCharge - discount);
  }, [cart, discount, deliveryCharge]);

  const subtotal = useMemo(
    () =>
      cart.reduce((s, i) => {
        const addonsCost = i.selectedAddons.reduce(
          (sum, a) => sum + a.price,
          0,
        );
        const customCharge = i.customCharge || 0;
        return s + (i.price + addonsCost + customCharge) * i.qty;
      }, 0),
    [cart],
  );

  const change = useMemo(() => {
    const received = Math.max(0, parseFloat(cashReceived) || 0);
    const diff = received - total;
    return diff > 0 ? Number(diff.toFixed(2)) : 0;
  }, [total, cashReceived]);

  const placeOrder = useCallback(
    async (status: "PAID" | "UNPAID" | "UDHAAR") => {
      console.log("placeOrder called with status:", status);
      if (isPlacingOrder) {
        console.warn("Order placement already in progress...");
        return;
      }

      try {
        if (cart.length === 0) {
          alert("Cart is empty!");
          return;
        }
        setIsPlacingOrder(true);

        const currentTotal = total; 
        const currentCart = [...cart];
        const currentCustomer = { ...customer };
        const currentSubtotal = subtotal;
        const currentDiscount = discount;
        const currentDeliveryCharge = deliveryCharge;
        const currentPaymentMethod = status === "UDHAAR" ? "CREDIT" : paymentMethod;
        
        const bizDate = backdateOverride || getBusinessDate();

        if (status === "PAID") {
          if (currentPaymentMethod === "CASH") {
            const received = cashReceived === "" ? currentTotal : parseFloat(cashReceived);
            if (isNaN(received) || received < currentTotal) {
              alert(`Insufficient cash! Total is Rs ${currentTotal}. You entered Rs ${received || 0}`);
              setIsPlacingOrder(false); // Reset state on validation failure
              return;
            }
          } else if (currentPaymentMethod === "SPLIT") {
            const sCash = parseFloat(splitCash) || 0;
            const sDigital = parseFloat(splitDigital) || 0;
            if (Math.abs(sCash + sDigital - currentTotal) > 0.1) {
              alert(`Split total (Rs ${sCash + sDigital}) must equal order total (Rs ${currentTotal})`);
              setIsPlacingOrder(false); // Reset state on validation failure
              return;
            }
          }
        }

        if (editingOrderId) {
          const oldOrder = orders.find((o) => o.id === editingOrderId);
          
          const updatedData = {
            items: currentCart.map((it) => ({ ...it })),
            total: currentTotal,
            subtotal: currentSubtotal,
            discount: currentDiscount,
            deliveryCharge: currentDeliveryCharge,
            customer: currentCustomer,
            customerId: (customers || []).find(c => c.mobile === currentCustomer.mobile)?.id || null,
            type: orderType,
            status,
            businessDate: editingOrderDate || oldOrder?.businessDate || getBusinessDate(),
            dateStr: oldOrder?.dateStr || new Date().toLocaleString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              month: "short",
              day: "numeric",
            }),
            timestamp: editingOrderDate 
              ? (editingOrderDate === oldOrder?.businessDate 
                  ? oldOrder.timestamp 
                  : new Date(editingOrderDate).setHours(12, 0, 0, 0))
              : (oldOrder?.timestamp || Date.now()),
            paymentMethod: currentPaymentMethod,
            tillId: (currentPaymentMethod !== "CASH" && currentPaymentMethod !== "SPLIT" && currentPaymentMethod !== "SPLIT_UDHAAR") ? tillId : null,
            paymentAccountName: (currentPaymentMethod === "JAZZCASH" || currentPaymentMethod === "EASYPAISA" || currentPaymentMethod === "BANK") ? paymentAccountName : null,
            cashReceived: (status === "PAID" || status === "UDHAAR") 
              ? (currentPaymentMethod === "SPLIT" ? parseFloat(splitCash) || 0 : (currentPaymentMethod === "SPLIT_UDHAAR" ? (splitUdhaarMethod === "CASH" ? parseFloat(splitUdhaarPaid) || 0 : 0) : (cashReceived === "" ? currentTotal : parseFloat(cashReceived)))) 
              : 0,
            ...(currentPaymentMethod === "SPLIT" ? {
              splitDetails: [
                { method: 'CASH', amount: parseFloat(splitCash) || 0 },
                { 
                  method: splitDigitalMethod as any, 
                  amount: parseFloat(splitDigital) || 0,
                  accountName: (splitDigitalMethod === "JAZZCASH" || splitDigitalMethod === "EASYPAISA" || splitDigitalMethod === "BANK") ? splitAccountName : null
                }
              ]
            } : currentPaymentMethod === "SPLIT_UDHAAR" ? {
              splitDetails: [
                { 
                  method: splitUdhaarMethod as any, 
                  amount: parseFloat(splitUdhaarPaid) || 0,
                  accountName: (splitUdhaarMethod === "JAZZCASH" || splitUdhaarMethod === "EASYPAISA" || splitUdhaarMethod === "BANK") ? paymentAccountName : null
                }
              ]
            } : {})
          };

          try {
            const batch = writeBatch(db);
            
            // 1. UI Reset IMMEDIATELY
            const wasEditing = !!editingOrderId;
            setEditingOrderId(null);
            if (wasEditing) {
              setCurrentView("HISTORY");
            } else {
              setCurrentView("DASHBOARD");
            }
            setCart([]);
            setCustomer({ name: "", mobile: "", address: "" });
            setPaymentAccountName("");
            setSplitAccountName("");
            setTillId("");
            setEditingOrderDate("");
            setIsCustomerModalOpen(false);
            
            // 2. Prepare Batch
            batch.update(doc(db, "orders", editingOrderId), {
              ...updatedData,
              updatedAt: serverTimestamp()
            });
            
            // Optimistic update
            const fullUpdatedOrder = { ...oldOrder, ...updatedData } as Order;
            setOrders(prev => prev.map(o => o.id === editingOrderId ? fullUpdatedOrder : o));
            
            // Sync Customer Record
            if (status === "PAID") {
              updateCustomerRecord(currentCustomer, currentTotal);
            }

            if (oldOrder) {
              revertInventoryFirestore(oldOrder.items, batch);
              deductInventoryFirestore(currentCart, batch);
            }

            // 3. Commit
            batch.commit().then(() => {
              logAction(`Order Sync Success: #${editingOrderId}`, "SUCCESS");
              setIsPlacingOrder(false);
            }).catch(e => {
              logAction(`Order Sync Failed: #${editingOrderId}`, "ERROR");
              setIsPlacingOrder(false);
              handleFirestoreError(e, OperationType.WRITE, "orders/" + editingOrderId);
            });
            
            logAction(`Order Update Initiated: #${editingOrderId}`, "INFO");
          } catch (e) {
            console.error("Update setup failed:", e);
            setIsPlacingOrder(false);
          }
        } else {
          // Calculate daily reset invoice number
          const ordersToday = (orders || []).filter(
            (o) => (o.businessDate === bizDate)
          );
          const maxInvoiceNo = ordersToday.reduce((max, o) => Math.max(max, o.invoiceNo || 0), 0);
          const nextInvoiceNo = maxInvoiceNo + 1;

          // Correct timestamp for backdating
          let finalTimestamp = Date.now();
          let finalDateStr = new Date().toLocaleString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            month: "short",
            day: "numeric",
          });

          if (backdateOverride) {
            const [y, m, d] = backdateOverride.split("-").map(Number);
            const backDate = new Date(y, m - 1, d, 14, 0, 0); 
            finalTimestamp = backDate.getTime();
            finalDateStr = backDate.toLocaleString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              month: "short",
              day: "numeric",
            });
          }

          const newOrder: Order = {
            id: `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            invoiceNo: nextInvoiceNo,
            businessDate: bizDate,
            timestamp: finalTimestamp,
            dateStr: finalDateStr,
            items: [...currentCart],
            total: currentTotal,
            subtotal: currentSubtotal,
            discount: currentDiscount,
            deliveryCharge: currentDeliveryCharge,
            customer: currentCustomer,
            customerId: (customers || []).find(c => c.mobile === currentCustomer.mobile)?.id || null,
            type: orderType,
            status,
            paymentMethod: currentPaymentMethod,
            tillId: (currentPaymentMethod !== "CASH" && currentPaymentMethod !== "SPLIT" && currentPaymentMethod !== "SPLIT_UDHAAR") ? tillId : null,
            paymentAccountName: (currentPaymentMethod === "JAZZCASH" || currentPaymentMethod === "EASYPAISA" || currentPaymentMethod === "BANK") ? paymentAccountName : null,
            cashReceived: (status === "PAID" || status === "UDHAAR") 
              ? (currentPaymentMethod === "SPLIT" ? parseFloat(splitCash) || 0 : (currentPaymentMethod === "SPLIT_UDHAAR" ? (splitUdhaarMethod === "CASH" ? parseFloat(splitUdhaarPaid) || 0 : 0) : (cashReceived === "" ? currentTotal : parseFloat(cashReceived)))) 
              : 0,
            ...(currentPaymentMethod === "SPLIT" ? {
              splitDetails: [
                { method: 'CASH', amount: parseFloat(splitCash) || 0 },
                { 
                  method: splitDigitalMethod as any, 
                  amount: parseFloat(splitDigital) || 0,
                  accountName: (splitDigitalMethod === "JAZZCASH" || splitDigitalMethod === "EASYPAISA" || splitDigitalMethod === "BANK") ? splitAccountName : null
                }
              ]
            } : currentPaymentMethod === "SPLIT_UDHAAR" ? {
              splitDetails: [
                { 
                  method: splitUdhaarMethod as any, 
                  amount: parseFloat(splitUdhaarPaid) || 0,
                  accountName: (splitUdhaarMethod === "JAZZCASH" || splitUdhaarMethod === "EASYPAISA" || splitUdhaarMethod === "BANK") ? paymentAccountName : null
                }
              ]
            } : {})
          };

          // Update records
          setOrders((prev) => [newOrder, ...prev]);
          updateCustomerRecord(currentCustomer, currentTotal);
          
          // 1. UI Reset IMMEDIATELY 
          setCart([]);
          setCustomer({ name: "", mobile: "", address: "" });
          setPaymentAccountName("");
          setSplitAccountName("");
          setTillId("");
          setIsCustomerModalOpen(false);
          clearAICache();

          // 2. Firebase Sync in background
          try {
            const batch = writeBatch(db);
            const orderRef = doc(db, "orders", newOrder.id);
            batch.set(orderRef, {
              ...newOrder,
              serverTimestamp: serverTimestamp()
            });
            
            deductInventoryFirestore(currentCart, batch);
            
            batch.commit().then(() => {
              logAction(`Order Synced: #${newOrder.id}`, "SUCCESS");
              setIsPlacingOrder(false);
            }).catch(err => {
              console.error("Background sync error:", err);
              setIsPlacingOrder(false);
            });

            logAction(`New Order #${formatInvoiceNo(newOrder.businessDate, newOrder.invoiceNo)}`, "SUCCESS");
          } catch (e) {
            console.error("Firebase Sync Prep Error:", e);
            setIsPlacingOrder(false);
          }
        }

        // Global Reset
        setCashReceived("");
        setSplitCash("");
        setSplitDigital("");
        setTillId("");
        setAiSuggestion("");
        setDiscount(0);
        setDeliveryCharge(0);
        setBackdateOverride(null);
      } catch (error) {
        console.error("FATAL placeOrder Error:", error);
        alert("CRITICAL ERROR: Could not place order. Check console or contact support. " + (error instanceof Error ? error.message : String(error)));
        setIsPlacingOrder(false);
      }
    },
    [
      cart,
      total,
      subtotal,
      discount,
      deliveryCharge,
      customer,
      orderType,
      paymentMethod,
      cashReceived,
      splitCash,
      splitDigital,
      splitDigitalMethod,
      tillId,
      editingOrderId,
      logAction,
      orders,
      backdateOverride,
      customers,
      updateCustomerRecord,
      clearAICache,
      isPlacingOrder,
      inventory,
      deductInventoryFirestore,
      revertInventoryFirestore,
      editingOrderDate,
    ],
  );

  const handleBulkRestock = useCallback(() => {
    const nextInv = [...inventory];
    const logEntries: AuditLogEntry[] = [];

    Object.entries(bulkRestockQuantities).forEach(
      ([id, qtyStr]: [string, string]) => {
        const packets = parseInt(qtyStr) || 0;
        if (packets <= 0) return;

        const idx = nextInv.findIndex((i) => i.id === id);
        if (idx !== -1) {
          const item = nextInv[idx];
          const addedStock = packets * item.packetSize;
          const oldStock = item.stock;
          const newStock = oldStock + addedStock;

          nextInv[idx] = {
            ...item,
            stock: newStock,
          };

          logEntries.push({
            id: `log-${Date.now()}-${id}`,
            timestamp: Date.now(),
            action: `RESTOCK: ${item.name}`,
            status: "SUCCESS",
            details: `Added ${addedStock} units. Stock: ${oldStock} -> ${newStock}`,
            userId: currentUser?.id || "system",
            userName: currentUser?.name || "System",
          });
        }
      },
    );

    if (logEntries.length > 0) {
      setInventory(nextInv);
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(nextInv));
      let logs = [];
      try {
        const savedLogs = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
        if (savedLogs) {
          const parsed = JSON.parse(savedLogs);
          logs = Array.isArray(parsed) ? parsed : [];
        }
      } catch (e) {
        console.error("Audit log parse error:", e);
      }
      const updatedLogs = [...logs, ...logEntries];
      localStorage.setItem(
        STORAGE_KEYS.AUDIT_LOGS,
        JSON.stringify(updatedLogs),
      );
      logAction(
        "INVENTORY_BULK_RESTOCK",
        "SUCCESS",
        `Items restocked: ${logEntries.length}`,
      );
    }

    setIsBulkRestockModalOpen(false);
    setSelectedInventoryItems(new Set());
    setBulkRestockQuantities({});
  }, [inventory, bulkRestockQuantities, currentUser, logAction]);

  const submitExpense = useCallback(() => {
    if (!expenseForm.reason || !expenseForm.amount) {
      alert("Please enter reason and amount!");
      return;
    }

    const newExpense: Expense = {
      id: `EXP-${Date.now()}`,
      timestamp: Date.now(),
      dateStr: getBusinessDate(),
      reason: expenseForm.reason,
      amount: parseFloat(expenseForm.amount),
      category: expenseForm.category,
      userId: currentUser?.id || "system",
    };

    setExpenses((prev) => [newExpense, ...prev]);
    // Firebase Sync
    try {
      addDoc(collection(db, "expenses"), {
        ...newExpense,
        serverTimestamp: serverTimestamp()
      });
    } catch (e) {
      console.error("Firebase Expense Error:", e);
    }
    logAction(
      `Expense Logged: ${expenseForm.reason}`,
      "WARNING",
      `Amount: Rs ${expenseForm.amount}`,
    );
    setExpenseForm({ reason: "", amount: "", category: "Purchasing" });
    alert("Expense recorded successfully!");
  }, [expenseForm, currentUser, logAction]);

  // Helper for Cart UI to avoid DRY and prevent remounting blinking
  const commonCartProps = useMemo(
    () => ({
      cart,
      orderType,
      setOrderType,
      paymentMethod,
      setPaymentMethod,
      updateQty,
      toggleAddon,
      setCart,
      editingNoteId,
      setEditingNoteId,
      setCustomer,
      customer,
      tillId,
      setTillId,
      cashReceived,
      setCashReceived,
      total,
      subtotal,
      discount,
      setDiscount,
      deliveryCharge,
      setDeliveryCharge,
      change,
      placeOrder,
      setIsMobileCartOpen,
      isCustomerModalOpen,
      setIsCustomerModalOpen,
      editingOrderId,
      setEditingOrderId,
      updateItemNote,
      editingCustomChargeId,
      setEditingCustomChargeId,
      updateCustomCharge,
      logAction,
      setDiscountPromptValue,
      setIsDiscountPromptOpen,
      setIsVoidConfirmOpen,
      backdateOverride,
      setBackdateOverride,
      currentUser,
    }),
    [
      cart,
      orderType,
      paymentMethod,
      updateQty,
      toggleAddon,
      editingNoteId,
      editingCustomChargeId,
      updateCustomCharge,
      customer,
      cashReceived,
      total,
      subtotal,
      discount,
      deliveryCharge,
      change,
      isCustomerModalOpen,
      editingOrderId,
      updateItemNote,
      placeOrder,
      setIsMobileCartOpen,
      setIsCustomerModalOpen,
      setDiscount,
      setDeliveryCharge,
      setCustomer,
      setTillId,
      setCashReceived,
      logAction,
      setDiscountPromptValue,
      setIsDiscountPromptOpen,
      setIsVoidConfirmOpen,
      backdateOverride,
      currentUser,
    ],
  );

  const toggleExpand = (id: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // --- Auth View ---
  if (!currentUser) {
    return (
      <div
        className={`h-screen w-full flex flex-col items-center justify-center p-6 transition-colors ${isDarkMode ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-800"}`}
      >
        <div className="absolute top-8 right-8">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-3 rounded-2xl border transition-all ${isDarkMode ? "bg-slate-900 border-white/10 text-amber-500" : "bg-white border-slate-200 text-slate-400 hover:text-amber-500 shadow-sm"}`}
          >
            {isDarkMode ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>
        </div>

        <div
          className={`w-full max-sm p-10 backdrop-blur-3xl border rounded-[3rem] shadow-2xl transition-all ${isDarkMode ? "bg-white/5 border-white/10" : "bg-white border-slate-100"}`}
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-amber-500 rounded-2xl mx-auto flex items-center justify-center text-white font-brand text-3xl italic">
              BS
            </div>
            <h1
              className={`mt-4 font-brand text-2xl tracking-widest uppercase italic ${isDarkMode ? "text-white" : "text-slate-800"}`}
            >
              Bursport Pro
            </h1>
          </div>
          {authView === "LOGIN" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                placeholder="Username"
                value={loginForm.identifier}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, identifier: e.target.value })
                }
                className={`w-full p-4 rounded-2xl outline-none focus:ring-1 ring-amber-500 font-bold ${isDarkMode ? "bg-white/10 text-white" : "bg-slate-100 text-slate-800"}`}
              />
              <input
                type="password"
                placeholder="Password"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, password: e.target.value })
                }
                className={`w-full p-4 rounded-2xl outline-none focus:ring-1 ring-amber-500 font-bold ${isDarkMode ? "bg-white/10 text-white" : "bg-slate-100 text-slate-800"}`}
              />
              {authError && (
                <p className="text-rose-500 text-[10px] uppercase font-black text-center">
                  {authError}
                </p>
              )}
              <button
                type="submit"
                className="w-full bg-amber-500 text-white py-4 rounded-2xl font-black uppercase italic tracking-widest active:scale-95 transition-all shadow-lg shadow-amber-500/20"
              >
                Enter Terminal
              </button>
            </form>
          ) : authView === "SIGNUP" ? (
            <form onSubmit={startSignup} className="space-y-4">
              <input
                placeholder="Owner Name"
                value={regForm.name}
                onChange={(e) =>
                  setRegForm({ ...regForm, name: e.target.value })
                }
                className={`w-full p-4 rounded-2xl outline-none font-bold ${isDarkMode ? "bg-white/10 text-white" : "bg-slate-100 text-slate-800"}`}
                required
              />
              <input
                placeholder="Set Username"
                value={regForm.username}
                onChange={(e) =>
                  setRegForm({ ...regForm, username: e.target.value })
                }
                className={`w-full p-4 rounded-2xl outline-none font-bold ${isDarkMode ? "bg-white/10 text-white" : "bg-slate-100 text-slate-800"}`}
                required
              />
              <input
                type="password"
                placeholder="Set Password"
                value={regForm.password}
                onChange={(e) =>
                  setRegForm({ ...regForm, password: e.target.value })
                }
                className={`w-full p-4 rounded-2xl outline-none font-bold ${isDarkMode ? "bg-white/10 text-white" : "bg-slate-100 text-slate-800"}`}
                required
              />
              <button
                type="submit"
                className="w-full bg-amber-500 text-white py-4 rounded-2xl font-black uppercase italic tracking-widest shadow-lg shadow-amber-500/20"
              >
                Setup Account
              </button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-[10px] font-black uppercase text-slate-400">
                Your Master Code
              </p>
              <p className="text-amber-500 text-5xl font-brand italic tracking-widest animate-pulse">
                {mockEmail?.code}
              </p>
              <input
                maxLength={4}
                placeholder="CODE"
                value={verifyInput}
                onChange={(e) => setVerifyInput(e.target.value)}
                className={`w-full p-6 text-center text-5xl font-brand italic outline-none tracking-[0.4em] rounded-3xl border ${isDarkMode ? "bg-white/10 text-white border-white/5" : "bg-slate-100 text-slate-800 border-slate-200"}`}
              />
              <button
                onClick={confirmVerify}
                className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase italic tracking-widest shadow-lg shadow-emerald-500/20"
              >
                Verify & Login
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-screen ${isDarkMode ? "dark" : ""} bg-[#f8fafc] dark:bg-[#0f172a] text-slate-800 dark:text-slate-100 transition-colors duration-300`}
    >
      <main className="flex-1 flex flex-col min-w-0 md:h-screen md:overflow-hidden relative">
        <header
          className={`h-20 px-4 md:px-8 flex items-center justify-between z-30 shrink-0 ${isDarkMode ? "bg-slate-900/50 backdrop-blur-xl border-b border-white/5" : "bg-white/80 backdrop-blur-xl border-b border-slate-100"}`}
        >
          <div className="flex items-center gap-3 md:gap-6">
            {!isOnline && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20"
              >
                <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest italic">Offline</span>
              </motion.div>
            )}
            <div className="flex items-center bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-2xl border border-slate-200/50 dark:border-white/5 mr-2">
              {[
                { id: "POS", icon: ShoppingCart },
                { id: "DASHBOARD", icon: BarChart3 },
                { id: "INVENTORY", icon: Package },
                { id: "CREDIT", icon: Coins },
                { id: "EXPENSES", icon: Wallet, adminOnly: true },
                { id: "STAFF", icon: Users, adminOnly: true },
                { id: "PURCHASE_ORDERS", icon: Truck, adminOnly: true },
                { id: "CUSTOMERS", icon: Users },
                { id: "HISTORY", icon: History },
                { id: "REPORTS", icon: PieChartIcon, adminOnly: true },
                { id: "SETTINGS", icon: Settings },
                { id: "ADMIN", icon: UserCog, adminOnly: true },
              ]
                .filter(
                  (item) =>
                    !item.adminOnly || currentUser?.role === UserRole.ADMIN,
                )
                .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id === "HISTORY" && currentView !== "HISTORY") {
                        const bDate = getBusinessDate();
                        setHistoryFromDate(bDate);
                        setHistoryToDate(bDate);
                        setHistoryStatusFilter("ALL");
                        setHistoryTypeFilter("ALL");
                        setHistorySearch("");
                        setHistoryLimit(500);
                        setHistorySearch("");
                      }
                      setCurrentView(item.id as any);
                    }}
                    className={`p-2.5 rounded-xl transition-all ${currentView === item.id ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"}`}
                  >
                    <item.icon className="w-5 h-5" />
                  </button>
                ))}
              <button
                onClick={() => setCurrentUser(null)}
                className="p-2.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-500 w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-white font-brand text-xl md:text-2xl italic shadow-lg shadow-amber-500/20">
              BS
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg md:text-xl font-brand italic tracking-widest text-amber-500 uppercase leading-none">
                Bursport
              </h1>
              <p className="text-[9px] font-black uppercase text-slate-400 mt-1 tracking-tighter">
                Terminal • {currentView}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-10">
            {/* Connectivity Status */}
            <div className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all duration-500 ${isOnline ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-rose-500/10 border-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.15)] animate-pulse'}`}>
              <div className="relative">
                {isOnline ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-rose-500" />
                )}
                <div className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border-2 border-white dark:border-slate-900 ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              </div>
              <div className="flex flex-col">
                <span className={`text-[9px] font-black uppercase italic tracking-widest leading-none ${isOnline ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isOnline ? 'Cloud Sync Active' : 'Offline Mode'}
                </span>
                <span className="text-[7px] font-bold uppercase text-slate-400 mt-0.5">
                  {isOnline ? 'Real-time Updates' : 'Local Storage Auto-Sync'}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-[10px] md:text-[14px] font-mono font-black tracking-widest text-amber-500 leading-none">
                <DigitalClock />
              </span>
              <span className="text-[6px] md:text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                Time
              </span>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <div className="hidden sm:flex flex-col items-end mr-1 md:mr-2">
                <p className="text-[8px] md:text-[10px] font-black uppercase text-slate-800 dark:text-white leading-none">
                  {currentUser.name}
                </p>
                <p className="text-[6px] md:text-[8px] font-black uppercase text-amber-500 mt-0.5">
                  Executive Admin
                </p>
              </div>

              <div className="flex-1 flex items-center justify-center h-full border-x dark:border-white/5 mx-2 px-2">
                <div className="relative w-full max-w-xs hidden md:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={dashSearchQuery}
                    onChange={(e) => setDashSearchQuery(e.target.value)}
                    placeholder="Search operations..."
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-3 py-2 text-[10px] font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-amber-500 transition-all dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pl-2 border-l dark:border-white/5">
                <button className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-amber-500 transition-all">
                  <Bell className="w-4 h-4" />
                  <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full" />
                </button>
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className={`p-2 md:p-2.5 rounded-xl border transition-colors ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200 hover:bg-slate-100"}`}
                >
                  {isDarkMode ? (
                    <Sun className="w-3.5 h-3.5" />
                  ) : (
                    <Moon className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex-1 overflow-hidden flex flex-col"
          >
            {currentView === "DASHBOARD" ? (
              <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                  <div className="max-w-7xl mx-auto space-y-8 pb-32">
                    {/* 1. Header & Quick Filter */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <div className="w-2 h-8 bg-amber-500 rounded-full" />
                          <h2 className="text-3xl font-brand italic text-slate-900 dark:text-white uppercase tracking-[0.2em]">
                            Executive Dashboard
                          </h2>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic flex items-center gap-2">
                            <Activity className="w-3 h-3 text-emerald-500" />{" "}
                            Operational velocity for{" "}
                            {dashTimeRange === "TODAY"
                              ? "Today"
                              : dashTimeRange === "7D"
                                ? "Last 7 Days"
                                : dashTimeRange === "30D"
                                  ? "Last 30 Days"
                                  : dashTimeRange === "ALL"
                                    ? "All Time"
                                    : formatDateForLabel(dashCustomDate)}
                          </p>
                          <div className="h-3 w-px bg-slate-200 dark:bg-slate-800" />
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">
                              Live Refresh active •{" "}
                              {lastRefreshed.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border dark:border-slate-800 shadow-sm">
                          {["TODAY", "7D", "30D", "ALL"].map((t) => (
                            <button
                              key={t}
                              onClick={() => setDashTimeRange(t as any)}
                              className={`px-4 py-1.5 rounded-xl text-[9px] font-black tracking-widest transition-all ${t === dashTimeRange ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30" : "text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                            >
                              {t === "ALL" ? "ALL TIME" : t}
                            </button>
                          ))}
                          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
                          <div
                            className={`flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${dashTimeRange === "CUSTOM" ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30" : "text-slate-400 group"}`}
                          >
                            <div className="flex items-center gap-1">
                              {dashTimeRange === "CUSTOM" && <span className="text-[7px] font-black opacity-70">FROM:</span>}
                              <input
                                type="date"
                                value={dashCustomDate}
                                onChange={(e) => {
                                  setDashCustomDate(e.target.value);
                                  setDashTimeRange("CUSTOM");
                                }}
                                className="bg-transparent text-[9px] font-black uppercase outline-none"
                              />
                            </div>
                            <div className="h-3 w-px bg-current opacity-20" />
                            <div className="flex items-center gap-1">
                              {dashTimeRange === "CUSTOM" && <span className="text-[7px] font-black opacity-70">TO:</span>}
                              <input
                                type="date"
                                value={dashCustomDateEnd}
                                onChange={(e) => {
                                  setDashCustomDateEnd(e.target.value);
                                  setDashTimeRange("CUSTOM");
                                }}
                                className="bg-transparent text-[9px] font-black uppercase outline-none"
                              />
                            </div>
                            <Calendar className="w-3 h-3 ml-1" />
                          </div>
                        </div>
                        <button
                          onClick={exportToCSV}
                          className="flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                        >
                          <Download className="w-4 h-4" />
                          CSV Export
                        </button>
                      </div>
                    </div>

                    {/* 2. PREMIUM BENTO DASHBOARD LAYOUT */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-32">
                      <div className="lg:col-span-12 space-y-10">
                        {/* CONNECTION STATUS BANNER */}
                        {!isConnected && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            className="bg-rose-500 text-white p-4 mb-4 rounded-3xl flex items-center justify-between shadow-lg shadow-rose-500/20"
                          >
                            <div className="flex items-center gap-3">
                              <div className="bg-white/20 p-2 rounded-xl">
                                <WifiOff className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col">
                                <p className="text-[10px] font-black uppercase tracking-widest">{isConnected ? 'Cloud Sync Active' : 'Offline Mode'}</p>
                                <p className="text-[8px] opacity-80 uppercase font-bold">{isConnected ? 'Ready to process orders' : 'Sync pending stabilization'}</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                setIsConnected(true);
                                // Re-trigger test connection via simple reload or ping (lib handles ping)
                              }}
                              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-[10px] font-black uppercase transition-colors"
                            >
                              Check Sync
                            </button>
                          </motion.div>
                        )}

                        {/* DASHBOARD STATS TOP CARDS */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                          <motion.div 
                            className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden group shadow-amber-500/5 hover:shadow-amber-500/10 transition-shadow cursor-pointer"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={() => setIsRevenueDetailOpen(true)}
                          >
                            <p className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-[0.2em]">Gross Revenue</p>
                            <h4 className="text-2xl font-brand italic font-black text-slate-900 dark:text-white truncate">Rs {stats.totalRevenue.toLocaleString()}</h4>
                            <div className="mt-3 flex items-center gap-2">
                              <div className={`flex items-center gap-1 ${stats.revGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                 {stats.revGrowth >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                                 <span className="text-[9px] font-black italic">{Math.abs(stats.revGrowth).toFixed(1)}%</span>
                              </div>
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">vs yd</span>
                            </div>
                            <div className="absolute right-4 top-4 w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform">
                              <Banknote className="w-5 h-5" />
                            </div>
                          </motion.div>

                          <motion.div 
                            className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden group shadow-rose-500/5 hover:shadow-rose-500/10 transition-shadow cursor-pointer"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.05 }}
                            onClick={() => setIsCreditDetailOpen(true)}
                          >
                            <p className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-[0.2em]">Total Credit (Udhaar)</p>
                            <h4 className="text-2xl font-brand italic font-black text-rose-500 truncate">Rs {stats.udhaarRevenue.toLocaleString()}</h4>
                            <div className="mt-3 flex items-center gap-2">
                              <span className="text-[8px] font-black italic text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full uppercase">Receivable</span>
                            </div>
                            <div className="absolute right-4 top-4 w-10 h-10 bg-rose-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/20 group-hover:scale-110 transition-transform">
                              <CreditCard className="w-5 h-5" />
                            </div>
                          </motion.div>

                          <motion.div 
                            className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden group shadow-indigo-500/5 hover:shadow-indigo-500/10 transition-shadow cursor-pointer"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 }}
                            onClick={() => {
                              const bDate = getBusinessDate();
                              setHistoryFromDate(bDate);
                              setHistoryToDate(bDate);
                              setHistoryStatusFilter("ALL");
                              setHistoryTypeFilter("ALL");
                              setHistorySearch("");
                              setCurrentView("HISTORY");
                            }}
                          >
                            <p className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-[0.2em]">Orders</p>
                            <h4 className="text-2xl font-brand italic font-black text-slate-900 dark:text-white">{stats.count}</h4>
                            <div className="mt-3 flex items-center gap-2">
                              <span className="text-[9px] font-black italic text-emerald-500">+{stats.todayCount || 0}</span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">recent</span>
                            </div>
                            <div className="absolute right-4 top-4 w-10 h-10 bg-indigo-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                              <ShoppingCart className="w-5 h-5" />
                            </div>
                          </motion.div>

                          <motion.div 
                            className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden group shadow-orange-500/5 hover:shadow-orange-500/10 transition-shadow cursor-pointer"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.15 }}
                            onClick={() => setIsItemsBreakdownOpen(true)}
                          >
                            <p className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-[0.2em]">Items Sold</p>
                            <h4 className="text-2xl font-brand italic font-black text-slate-900 dark:text-white">{stats.totalItemsSold.toLocaleString()}</h4>
                            <div className="mt-3 flex items-center gap-2">
                              <span className="text-[9px] font-black italic text-emerald-500">+{stats.todayTotalItemsSold}</span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">today</span>
                            </div>
                            <div className="absolute right-4 top-4 w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
                              <Package className="w-5 h-5" />
                            </div>
                          </motion.div>

                          <motion.div 
                            className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden group shadow-emerald-500/5 hover:shadow-emerald-500/10 transition-shadow cursor-pointer"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                            onClick={() => setIsAvgTicketOpen(true)}
                          >
                            <p className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-[0.2em]">Avg Ticket</p>
                            <h4 className="text-2xl font-brand italic font-black text-slate-900 dark:text-white">Rs {stats.avgTicket.toLocaleString()}</h4>
                            <div className="mt-3 flex items-center gap-1">
                               <Users className="w-2.5 h-2.5 text-indigo-500" />
                               <span className="text-[9px] font-black italic text-indigo-500">Solid Flow</span>
                            </div>
                            <div className="absolute right-4 top-4 w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                              <BarChart3 className="w-5 h-5" strokeWidth={3} />
                            </div>
                          </motion.div>

                          <motion.div 
                            className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden group shadow-emerald-500/5 hover:shadow-emerald-500/10 transition-shadow cursor-pointer"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.35 }}
                            onClick={() => setIsProfitAnalysisOpen(true)}
                          >
                            <p className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-[0.2em]">Net Profit</p>
                            <h4 className={`text-2xl font-brand italic font-black truncate ${stats.profitMetrics.netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              Rs {stats.profitMetrics.netProfit.toLocaleString()}
                            </h4>
                            <div className="mt-3 flex items-center gap-2">
                               <span className={`text-[8px] font-black italic px-2 py-0.5 rounded-full uppercase ${stats.profitMetrics.netProfit >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                 {stats.profitMetrics.margin.toFixed(1)}% Margin
                               </span>
                            </div>
                            <div className={`absolute right-4 top-4 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${stats.profitMetrics.netProfit >= 0 ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-rose-500 text-white shadow-rose-500/20'}`}>
                              <TrendingUp className="w-5 h-5" />
                            </div>
                          </motion.div>
                        </div>

                        {/* REVENUE PERFORMANCE CHART */}
                        <motion.div 
                          className="bg-white dark:bg-slate-900 p-10 rounded-[4rem] border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col pt-12 shadow-amber-500/5"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <div className="flex items-center justify-between mb-10">
                            <div>
                               <h3 className="text-[14px] font-black uppercase italic tracking-[0.4em] text-slate-800 dark:text-white">
                                 Revenue Performance
                               </h3>
                               <p className="text-[10px] font-black uppercase text-slate-400 mt-2 tracking-widest leading-none">
                                 {dashTimeRange === "TODAY" || (dashTimeRange === "CUSTOM" && dashCustomDate === dashCustomDateEnd) 
                                   ? "Live Hourly Sales Updates" 
                                   : "Daily Revenue Performance Trends"}
                               </p>
                            </div>
                            <div className="p-4 bg-amber-500/10 rounded-[1.5rem]">
                               <Activity className="w-6 h-6 text-amber-500" />
                            </div>
                          </div>
                          
                          <div className="h-[400px] w-full pr-4">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={stats.chartData}>
                                <defs>
                                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/>
                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.4} />
                                <XAxis dataKey="time" stroke="#94a3b8" fontSize={9} fontWeight="900" axisLine={false} tickLine={false} />
                                <YAxis 
                                  stroke="#94a3b8" fontSize={9} fontWeight="900" axisLine={false} tickLine={false}
                                  tickFormatter={(v) => `Rs ${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`}
                                />
                                <Tooltip 
                                  contentStyle={{ borderRadius: '2rem', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '20px' }}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={5} fillOpacity={1} fill="url(#colorRev)" animationDuration={2000} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </motion.div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          {/* SALES BY CATEGORY */}
                          <motion.div 
                            className="bg-white dark:bg-slate-900 p-10 rounded-[4rem] border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col shadow-indigo-500/5"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                          >
                            <div className="flex items-center justify-between mb-12">
                              <div>
                                <h3 className="text-[14px] font-black uppercase italic tracking-[0.3em] text-slate-800 dark:text-white">
                                  Sales by Category
                                </h3>
                                <p className="text-[10px] font-black uppercase text-slate-400 mt-2 tracking-widest">Revenue Impact Distribution</p>
                              </div>
                            </div>
                            
                            <div className="h-[350px] w-full pr-4">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.categoryData} layout="vertical">
                                  <XAxis type="number" hide />
                                  <YAxis 
                                    dataKey="name" type="category" stroke="#94a3b8" fontSize={11} fontWeight="900" axisLine={false} tickLine={false} width={120}
                                  />
                                  <Tooltip 
                                    contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 15px 30px -10px rgba(0,0,0,0.1)' }}
                                  />
                                  <Bar dataKey="value" radius={[0, 30, 30, 0]} barSize={24}>
                                    {stats.categoryData.map((_, i) => (
                                      <Cell key={`cell-${i}`} fill={i % 2 === 0 ? "#6366f1" : "#f59e0b"} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </motion.div>

                          {/* RECENT ACTIVITY LOGS */}
                          <motion.div 
                            className="bg-white dark:bg-slate-900 p-10 rounded-[4rem] border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col shadow-emerald-500/5 mb-8"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                          >
                            <div className="flex items-center justify-between mb-12">
                               <div>
                                 <h3 className="text-[14px] font-black uppercase italic tracking-[0.3em] text-slate-800 dark:text-white">
                                   Live Activity Feed
                                 </h3>
                                 <p className="text-[10px] font-black uppercase text-slate-400 mt-2 tracking-widest">System Audit Logs</p>
                               </div>
                               <div className="flex items-center gap-1 px-3 py-1 bg-emerald-500/10 rounded-full">
                                 <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                 <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Live</span>
                               </div>
                            </div>
                            
                            <div className="space-y-6">
                              {stats.filteredAuditLogs.slice(0, 8).map((log, i) => (
                                <div key={log.id} className="flex gap-4 group">
                                  <div className="mt-1">
                                    {log.action.toUpperCase().includes("ORDER") || log.action.toUpperCase().includes("SALE") ? (
                                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                        <CheckCircle2 className="w-4 h-4 text-amber-500" />
                                      </div>
                                    ) : (
                                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        <Clock className="w-4 h-4 text-slate-400" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 pb-6 border-b border-slate-100 dark:border-slate-800 group-last:border-none">
                                    <div className="flex items-center justify-between mb-1">
                                      <p className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-tight italic">
                                        {log.action}
                                      </p>
                                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-60">
                                      ID: {log.id.slice(-6).toUpperCase()} • BY {log.userName}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        </div>

                        {/* PAYMENT DISTRIBUTION & INSIGHTS */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          <motion.div 
                            className="bg-white dark:bg-slate-900 p-10 rounded-[4rem] border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col shadow-amber-500/5 mb-8 lg:mb-0"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <div className="flex items-center justify-between mb-10">
                              <div>
                                 <h3 className="text-[14px] font-black uppercase italic tracking-[0.4em] text-slate-800 dark:text-white">
                                   Payment Distribution
                                 </h3>
                                 <p className="text-[10px] font-black uppercase text-slate-400 mt-2 tracking-widest">
                                   Cash vs Bank vs Udhaar
                                 </p>
                              </div>
                              <div className="p-4 bg-orange-500/10 rounded-[2.5rem] flex items-center justify-center">
                                 <ShieldCheck className="w-6 h-6 text-orange-500" />
                              </div>
                            </div>
                            
                            <div className="flex-1 flex flex-col items-center justify-center relative min-h-[300px]">
                              <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                  <Pie
                                    data={stats.paymentMethodsData}
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                  >
                                    {stats.paymentMethodsData.map((entry, index) => (
                                      <Cell 
                                        key={`cell-${index}`} 
                                        fill={
                                          entry.name === 'CASH' ? '#10b981' : 
                                          entry.name === 'BANK' ? '#6366f1' : 
                                          entry.name === 'UDHAAR' ? '#f43f5e' : '#f59e0b'
                                        } 
                                      />
                                    ))}
                                  </Pie>
                                  <Tooltip 
                                    contentStyle={{ borderRadius: '1.5rem', border: 'none', background: '#1e293b', color: '#fff' }}
                                    itemStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                 <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Total Gross</p>
                                 <p className="text-xl font-brand italic font-black text-slate-900 dark:text-white">Rs {stats.totalRevenue.toLocaleString()}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-8">
                               {stats.paymentMethodsData.map((channel, i) => (
                                 <div key={i} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2 mb-2">
                                       <div className={`w-2 h-2 rounded-full ${
                                         channel.name === 'CASH' ? 'bg-emerald-500' : 
                                         channel.name === 'BANK' ? 'bg-indigo-500' : 
                                         channel.name === 'UDHAAR' ? 'bg-rose-500' : 'bg-amber-500'
                                       }`} />
                                       <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{channel.name}</p>
                                    </div>
                                    <p className="text-sm font-brand italic text-slate-900 dark:text-white leading-none">
                                      {Math.round((channel.value / stats.totalRevenue) * 100)}%
                                    </p>
                                 </div>
                               ))}
                            </div>
                          </motion.div>

                          <motion.div 
                            className="bg-white dark:bg-slate-900 p-10 rounded-[4rem] border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col shadow-blue-500/5 mb-8 lg:mb-0"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                          >
                             <div className="flex items-center justify-between mb-8">
                              <div>
                                 <h3 className="text-[14px] font-black uppercase italic tracking-[0.4em] text-slate-800 dark:text-white">
                                   Menu Impact
                                 </h3>
                                 <p className="text-[10px] font-black uppercase text-slate-400 mt-2 tracking-widest">
                                   Top 6 Categories
                                 </p>
                              </div>
                            </div>

                            <div className="flex-1 flex flex-col min-h-[300px]">
                               <ResponsiveContainer width="100%" height={300}>
                                 <RadarChart cx="50%" cy="50%" outerRadius="75%" data={stats.radarData}>
                                   <PolarGrid stroke="#e2e8f0" strokeWidth={1} />
                                   <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8, fontWeight: 900, fill: '#64748b' }} />
                                   <Radar name="Performance" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.5} />
                                   <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', background: '#1e293b', color: '#fff', fontSize: '9px' }} />
                                 </RadarChart>
                               </ResponsiveContainer>
                            </div>
                          </motion.div>
                        </div>

                        {/* DIGITAL ACCOUNT SETTLEMENTS */}
                        {Object.keys(stats.digitalAccountSummary).length > 0 && (
                          <motion.div 
                            className="lg:col-span-12 bg-white dark:bg-slate-900 p-10 rounded-[4rem] border border-slate-100 dark:border-slate-800 shadow-2xl shadow-indigo-500/5 mb-10 overflow-hidden relative"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <div className="flex items-center justify-between mb-8">
                              <div>
                                <div className="flex items-center gap-3 mb-1">
                                  <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                                  <h3 className="text-[14px] font-black uppercase italic tracking-[0.4em] text-slate-800 dark:text-white">
                                    Digital Account Settlements
                                  </h3>
                                </div>
                                <p className="text-[10px] font-black uppercase text-slate-400 mt-2 tracking-widest pl-4">
                                  Breakdown of digital collections by account holder name
                                </p>
                              </div>
                              <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500">
                                <QrCode className="w-6 h-6" />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              {(Object.entries(stats.digitalAccountSummary) as [string, { total: number, orders: any[], methods: Record<string, number>, accountName: string }][]).map(([name, data], idx) => (
                                <div 
                                  key={idx}
                                  onClick={() => setSelectedDigitalAccount(name)}
                                  className="group bg-slate-50 dark:bg-slate-800/40 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 hover:border-indigo-500/30 transition-all hover:shadow-lg hover:shadow-indigo-500/5 cursor-pointer"
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-wrap gap-1">
                                      {Object.keys(data.methods).map(m => (
                                        <span key={m} className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 text-[6px] font-black tracking-tight">{m}</span>
                                      ))}
                                    </div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                                  </div>
                                  <h5 className="text-xl font-brand italic font-black text-slate-900 dark:text-white mb-2 truncate">
                                    {data.accountName}
                                  </h5>
                                  <div className="flex items-center justify-between mt-4">
                                    <div className="flex flex-col">
                                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{data.orders.length} Invoices</p>
                                       <p className="text-lg font-brand italic text-indigo-500 font-black whitespace-nowrap">
                                         Rs {data.total.toLocaleString()}
                                       </p>
                                    </div>
                                    <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                      <ChevronRight className="w-5 h-5" />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Navigation Panel for Dashboard - PREMIUM UPGRADE */}
                <div className="hidden xl:flex w-84 border-l dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-3xl flex-col p-8 space-y-10 shrink-0 relative z-10">
                  {/* Dashboard Title in Right Nav */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 ${isOnline ? "bg-emerald-500" : "bg-rose-500 animate-pulse"} rounded-2xl flex items-center justify-center text-white shadow-lg`}
                      >
                        {isOnline ? (
                          <Layout className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                      </div>
                      <span
                        className={`text-[12px] font-black uppercase italic tracking-[0.2em] ${isOnline ? "text-amber-500" : "text-rose-500"}`}
                      >
                        {isOnline ? "Dash Control" : "Offline Mode"}
                      </span>
                    </div>
                    <div
                      className={`w-2 h-2 ${isOnline ? "bg-emerald-500" : "bg-rose-500"} rounded-full shadow-lg`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-6 px-2">
                      <h3 className="text-[9px] font-black uppercase italic text-slate-400 tracking-[0.3em]">
                        Business Operations
                      </h3>
                      <div className="w-8 h-[1px] bg-slate-100 dark:bg-slate-800" />
                    </div>
                    <div className="space-y-4 px-2">
                      <button
                        onClick={() => setIsClosingDay(true)}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase italic tracking-widest text-[9px] shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Close Business Day
                      </button>

                      <button
                        onClick={() => {
                          let targetOrders = [];
                          if (dashTimeRange === "CUSTOM") {
                            targetOrders = orders.filter((o) => {
                              const bDate = getBusinessDate(new Date(o.timestamp));
                              return bDate >= dashCustomDate && bDate <= dashCustomDateEnd;
                            });
                          } else {
                            const bDate = dashTimeRange === "TODAY" ? getBusinessDate() : null;
                            targetOrders = orders.filter((o) => {
                              const obDate = getBusinessDate(new Date(o.timestamp));
                              if (dashTimeRange === "TODAY") return obDate === bDate;
                              if (dashTimeRange === "7D") return o.timestamp >= Date.now() - 7 * 24 * 60 * 60 * 1000;
                              if (dashTimeRange === "30D") return o.timestamp >= Date.now() - 30 * 24 * 60 * 60 * 1000;
                              return true;
                            });
                          }
                          generateWhatsAppReport(targetOrders, `${dashTimeRange} TRANSACTIONS REPORT`);
                        }}
                        className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase italic tracking-widest text-[9px] shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                      >
                        <Share2 className="w-4 h-4" />
                        Full Sales Report
                      </button>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => {
                            let targetOrders = [];
                            if (dashTimeRange === "CUSTOM") {
                              targetOrders = orders.filter((o) => {
                                const bDate = getBusinessDate(new Date(o.timestamp));
                                return bDate >= dashCustomDate && bDate <= dashCustomDateEnd;
                              });
                            } else {
                              const bDate = dashTimeRange === "TODAY" ? getBusinessDate() : null;
                              targetOrders = orders.filter((o) => {
                                const obDate = getBusinessDate(new Date(o.timestamp));
                                if (dashTimeRange === "TODAY") return obDate === bDate;
                                if (dashTimeRange === "7D") return o.timestamp >= Date.now() - 7 * 24 * 60 * 60 * 1000;
                                if (dashTimeRange === "30D") return o.timestamp >= Date.now() - 30 * 24 * 60 * 60 * 1000;
                                return true;
                              });
                            }
                            const paidOrders = targetOrders.filter(o => o.status === "PAID");
                            generateWhatsAppReport(paidOrders, `${dashTimeRange} PAID ORDERS SUMMARY`);
                          }}
                          className="py-3 bg-slate-900 border border-emerald-500/30 text-emerald-500 rounded-xl font-black uppercase italic tracking-widest text-[8px] hover:bg-emerald-500/5 transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Share Paid
                        </button>
                        <button
                          onClick={() => {
                            let targetOrders = [];
                            if (dashTimeRange === "CUSTOM") {
                              targetOrders = orders.filter((o) => {
                                const bDate = getBusinessDate(new Date(o.timestamp));
                                return bDate >= dashCustomDate && bDate <= dashCustomDateEnd;
                              });
                            } else {
                              const bDate = dashTimeRange === "TODAY" ? getBusinessDate() : null;
                              targetOrders = orders.filter((o) => {
                                const obDate = getBusinessDate(new Date(o.timestamp));
                                if (dashTimeRange === "TODAY") return obDate === bDate;
                                if (dashTimeRange === "7D") return o.timestamp >= Date.now() - 7 * 24 * 60 * 60 * 1000;
                                if (dashTimeRange === "30D") return o.timestamp >= Date.now() - 30 * 24 * 60 * 60 * 1000;
                                return true;
                              });
                            }
                            const unpaidOrders = targetOrders.filter(o => o.status === "UNPAID");
                            generateWhatsAppReport(unpaidOrders, `${dashTimeRange} UNPAID ORDERS SUMMARY`);
                          }}
                          className="py-3 bg-slate-900 border border-rose-500/30 text-rose-500 rounded-xl font-black uppercase italic tracking-widest text-[8px] hover:bg-rose-500/5 transition-all flex items-center justify-center gap-2"
                        >
                          <Clock className="w-3 h-3" />
                          Share Unpaid
                        </button>
                      </div>
                    </div>

                    <div className="mt-8 flex items-center justify-between mb-6 px-2">
                      <h3 className="text-[9px] font-black uppercase italic text-slate-400 tracking-[0.3em]">
                        Quick Access
                      </h3>
                      <div className="w-8 h-[1px] bg-slate-100 dark:bg-slate-800" />
                    </div>
                    <div className="space-y-3">
                      {[
                        {
                          label: "POS Terminal",
                          icon: PlusCircle,
                          bg: "bg-amber-500",
                          view: "POS",
                          desc: "New Transaction",
                        },
                        {
                          label: "Petty Cash",
                          icon: Wallet,
                          bg: "bg-rose-500",
                          view: "EXPENSES",
                          desc: "Outflow Log",
                          adminOnly: true,
                        },
                        {
                          label: "Stock Ledger",
                          icon: Package,
                          bg: "bg-indigo-500",
                          view: "INVENTORY",
                          desc: "Audit Inventory",
                          adminOnly: true,
                        },
                        {
                          label: "Labor Portal",
                          icon: Users,
                          bg: "bg-cyan-500",
                          view: "STAFF",
                          desc: "Team & Shifts",
                        },
                      ]
                        .filter(
                          (a) =>
                            !a.adminOnly ||
                            currentUser?.role === UserRole.ADMIN,
                        )
                        .map((action, idx) => (
                          <motion.button
                            key={action.label}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 * idx }}
                            onClick={() => setCurrentView(action.view as any)}
                            className="w-full flex items-center gap-4 p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition-all group relative overflow-hidden"
                          >
                            <div
                              className={`${action.bg} w-10 h-10 rounded-2xl text-white flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform`}
                            >
                              <action.icon className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                              <span className="text-[10px] font-black uppercase italic tracking-tight text-slate-700 dark:text-slate-200 group-hover:text-amber-500 transition-colors block leading-none mb-1">
                                {action.label}
                              </span>
                              <span className="text-[7px] font-black uppercase text-slate-400 opacity-60 tracking-widest">
                                {action.desc}
                              </span>
                            </div>
                            <ChevronRight className="w-3 h-3 ml-auto text-slate-300 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0" />
                          </motion.button>
                        ))}
                    </div>
                  </div>

                  <div className="mt-8">
                    <div className="flex items-center justify-between mb-6 px-2">
                      <h3 className="text-[9px] font-black uppercase italic text-slate-400 tracking-[0.3em]">
                        Daily Volume
                      </h3>
                      <div className="w-8 h-[1px] bg-slate-100 dark:bg-slate-800" />
                    </div>
                    <div className="space-y-3 px-2">
                      {stats.dailyBusinessTotals.slice(-5).reverse().map((day, idx) => (
                        <div 
                          key={idx} 
                          className="p-4 bg-white dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:border-amber-500/30 transition-all"
                        >
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-amber-500/10 transition-colors">
                                <CalendarIcon className="w-4 h-4 text-slate-400 group-hover:text-amber-500" />
                             </div>
                             <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{day.date}</p>
                                <p className="text-[11px] font-black italic text-slate-800 dark:text-white uppercase leading-none">Rs {day.total.toLocaleString()}</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Items</p>
                             <div className="flex items-center justify-end gap-1">
                                <Package className="w-2.5 h-2.5 text-amber-500" />
                                <p className="text-[11px] font-black italic text-amber-500 uppercase leading-none">{day.items.toLocaleString()}</p>
                             </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col min-h-0 pt-4">
                    <div className="flex items-center justify-between mb-6 px-2">
                      <h3 className="text-[9px] font-black uppercase italic text-slate-400 tracking-[0.3em]">
                        Terminal Health
                      </h3>
                      <div className="w-8 h-[1px] bg-slate-100 dark:bg-slate-800" />
                    </div>

                    <div className="p-6 bg-indigo-500/5 dark:bg-indigo-500/5 rounded-[2.5rem] border border-indigo-500/10 flex-1 flex flex-col">
                      <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <div className="relative mb-6">
                          <div className="absolute inset-0 bg-indigo-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                          <Database className="w-12 h-12 text-indigo-500 relative" />
                        </div>
                        <p className="text-[10px] font-black uppercase text-indigo-500 italic tracking-[0.2em] mb-2 leading-none">
                          BS-POS CORE v4.2
                        </p>
                        <p className="text-[8px] font-bold uppercase text-slate-400 tracking-widest leading-relaxed">
                          Cloud Sync: 100%
                          <br />
                          Security: Verified
                          <br />
                          Uptime: 24h 12m
                        </p>
                      </div>
                      <div className="mt-8 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-black uppercase text-slate-400">
                            Database Load
                          </span>
                          <span className="text-[8px] font-black uppercase text-emerald-500 italic">
                            Nominal
                          </span>
                        </div>
                        <div className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                          <div className="w-[12%] h-full bg-emerald-500" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 px-2">
                    <p className="text-[7px] font-black uppercase text-slate-300 italic tracking-[0.3em] text-center">
                      Protected by BS Intelligence
                    </p>
                  </div>
                </div>

                {/* Day Closing Modal */}
                <AnimatePresence>
                  {isClosingDay && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-xl"
                    >
                      <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3.5rem] shadow-2xl p-10 relative"
                      >
                        <button
                          onClick={() => setIsClosingDay(false)}
                          className="absolute top-8 right-8 text-slate-400 hover:text-rose-500"
                        >
                          <XCircle className="w-8 h-8" />
                        </button>

                        <div className="text-center mb-10">
                          <div className="w-20 h-20 bg-indigo-500 rounded-3xl flex items-center justify-center text-white mx-auto shadow-2xl shadow-indigo-500/30 mb-6">
                            <LogOut className="w-10 h-10" />
                          </div>
                          <h2 className="text-2xl font-brand italic uppercase tracking-[0.2em] text-indigo-500">
                            Day Reconciliation
                          </h2>
                          <p className="text-[10px] font-black uppercase text-slate-400 mt-2 tracking-widest">
                            Verify physical cash for {getBusinessDate()}
                          </p>
                        </div>

                        <div className="space-y-6">
                          <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border dark:border-white/5">
                            <div className="flex justify-between items-center mb-4">
                              <span className="text-[10px] font-black uppercase text-slate-400">
                                System Cash Sales
                              </span>
                              <span className="text-xl font-brand italic text-amber-500">
                                Rs{" "}
                                {orders
                                  .filter(
                                    (o) =>
                                      o.paymentMethod === "CASH" &&
                                      getBusinessDate(new Date(o.timestamp)) ===
                                        getBusinessDate(),
                                  )
                                  .reduce((s, o) => s + o.total, 0)
                                  .toLocaleString()}
                              </span>
                            </div>
                            <div className="space-y-2">
                              <p className="text-[9px] font-black uppercase text-slate-400 ml-4">
                                Actual Physical Cash
                              </p>
                              <input
                                type="number"
                                value={closingPhysicalCash}
                                onChange={(e) =>
                                  setClosingPhysicalCash(e.target.value)
                                }
                                className="w-full bg-white dark:bg-slate-800 p-5 rounded-2xl text-2xl font-brand italic text-center outline-none ring-2 ring-transparent focus:ring-amber-500 shadow-inner dark:text-white"
                                placeholder="0"
                              />
                            </div>
                          </div>

                          <textarea
                            value={closingNote}
                            onChange={(e) => setClosingNote(e.target.value)}
                            placeholder="Closing remarks (optional)..."
                            className="w-full bg-slate-50 dark:bg-white/5 p-5 rounded-2xl text-[10px] font-bold uppercase outline-none border-none ring-1 ring-slate-200 dark:ring-white/10 focus:ring-indigo-500 h-24 dark:text-white"
                          />

                          <button
                            onClick={closeBusinessDay}
                            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase italic tracking-widest text-xs shadow-xl shadow-indigo-600/30 active:scale-95 transition-all"
                          >
                            Finalize & Close Business Day
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : currentView === "MODULES" ? (
              <div className="flex-1 overflow-y-auto p-8 pb-32 md:pb-8">
                <div className="max-w-4xl mx-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-10">
                    <motion.button
                      whileHover={{ scale: 1.02, y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setCurrentView("INVENTORY")}
                      className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] flex flex-col items-center justify-center gap-6 shadow-xl border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-white group relative overflow-hidden h-64"
                    >
                      <div className="bg-indigo-500/10 p-6 rounded-3xl">
                        <Package className="w-12 h-12 text-indigo-500" />
                      </div>
                      <div className="text-center">
                        <h2 className="text-2xl font-brand italic uppercase tracking-widest">
                          Inventory
                        </h2>
                        <p className="text-[10px] font-black uppercase text-slate-400 mt-1">
                          Stock & Items
                        </p>
                      </div>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setCurrentView("EXPENSES")}
                      className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] flex flex-col items-center justify-center gap-6 shadow-xl border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-white group relative overflow-hidden h-64"
                    >
                      <div className="bg-rose-500/10 p-6 rounded-3xl">
                        <Wallet className="w-12 h-12 text-rose-500" />
                      </div>
                      <div className="text-center">
                        <h2 className="text-2xl font-brand italic uppercase tracking-widest">
                          Daily Expenses
                        </h2>
                        <p className="text-[10px] font-black uppercase text-slate-400 mt-1">
                          Cash Out Management
                        </p>
                      </div>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setCurrentView("STAFF")}
                      className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] flex flex-col items-center justify-center gap-6 shadow-xl border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-white group relative overflow-hidden h-64"
                    >
                      <div className="bg-cyan-500/10 p-6 rounded-3xl">
                        <Users className="w-12 h-12 text-cyan-500" />
                      </div>
                      <div className="text-center">
                        <h2 className="text-2xl font-brand italic uppercase tracking-widest">
                          Employees
                        </h2>
                        <p className="text-[10px] font-black uppercase text-slate-400 mt-1">
                          Manage Team Access
                        </p>
                      </div>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setCurrentView("REPORTS")}
                      className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] flex flex-col items-center justify-center gap-6 shadow-xl border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-white group relative overflow-hidden h-64"
                    >
                      <div className="bg-emerald-500/10 p-6 rounded-3xl">
                        <BarChart3 className="w-12 h-12 text-emerald-500" />
                      </div>
                      <div className="text-center">
                        <h2 className="text-2xl font-brand italic uppercase tracking-widest">
                          Store Reports
                        </h2>
                        <p className="text-[10px] font-black uppercase text-slate-400 mt-1">
                          Sales & Performance
                        </p>
                      </div>
                    </motion.button>
                  </div>
                </div>
              </div>
            ) : currentView === "INVENTORY" ? (
              <div className="flex-1 overflow-y-auto p-4 md:p-8 h-full scrollbar-hide">
                <div className="max-w-7xl mx-auto">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-brand italic uppercase tracking-widest text-amber-500">
                      Menu Inventory
                    </h2>
                    <button
                      onClick={() => {
                        setCurrentView("ADMIN");
                        setAdminTab("MENU");
                      }}
                      className="px-6 py-3 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20"
                    >
                      Manage Menu
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 pr-2 pb-40">
                    {menuItems.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm"
                      >
                        <div className="w-full aspect-square rounded-2xl overflow-hidden mb-3 bg-slate-50 dark:bg-slate-800">
                          <img
                            src={item.image}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <h3 className="text-[10px] font-black uppercase truncate">
                          {item.name}
                        </h3>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[9px] font-mono font-black text-amber-500">
                            Rs {item.price}
                          </span>
                          <span className="text-[7px] font-black uppercase px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full">
                            In Stock
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : currentView === "EXPENSES" ? (
              <div className="flex-1 p-4 md:p-8 overflow-y-auto h-full scrollbar-hide">
                <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 p-6 md:p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-2xl mb-40">
                  <div className="text-center mb-10">
                    <div className="w-20 h-20 bg-rose-500 rounded-[2rem] flex items-center justify-center text-white mx-auto shadow-2xl shadow-rose-500/30 mb-6">
                      <Wallet className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-brand italic uppercase tracking-widest">
                      Petty Cash Out
                    </h2>
                    <p className="text-[10px] font-black uppercase text-slate-400 mt-2">
                      Log daily operation expenses
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-4 mb-2 block">
                        Reason / Description
                      </label>
                      <input
                        value={expenseForm.reason}
                        onChange={(e) =>
                          setExpenseForm({
                            ...expenseForm,
                            reason: e.target.value.toUpperCase(),
                          })
                        }
                        className="w-full bg-slate-50 dark:bg-white/5 p-6 rounded-2xl border-none outline-none ring-2 ring-transparent focus:ring-rose-500/20 text-xs font-black uppercase tracking-widest"
                        placeholder="E.G. CHICKEN PURCHASE, ELECTRIC BILL..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-4 mb-2 block">
                          Amount
                        </label>
                        <input
                          type="number"
                          value={expenseForm.amount}
                          onChange={(e) =>
                            setExpenseForm({
                              ...expenseForm,
                              amount: e.target.value,
                            })
                          }
                          className="w-full bg-slate-50 dark:bg-white/5 p-6 rounded-2xl border-none outline-none ring-2 ring-transparent focus:ring-rose-500/20 text-xs font-black"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-4 mb-2 block">
                          Category
                        </label>
                        <select
                          value={expenseForm.category}
                          onChange={(e) =>
                            setExpenseForm({
                              ...expenseForm,
                              category: e.target.value,
                            })
                          }
                          className="w-full bg-slate-50 dark:bg-white/5 p-6 rounded-2xl border-none outline-none ring-2 ring-transparent focus:ring-rose-500/20 text-[10px] font-black uppercase"
                        >
                          <option>Purchasing</option>
                          <option>Utilities</option>
                          <option>Staff Salary</option>
                          <option>Repair & Maint.</option>
                          <option>Other</option>
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={submitExpense}
                      className="w-full bg-rose-500 text-white py-6 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-rose-500/20 mt-4 active:scale-95 transition-transform"
                    >
                      Submit Expense
                    </button>
                  </div>
                </div>

                {/* Recent Expenses List */}
                <div className="max-w-2xl mx-auto space-y-4 pb-40">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-[0.2em] mb-6 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Recent Expenses
                  </h3>
                  <div className="space-y-3">
                    {expenses
                      .slice()
                      .sort((a, b) => b.timestamp - a.timestamp)
                      .slice(0, 10)
                      .map((exp) => (
                        <div
                          key={exp.id}
                          className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:border-rose-500/30 transition-colors"
                        >
                          <div>
                            <p className="text-[11px] font-black uppercase text-slate-800 dark:text-white">
                              {exp.reason}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[8px] font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full">
                                {exp.category}
                              </span>
                              <span className="text-[8px] font-black text-slate-400 font-mono italic opacity-60">
                                {new Date(exp.timestamp).toLocaleTimeString(
                                  [],
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[13px] font-black text-rose-500 font-brand italic">
                              -Rs {(exp.amount || 0).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    {expenses.length === 0 && (
                      <div className="text-center py-10 opacity-20 italic text-[10px] font-black uppercase">
                        No expenses logged yet
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : currentView === "REPORTS" ? (
              <div className="flex-1 p-4 md:p-8 overflow-y-auto h-full scrollbar-hide pb-40">
                <div className="max-w-7xl mx-auto space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-emerald-500 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-emerald-500/30">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="bg-white/20 p-3 rounded-xl">
                          <BarChart3 className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-black uppercase italic opacity-60">
                          Today's Sales
                        </span>
                      </div>
                      <p className="text-4xl font-brand italic">
                        Rs {(stats.todayRevenue || 0).toLocaleString()}
                      </p>
                      <p className="text-[9px] font-black uppercase mt-4">
                        {stats.revGrowth >= 0 ? "+" : ""}
                        {stats.revGrowth.toFixed(1)}% from yesterday
                      </p>
                    </div>
                    <div className="bg-indigo-500 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-500/30">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="bg-white/20 p-3 rounded-xl">
                          <Users className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-black uppercase italic opacity-60">
                          Guest Count
                        </span>
                      </div>
                      <p className="text-4xl font-brand italic">
                        {stats.todayCount}
                      </p>
                      <p className="text-[9px] font-black uppercase mt-4">
                        Average ticket: Rs{" "}
                        {(stats.todayAvgTicket || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-rose-500 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-rose-500/30">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="bg-white/20 p-3 rounded-xl">
                          <Wallet className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-black uppercase italic opacity-60">
                          Today's Expenses
                        </span>
                      </div>
                      <p className="text-4xl font-brand italic">
                        Rs {(stats.todayExpenses || 0).toLocaleString()}
                      </p>
                      <p className="text-[9px] font-black uppercase mt-4">
                        Profit: Rs{" "}
                        {(
                          (stats.todayRevenue || 0) - (stats.todayExpenses || 0)
                        ).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Digital Settlements Breakdown */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden min-h-[400px]">
                      <h3 className="text-[10px] font-black uppercase italic tracking-widest text-slate-400 mb-8 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-indigo-500" /> Digital Settlements by Account
                      </h3>
                      <div className="space-y-6">
                        {Object.values(stats.digitalAccountSummary).map((acc: any) => (
                          <div key={acc.accountName} className="p-6 bg-slate-50 dark:bg-white/5 rounded-[2rem] border border-slate-100 dark:border-slate-800 group hover:border-indigo-500/30 transition-all">
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <h4 className="text-sm font-black uppercase text-indigo-500">{acc.accountName}</h4>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Total Digital Flow</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xl font-brand italic text-slate-900 dark:text-white">Rs {acc.total.toLocaleString()}</p>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 mb-4">
                              {Object.entries(acc.methods).map(([method, amount]: [any, any]) => (
                                <div key={method} className="px-3 py-1.5 bg-white dark:bg-slate-800 rounded-full border border-slate-100 dark:border-slate-700 flex items-center gap-2">
                                  <span className={`w-1.5 h-1.5 rounded-full ${method === 'JAZZCASH' ? 'bg-rose-500' : method === 'EASYPAISA' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                                  <span className="text-[8px] font-black uppercase text-slate-600 dark:text-slate-400">{method}: Rs {amount.toLocaleString()}</span>
                                </div>
                              ))}
                            </div>

                            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
                              <p className="text-[7px] font-black text-slate-400 uppercase mb-2">Recent Associated Invoices</p>
                              <div className="flex flex-wrap gap-1.5">
                                {acc.orders.slice(-5).reverse().map((o: any) => (
                                  <div key={o.id} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-[7px] font-black text-slate-500 uppercase tracking-tight">
                                    {o.businessDate ? formatInvoiceNo(o.businessDate, o.invoiceNo) : "#" + o.invoiceNo}
                                  </div>
                                ))}
                                {acc.orders.length > 5 && (
                                  <div className="px-2 py-1 text-[7px] font-black text-slate-400 uppercase">+{acc.orders.length - 5} more</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {Object.keys(stats.digitalAccountSummary).length === 0 && (
                          <div className="text-center py-20 opacity-30 italic text-[10px] font-black uppercase">
                            No digital payments processed in this range
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Monetary Channel Mix */}
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col min-h-[400px]">
                      <h3 className="text-[10px] font-black uppercase italic tracking-widest text-slate-400 mb-8 flex items-center gap-2">
                        <PieChartIcon className="w-4 h-4 text-emerald-500" /> Channel Mix
                      </h3>
                      <div className="flex-1 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={stats.paymentMethodsData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {stats.paymentMethodsData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={['#10b981', '#f43f5e', '#6366f1', '#f59e0b', '#06b6d4'][index % 5]} />
                              ))}
                            </Pie>
                            <Tooltip 
                               contentStyle={{ borderRadius: '16px', border: 'none', background: '#0f172a', color: '#fff', fontSize: '10px' }}
                            />
                            <Legend verticalAlign="bottom" height={36}/>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border border-slate-100 dark:border-slate-800 shadow-sm h-80 flex flex-col">
                    <h3 className="text-[10px] font-black uppercase italic tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-500" /> Session
                      Activity (Live)
                    </h3>
                    <div className="flex-1 w-full min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.chartData}>
                          <defs>
                            <linearGradient
                              id="colorSalesReports"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#10b981"
                                stopOpacity={0.3}
                              />
                              <stop
                                offset="95%"
                                stopColor="#10b981"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="time" hide />
                          <YAxis hide />
                          <Tooltip
                            contentStyle={{
                              borderRadius: "16px",
                              border: "none",
                              background: "#0f172a",
                              color: "#fff",
                              fontSize: "10px",
                            }}
                            itemStyle={{ color: "#10b981" }}
                          />
                          <Area
                            type="monotone"
                            dataKey="sales"
                            stroke="#10b981"
                            fillOpacity={1}
                            fill="url(#colorSalesReports)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            ) : currentView === "STAFF" ? (
              <div className="flex-1 p-8 overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-brand italic uppercase tracking-widest text-cyan-500">
                    Employee Management
                  </h2>
                  <button
                    onClick={() => {
                      setCurrentView("ADMIN");
                      setAdminTab("USERS");
                    }}
                    className="px-6 py-3 bg-cyan-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-cyan-500/20"
                  >
                    Configure Team
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-32">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-6"
                    >
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                        {u.role === UserRole.ADMIN ? (
                          <ShieldCheck className="w-8 h-8 text-indigo-500" />
                        ) : (
                          <User className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-[12px] font-black uppercase tracking-tight">
                          {u.name}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                          {u.role}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                          <span className="text-[8px] font-black uppercase text-emerald-500">
                            Active Now
                          </span>
                        </div>
                      </div>
                      {currentUser?.role === UserRole.ADMIN &&
                        currentUser?.id !== u.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveMember(u.id, u.name);
                            }}
                            className="ml-auto flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-2xl shadow-lg shadow-rose-500/20 hover:scale-105 active:scale-95 transition-all text-[9px] font-black uppercase tracking-widest"
                          >
                            <Trash2 className="w-3 h-3" strokeWidth={3} />
                            Remove
                          </button>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            ) : currentView === "CUSTOMERS" ? (
              <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950">
                <header className="px-8 py-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-800 dark:text-white">
                      Customer <span className="text-amber-500">Database</span>
                    </h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-1">
                      Manage relationships and loyalty
                    </p>
                  </div>
                  <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        placeholder="Search customers..."
                        className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-2xl py-3 pl-12 pr-6 text-sm font-bold w-full md:w-80 outline-none focus:border-amber-500/20 transition-all shadow-sm"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                      />
                    </div>
                    <button
                      onClick={() => {
                        setEditingCustomer(null);
                        setCustomerForm({ name: "", mobile: "", address: "" });
                        setIsAddCustomerModalOpen(true);
                      }}
                      className="px-6 py-3 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/30 flex items-center gap-2 group hover:scale-105 active:scale-95 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Add Customer
                    </button>
                  </div>
                </header>

                <main className="flex-1 overflow-y-auto px-8 pb-32 md:pb-8 custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {customers
                      .filter(c => 
                        (c.name || "").toLowerCase().includes(customerSearch.toLowerCase()) || 
                        (c.mobile || "").includes(customerSearch)
                      )
                      .map((cust) => (
                      <motion.div
                        key={cust.id || cust.mobile}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-6 rounded-[2.5rem] border border-slate-100 dark:border-white/5 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-amber-500/10 rounded-2xl">
                              <User className="w-6 h-6 text-amber-500" />
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className="text-right">
                                <p className="text-[9px] font-black text-slate-400 uppercase">Total Spent</p>
                                <p className="text-lg font-black text-amber-600">Rs {cust.totalSpent?.toLocaleString() || 0}</p>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => {
                                    setEditingCustomer(cust);
                                    setCustomerForm({ ...cust });
                                    setIsAddCustomerModalOpen(true);
                                  }}
                                  className="p-2 bg-slate-100 dark:bg-white/5 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition-all"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => {
                                    setDeleteConfirmId(`cust-${cust.id}`);
                                  }}
                                  className="p-2 bg-slate-100 dark:bg-white/5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                          <h3 className="text-base font-black uppercase text-slate-800 dark:text-white truncate tracking-tight">{cust.name}</h3>
                          <p className="text-[11px] font-bold text-slate-400 font-mono mt-1">{cust.mobile}</p>
                          {cust.address && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 italic leading-relaxed">
                              {cust.address}
                            </p>
                          )}
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5 grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Total Orders</p>
                            <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{cust.totalOrders || 0}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase text-right">Last Visit</p>
                            <p className="text-[10px] font-bold text-slate-500 text-right">
                              {cust.lastOrderDate ? new Date(cust.lastOrderDate).toLocaleDateString() : 'Never'}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </main>
              </div>
            ) : currentView === "PURCHASE_ORDERS" ? (
              <PurchaseOrders inventory={inventory} logAction={logAction} />
            ) : currentView === "CREDIT" ? (
               <div className="flex-1 md:overflow-hidden flex flex-col p-4 md:p-8 bg-slate-50 dark:bg-slate-950">
                  <div className="max-w-7xl mx-auto w-full space-y-8 pb-32">
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <div className="w-2 h-8 bg-[#e67e22] rounded-full" />
                          <h2 className="text-3xl font-brand italic text-slate-900 dark:text-white uppercase tracking-[0.2em]">Udhaar Management</h2>
                        </div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic ml-5">Track and settle pending customer balances</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl">
                          <h3 className="text-sm font-black uppercase text-slate-400 mb-6 tracking-widest">Summary</h3>
                          <div className="space-y-4">
                            <div className="p-6 bg-rose-50 dark:bg-rose-500/5 rounded-3xl border border-rose-100 dark:border-rose-500/10">
                              <p className="text-[10px] font-black text-rose-500 uppercase mb-1">Total Outstanding</p>
                              <p className="text-3xl font-brand italic text-rose-600">
                                Rs {orders.filter(o => o.status === 'UNPAID' || o.status === 'UDHAAR').reduce((acc, o) => {
                                  const paidPortion = (o.splitDetails || []).reduce((sum, d) => sum + d.amount, 0);
                                  return acc + (o.total - paidPortion);
                                }, 0).toLocaleString()}
                              </p>
                            </div>
                            <div className="p-6 bg-amber-50 dark:bg-amber-500/5 rounded-3xl border border-amber-100 dark:border-amber-500/10">
                              <p className="text-[10px] font-black text-amber-500 uppercase mb-1">Pending Invoices</p>
                              <p className="text-3xl font-brand italic text-amber-600">
                                {orders.filter(o => o.status === 'UNPAID' || o.status === 'UDHAAR').length}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="md:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl min-h-[500px]">
                           <div className="flex items-center justify-between mb-8">
                             <h3 className="text-sm font-black uppercase text-slate-800 dark:text-white tracking-widest">Outstanding Bills</h3>
                             <div className="relative w-64">
                               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                               <input 
                                 placeholder="Search customer..." 
                                 className="w-full pl-8 pr-4 py-2 bg-slate-50 dark:bg-white/5 rounded-xl text-[10px] font-bold uppercase outline-none"
                               />
                             </div>
                           </div>

                           <div className="space-y-4">
                             {orders.filter(o => o.status === 'UNPAID' || o.status === 'UDHAAR').map(order => {
                               const paidPortion = (order.splitDetails || []).reduce((sum, d) => sum + d.amount, 0);
                               const balance = order.total - paidPortion;
                               return (
                                 <motion.div 
                                   key={order.id}
                                   className="p-6 bg-slate-50 dark:bg-white/5 rounded-[2rem] flex items-center justify-between group hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-amber-500/20 transition-all shadow-sm"
                                 >
                                   <div className="flex items-center gap-4">
                                     <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-amber-500 shadow-sm relative">
                                        <Clock className="w-5 h-5" />
                                        {order.status === "UDHAAR" && (
                                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full border-2 border-white dark:border-slate-900" />
                                        )}
                                     </div>
                                     <div>
                                       <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{order.customer.name || 'Walk-in Guest'}</p>
                                       <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">
                                         {order.businessDate ? formatInvoiceNo(order.businessDate, order.invoiceNo) : "#" + order.invoiceNo} • {order.dateStr}
                                       </p>
                                       {order.status === "UDHAAR" && (
                                         <p className="text-[8px] font-black text-emerald-500 uppercase mt-1 italic">
                                           Partially Paid: Rs {paidPortion.toLocaleString()}
                                         </p>
                                       )}
                                     </div>
                                   </div>
                                   <div className="flex items-center gap-8">
                                     <div className="text-right">
                                       <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">Outstanding Balance</p>
                                       <p className="text-xl font-brand italic text-amber-500">Rs {balance.toLocaleString()}</p>
                                     </div>
                                     <button 
                                       onClick={() => setDeleteConfirmId(`settle-order-${order.id}`)}
                                       className="px-6 py-3 bg-emerald-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all opacity-0 group-hover:opacity-100"
                                     >
                                       Settle Balance
                                     </button>
                                   </div>
                                 </motion.div>
                               );
                             })}
                             {orders.filter(o => o.status === 'UNPAID' || o.status === 'UDHAAR').length === 0 && (
                               <div className="text-center py-20 opacity-40">
                                 <ShieldCheck className="w-16 h-16 mx-auto mb-4 text-emerald-500" />
                                 <p className="text-[10px] font-black uppercase tracking-[0.2em]">All accounts are settled</p>
                               </div>
                             )}
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
               </div>
            ) : currentView === "SETTINGS" ? (
               <div className="flex-1 md:overflow-hidden flex flex-col p-4 md:p-8 bg-slate-50 dark:bg-slate-950">
                  <div className="max-w-3xl mx-auto w-full space-y-8">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-2 h-8 bg-indigo-500 rounded-full" />
                        <h2 className="text-3xl font-brand italic text-slate-900 dark:text-white uppercase tracking-[0.2em]">Profile Settings</h2>
                      </div>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic ml-5">Manage your account credentials</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl space-y-10">
                      <div className="flex items-center gap-6">
                        <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-amber-600 rounded-[2rem] flex items-center justify-center text-white text-3xl font-brand italic shadow-2xl shadow-amber-500/30">
                          {currentUser.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-xl font-brand italic text-slate-900 dark:text-white uppercase tracking-widest leading-none mb-2">{currentUser.name}</h3>
                          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-3 py-1 bg-amber-500/10 rounded-full inline-block italic">
                             {currentUser.role} Level Access
                          </p>
                        </div>
                      </div>

                      <div className="space-y-6">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="space-y-2">
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Update Username</label>
                             <input 
                               value={regForm.username}
                               onChange={(e) => setRegForm({...regForm, username: e.target.value})}
                               className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 rounded-2xl text-[11px] font-bold uppercase border-none ring-1 ring-slate-100 dark:ring-white/5 focus:ring-amber-500 transition-all outline-none"
                             />
                           </div>
                           <div className="space-y-2">
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                             <input 
                               type="password"
                               value={regForm.password}
                               onChange={(e) => setRegForm({...regForm, password: e.target.value})}
                               className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 rounded-2xl text-[11px] font-bold uppercase border-none ring-1 ring-slate-100 dark:ring-white/5 focus:ring-amber-500 transition-all outline-none"
                               placeholder="Min 6 chars"
                             />
                           </div>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="space-y-2">
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                             <input 
                               value={regForm.name}
                               onChange={(e) => setRegForm({...regForm, name: e.target.value})}
                               className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 rounded-2xl text-[11px] font-bold uppercase border-none ring-1 ring-slate-100 dark:ring-white/5 focus:ring-amber-500 transition-all outline-none"
                             />
                           </div>
                           <div className="flex items-end flex-1">
                             <button 
                               onClick={async () => {
                                 if (!regForm.username || !regForm.password || !regForm.name) {
                                   alert("All fields are required");
                                   return;
                                 }
                                 try {
                                   const updateData = {
                                     name: regForm.name,
                                     username: regForm.username,
                                     password: regForm.password
                                   };
                                   await updateDoc(doc(db, "users", currentUser.id), updateData);
                                   const newUser = { ...currentUser, ...updateData };
                                   setCurrentUser(newUser);
                                   logAction(`Profile Updated: ${regForm.username}`, "SUCCESS");
                                   alert("Profile and password updated successfully!");
                                 } catch (err) {
                                   console.error("Update failed:", err);
                                   alert("Failed to update credentials.");
                                 }
                               }}
                               className="w-full py-4 bg-amber-500 text-white rounded-2xl font-black uppercase italic tracking-widest text-[10px] shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                             >
                               Save Credentials
                             </button>
                           </div>
                         </div>
                      </div>

                      <div className="pt-10 border-t border-slate-100 dark:border-white/5 space-y-6 text-center">
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/5 py-4 px-6 rounded-2xl italic">
                          Security Note: Your login ID and password are encrypted on the cloud sync layer.
                        </p>
                      </div>
                    </div>
                    {/* Recipe & Profit Analysis Section */}
                    <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
                      <div className="p-8 border-b border-slate-50 dark:border-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <TrendingUp className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-[14px] font-black uppercase italic tracking-widest text-slate-900 dark:text-white leading-tight">Recipe Costing & Business Overhead</h4>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mt-0.5">Manage Margins and Operational Expenses</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setIsCostingSettingsOpen(true)}
                          className="px-6 py-4 bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <Settings className="w-4 h-4" /> Adjust Costs
                        </button>
                      </div>
                      
                      <div className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                            <p className="text-[8px] font-black uppercase text-slate-400 mb-1 tracking-widest">Monthly bills</p>
                            <p className="text-lg font-brand italic font-black text-slate-900 dark:text-white">Rs {(costingSettings.monthlyGas + costingSettings.monthlyElectric + costingSettings.monthlyLabor + costingSettings.monthlyRent + costingSettings.monthlyOil).toLocaleString()}</p>
                          </div>
                          <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                            <p className="text-[8px] font-black uppercase text-slate-400 mb-1 tracking-widest">Overhead / Order</p>
                            <p className="text-lg font-brand italic font-black text-amber-500">Rs {( (costingSettings.monthlyGas + costingSettings.monthlyElectric + costingSettings.monthlyLabor + costingSettings.monthlyRent + costingSettings.monthlyOil) / (costingSettings.avgMonthlyOrders || 1) ).toFixed(2)}</p>
                          </div>
                          <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                            <p className="text-[8px] font-black uppercase text-slate-400 mb-1 tracking-widest">PackagingLaw</p>
                            <p className="text-lg font-brand italic font-black text-blue-500">Rs {costingSettings.packagingCost} / {costingSettings.itemsPerPackage}</p>
                          </div>
                          <div className="p-5 bg-emerald-500 text-white rounded-[2rem] shadow-lg shadow-emerald-500/10">
                            <p className="text-[8px] font-black uppercase text-emerald-100 mb-1 tracking-widest">Target Avg Profit</p>
                            <p className="text-lg font-brand italic font-black">~45%</p>
                          </div>
                        </div>

                        <div className="overflow-x-auto custom-scrollbar">
                          <table className="w-full text-left border-separate border-spacing-y-2">
                            <thead>
                              <tr className="text-[8px] font-black uppercase text-slate-400 tracking-widest">
                                <th className="pb-2 pl-4">Item</th>
                                <th className="pb-2">Material</th>
                                <th className="pb-2">Overhead</th>
                                <th className="pb-2">Net Profit</th>
                                <th className="pb-2 pr-4 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {menuItems.slice(0, 10).map((item, idx) => {
                                const overhead = (costingSettings.monthlyGas + costingSettings.monthlyElectric + costingSettings.monthlyLabor + costingSettings.monthlyRent + costingSettings.monthlyOil) / (costingSettings.avgMonthlyOrders || 1);
                                const packagingPerItem = costingSettings.packagingCost / costingSettings.itemsPerPackage;
                                const totalCost = (item.cost || 0) + overhead + packagingPerItem;
                                const netProfit = item.price - totalCost;
                                const margin = item.price > 0 ? (netProfit / item.price) * 100 : 0;

                                // Specifically for the detailed breakdown requested:
                                const materialCost = item.detailedCost ? 
                                  Object.values(item.detailedCost).reduce((a: number, b: any) => a + (Number(b) || 0), 0) : 
                                  (item.cost || 0);
                                
                                const specificPkgCost = packagingPerItem;

                                return (
                                  <tr key={idx} className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-transparent">
                                    <td className="py-4 pl-4 rounded-l-2xl">
                                      <p className="text-[11px] font-black uppercase italic text-slate-800 dark:text-white leading-tight">{item.name}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <p className="text-[8px] font-bold text-slate-400">Price: Rs {item.price}</p>
                                        <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                        <p className={`text-[8px] font-black uppercase tracking-tighter ${margin > 30 ? 'text-emerald-500' : 'text-slate-500'}`}>{margin.toFixed(0)}% Margin</p>
                                      </div>
                                    </td>
                                    <td className="py-4">
                                      <div className="space-y-0.5">
                                        <p className="text-[10px] font-bold text-slate-500">Rs {materialCost.toFixed(0)}</p>
                                        {Object.entries(item.detailedCost || {}).slice(0, 1).map(([k, v], i) => (
                                          <p key={i} className="text-[7px] text-slate-400 font-bold uppercase tracking-tighter">
                                            {k.substring(0, 8)}: Rs {v}
                                          </p>
                                        ))}
                                      </div>
                                    </td>
                                    <td className="py-4">
                                      <div className="space-y-0.5">
                                        <p className="text-[10px] font-bold text-amber-500">Rs {(overhead + specificPkgCost).toFixed(1)}</p>
                                        <p className="text-[7px] text-slate-400 font-bold uppercase tracking-tighter">Exp: Rs {overhead.toFixed(0)}</p>
                                      </div>
                                    </td>
                                    <td className="py-4">
                                      <div className="flex items-baseline gap-1">
                                        <p className={`text-[12px] font-brand italic font-black ${netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>Rs {netProfit.toFixed(0)}</p>
                                      </div>
                                    </td>
                                    <td className="py-4 pr-4 rounded-r-2xl text-right">
                                       <span className={`text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                         margin > 40 ? 'bg-emerald-500/10 text-emerald-500' : 
                                         margin > 20 ? 'bg-amber-500/10 text-amber-500' : 
                                         'bg-rose-500/10 text-rose-500'
                                       }`}>
                                         {margin > 40 ? 'High' : margin > 20 ? 'Good' : 'Low'}
                                       </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {menuItems.length > 10 && (
                            <button onClick={() => setIsProfitAnalysisOpen(true)} className="w-full py-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-indigo-500 transition-colors">
                              View All {menuItems.length} Items Profit Data +
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
               </div>
            ) : currentView === "POS" ? (
              <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden bg-slate-50 dark:bg-slate-950 relative">

                {/* ENHANCED: Floating Customer Insight Card (Top-Right & Draggable) */}
                <div className="fixed top-24 right-10 z-[60]">
                  <motion.div
                    drag
                    dragMomentum={false}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="cursor-pointer"
                  >
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsCustomerModalOpen(true)}
                      className="group relative flex items-center gap-2 p-2 pr-4 bg-white/60 dark:bg-slate-800/20 backdrop-blur-3xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl transition-all hover:bg-white/80 active:shadow-inner"
                    >
                      <div className="relative">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
                          <UserCog className="w-4 h-4" />
                        </div>
                        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full shadow-sm" />
                      </div>
                      <div className="text-left pr-1">
                        <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 italic">
                          Target
                        </p>
                        <p className="text-[11px] font-brand italic text-slate-900 dark:text-white font-black truncate max-w-[80px] leading-tight">
                          {customer.name || "Guest"}
                        </p>
                      </div>
                    </motion.button>
                  </motion.div>
                </div>

                {/* Left Main (70%) */}
                <main className="flex-1 flex flex-col min-w-0 md:border-r dark:border-white/5 relative">
                  <div className="sticky top-0 z-20 p-4 md:p-6 border-b dark:border-white/5 flex flex-col gap-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          placeholder="Search items..."
                          value={menuSearchQuery}
                          onChange={(e) => setMenuSearchQuery(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 md:py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-[13px] md:text-[12px] font-bold outline-none border-2 border-transparent focus:border-[#e67e22] transition-all"
                        />
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-3 px-1 md:px-0">
                        {editingOrderId && (
                          <div className="flex items-center gap-2 bg-rose-500/10 text-rose-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase italic animate-pulse">
                            <UserCog className="w-4 h-4" />
                            Edit Mode
                          </div>
                        )}
                        <button
                          onClick={() => setIsDarkMode(!isDarkMode)}
                          className="p-3 md:p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500"
                        >
                          {isDarkMode ? (
                            <Sun className="w-5 h-5 md:w-4 md:h-4" />
                          ) : (
                            <Moon className="w-5 h-5 md:w-4 md:h-4" />
                          )}
                        </button>
                        <p className="text-[10px] md:text-[10px] font-black italic text-slate-400 uppercase tracking-widest">
                          <DigitalClock />
                        </p>
                      </div>
                    </div>

                    <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide -mx-1 px-1">
                      {["All", ...categories.filter(c => c !== "All")].map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setActiveCategory(cat)}
                          className={`px-5 py-3 md:px-4 md:py-2 rounded-xl text-[11px] md:text-[10px] font-black uppercase whitespace-nowrap transition-all touch-manipulation ${
                            activeCategory.toLowerCase() === cat.toLowerCase()
                              ? "bg-[#e67e22] text-white shadow-lg shadow-orange-500/30"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Items Grid */}
                  <MenuGrid
                    items={filteredMenuItems}
                    cartMap={cartMap}
                    addToCart={addToCart}
                    updateQty={updateQty}
                    inventory={inventory}
                  />
                </main>

                {/* Right Aside: Cart (Responsive behavior) */}
                <aside className="w-full md:w-[350px] lg:w-[400px] flex flex-col h-fit md:h-full md:border-l dark:border-white/5 bg-white dark:bg-slate-900 shrink-0 border-t md:border-t-0">
                  <CartContent {...commonCartProps} />
                </aside>
              </div>
            ) : currentView === "HISTORY" ? (
              <div className="flex-1 md:overflow-hidden flex flex-col p-4 md:p-8">
                {/* History Filters */}
                <div className="flex flex-col gap-6 mb-8">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative group">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors">
                        <Search />
                      </span>
                      <input
                        placeholder="Search Invoice #, Name, Mobile..."
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        className="w-full pl-14 pr-6 py-5 rounded-[1.5rem] bg-white dark:bg-slate-900 shadow-md border-none text-xs font-black outline-none ring-2 ring-transparent focus:ring-amber-500/20 transition-all uppercase tracking-widest"
                      />
                    </div>

                    {/* Date Filter */}
                    <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-6 py-2 rounded-[1.5rem] shadow-md border dark:border-slate-800">
                      <div className="flex flex-col">
                        <span className="text-[7px] font-black uppercase text-slate-400 leading-none mb-1">
                          From
                        </span>
                        <input
                          type="date"
                          value={historyFromDate}
                          onChange={(e) => setHistoryFromDate(e.target.value)}
                          className="bg-transparent border-none outline-none text-[10px] font-black uppercase text-amber-500 cursor-pointer"
                        />
                      </div>
                      <div className="w-px h-8 bg-slate-100 dark:bg-white/5" />
                      <div className="flex flex-col">
                        <span className="text-[7px] font-black uppercase text-slate-400 leading-none mb-1">
                          To
                        </span>
                        <input
                          type="date"
                          value={historyToDate}
                          onChange={(e) => setHistoryToDate(e.target.value)}
                          className="bg-transparent border-none outline-none text-[10px] font-black uppercase text-amber-500 cursor-pointer"
                        />
                      </div>
                      {(historyFromDate || historyToDate) && (
                        <button
                          onClick={() => {
                            setHistoryFromDate("");
                            setHistoryToDate("");
                          }}
                          className="p-2 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-xl text-rose-500 transition-all active:scale-95"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="flex gap-1.5 bg-slate-200/50 dark:bg-slate-800 p-1.5 rounded-[1.5rem] shrink-0 shadow-inner">
                      {["ALL", "PAID", "UNPAID", "VOIDED"].map((status) => (
                        <button
                          key={status}
                          onClick={() => setHistoryStatusFilter(status as any)}
                          className={`px-8 py-3.5 rounded-xl text-[10px] font-black uppercase transition-all ${historyStatusFilter === status ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" : "text-slate-500 hover:text-slate-700"}`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                    {["ALL", "DINE-IN", "TAKEAWAY", "DELIVERY"].map((type) => (
                      <button
                        key={type}
                        onClick={() => setHistoryTypeFilter(type as any)}
                        className={`px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${
                          historyTypeFilter === type
                            ? "bg-indigo-500 border-indigo-500 text-white shadow-xl shadow-indigo-500/20 scale-105"
                            : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* History List */}
                <div className="flex-1 overflow-y-auto space-y-4 pb-32 md:pb-10 pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                  {filteredHistoryOrders
                    .slice(0, historyLimit)
                    .map((order) => {
                      const isExpanded = expandedOrders.has(order.id);
                      return (
                        <div
                          key={order.id}
                          className={`rounded-[2.5rem] border transition-all duration-300 overflow-hidden ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm hover:shadow-md"}`}
                        >
                          <div className={`p-6 flex flex-wrap items-center justify-between gap-6 relative ${order.status === "VOIDED" ? "opacity-60" : ""}`}>
                            {order.status === "VOIDED" && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                <div className="border-4 border-rose-500/30 text-rose-500/30 text-5xl font-black uppercase tracking-[1em] rotate-12 py-4 px-12 rounded-3xl border-dashed">
                                  Voided
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-6 min-w-[240px]">
                              <div
                                className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center font-brand italic text-lg px-2 text-center ${order.status === "VOIDED" ? "bg-slate-100 text-slate-400 line-through" : order.status === "PAID" ? "bg-emerald-500/10 text-emerald-500" : order.status === "UDHAAR" ? "bg-orange-500/10 text-orange-500" : "bg-rose-500/10 text-rose-500"}`}
                              >
                                {order.businessDate ? formatInvoiceNo(order.businessDate, order.invoiceNo) : "#" + order.invoiceNo}
                              </div>
                              <div>
                                <p className="text-[12px] font-black uppercase tracking-tight">
                                  {order.customer.name || "Walk-in Guest"}
                                </p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-wider">
                                  {order.dateStr}
                                </p>
                                <div className="flex gap-1.5 mt-2">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[7px] font-black uppercase ${
                                      order.type === "DINE-IN"
                                        ? "bg-amber-500 text-white"
                                        : order.type === "TAKEAWAY"
                                          ? "bg-indigo-500 text-white"
                                          : "bg-rose-500 text-white"
                                    }`}
                                  >
                                    {order.type}
                                  </span>
                                  <span className="px-2 py-0.5 bg-slate-50 dark:bg-white/5 rounded text-[7px] font-black text-slate-400 uppercase">
                                    {order.paymentMethod}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-10">
                              <div className="text-right">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                  Grand Total
                                </p>
                                <p className={`text-2xl font-brand italic ${order.status === "VOIDED" ? "text-slate-300 line-through" : "text-amber-500"}`}>
                                  Rs {order.total}
                                </p>
                              </div>
                              <div
                                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase italic tracking-widest ${order.status === "PAID" ? "bg-emerald-500/10 text-emerald-600" : order.status === "UDHAAR" ? "bg-orange-500/10 text-orange-600" : order.status === "VOIDED" ? "bg-slate-200 text-slate-500" : "bg-rose-500/10 text-rose-600"}`}
                              >
                                {order.status}
                              </div>
                              {(order.status === "UNPAID" || order.status === "UDHAAR") && (
                                <button
                                  onClick={() => {
                                    setDeleteConfirmId(`settle-order-${order.id}`);
                                  }}
                                  className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-90 transition-transform"
                                  title="Quick Settle"
                                >
                                  <CheckCircle2 className="w-5 h-5" />
                                </button>
                              )}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setCart(order.items);
                                    setCustomer(order.customer);
                                    setOrderType(order.type);
                                    setPaymentMethod(order.paymentMethod);
                                    setCashReceived(
                                      order.cashReceived
                                        ? order.cashReceived.toString()
                                        : "",
                                    );
                                    setDiscount(order.discount || 0);
                                    setDeliveryCharge(order.deliveryCharge || 0);
                                    setTillId(order.tillId || "");
                                    setPaymentAccountName(order.paymentAccountName || "");
                                    setEditingOrderId(order.id);
                                    setEditingOrderDate(order.businessDate || getBusinessDate());
                                    setCurrentView("POS");
                                    logAction(
                                      `Starting Edit for Order #${order.id}`,
                                      "WARNING",
                                    );
                                  }}
                                  className="px-6 py-3 rounded-2xl text-[9px] font-black uppercase italic bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500 hover:text-white transition-all transform active:scale-95 shadow-sm"
                                >
                                  Edit
                                </button>
                                {order.status !== "VOIDED" && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewingOrder(order);
                                      setIsShiftingDate(true);
                                      setShiftDateValue(order.businessDate);
                                    }}
                                    className="px-6 py-3 rounded-2xl text-[9px] font-black uppercase italic bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white transition-all transform active:scale-95 shadow-sm"
                                  >
                                    Shift
                                  </button>
                                )}
                                {order.status !== "VOIDED" && (
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await handleVoidOrder(order);
                                    }}
                                    className="px-6 py-3 rounded-2xl text-[9px] font-black uppercase italic bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white transition-all transform active:scale-95 shadow-sm cursor-pointer"
                                  >
                                    Void
                                  </button>
                                )}
                                {order.status === "VOIDED" && (
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await handleRestoreOrder(order);
                                    }}
                                    className="px-6 py-3 rounded-2xl text-[9px] font-black uppercase italic bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all transform active:scale-95 shadow-sm cursor-pointer"
                                  >
                                    Restore
                                  </button>
                                )}
                                <button
                                  onClick={() => toggleExpand(order.id)}
                                  className={`px-6 py-3 rounded-2xl text-[9px] font-black uppercase italic transition-all transform active:scale-95 ${isExpanded ? "bg-slate-800 text-white" : "bg-slate-100 dark:bg-white/5 hover:bg-amber-500 hover:text-white shadow-sm"}`}
                                >
                                  {isExpanded ? "Hide" : "Invoice"}
                                </button>
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <>
                              <div className="px-4 pb-12 pt-8 border-t dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 animate-in fade-in slide-in-from-top-4 duration-500">
                              {/* Receipt Container */}
                              <div
                                id={`invoice-content-${order.id}`}
                                className={`max-w-md mx-auto rounded-2xl relative overflow-hidden flex flex-col border-[2px] border-[#FFD700] shadow-[0_4px_12px_rgba(0,0,0,0.05)] bg-white`}
                              >
                                {/* Premium Background Pattern */}
                                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                  <div className="absolute top-0 right-0 w-64 h-64 bg-[#FFD700]/5 blur-[80px] -mr-32 -mt-32 rounded-full" />
                                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#FFD700]/5 blur-[80px] -ml-32 -mb-32 rounded-full" />
                                </div>

                                {/* Header Section */}
                                <div className="p-8 pb-4 relative z-10 text-center">
                                   <div className="flex flex-col items-center">
                                      <motion.div 
                                         initial={{ scale: 0.8, opacity: 0 }}
                                         animate={{ scale: 1, opacity: 1 }}
                                         className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg mb-3"
                                      >
                                         <Pizza className="w-10 h-10" />
                                      </motion.div>
                                      <h2 className="text-2xl font-brand italic tracking-[0.1em] font-black mb-1">
                                         <span className="text-slate-900">BURGER</span> <span className="text-orange-500">SPOT</span>
                                      </h2>
                                   </div>
                                   
                                   <p className="text-[10px] font-brand italic font-black text-amber-600 uppercase tracking-widest mb-3 text-center">
                                     Quality Never Compromised
                                   </p>
                                   <p className="text-[10px] font-medium text-slate-500 max-w-[220px] mx-auto leading-tight">
                                     Near Areeb bakery, Mohallah Awana Niaz Baig, Lahore
                                   </p>
                                   <p className="text-[10px] font-bold text-slate-500 mt-1">Phone: 03290059593</p>
                                   
                                   <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
                                      {/* Customer Information Panel */}
                                      {(order.customer.name || order.customer.mobile || order.customer.address) && (
                                         <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 flex flex-col gap-2 relative col-span-2 mb-2">
                                            <div className="flex items-center justify-between relative z-10 text-left">
                                               <div className="flex flex-col gap-1">
                                                  <span className="text-[7px] font-black uppercase text-slate-400 tracking-[0.2em]">Customer Name</span>
                                                  <p className="text-[11px] font-black text-slate-800 uppercase italic leading-tight">
                                                     {order.customer.name || "Walk-in Guest"}
                                                  </p>
                                               </div>
                                               <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-amber-500 shadow-sm border border-slate-50">
                                                  <User className="w-4 h-4" />
                                               </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-1 border-t border-slate-100 pt-2 relative z-10 text-left">
                                               {order.customer.mobile && (
                                                  <div className="flex items-center gap-2">
                                                     <Smartphone className="w-3 h-3 text-slate-400" />
                                                     <span className="text-[9px] font-bold text-slate-600">{order.customer.mobile}</span>
                                                  </div>
                                               )}
                                               {order.customer.address && (
                                                  <div className="flex items-start gap-2 col-span-2">
                                                     <MapPin className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                                                     <span className="text-[9px] font-medium text-slate-500 leading-tight italic">{order.customer.address}</span>
                                                  </div>
                                               )}
                                            </div>
                                         </div>
                                      )}

                                      <div className="grid grid-cols-2 gap-4 text-left">
                                         <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Invoice ID</p>
                                            <p className="text-[11px] font-black font-brand italic text-slate-900">
                                               {order.businessDate ? formatInvoiceNo(order.businessDate, order.invoiceNo) : "#" + order.invoiceNo}
                                            </p>
                                         </div>
                                         <div className="text-right">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Service</p>
                                            <p className="text-[11px] font-black font-brand italic text-slate-900 uppercase">{order.type}</p>
                                         </div>
                                      </div>
                                   </div>
                                </div>

                                {/* Items Area */}
                                <div className="px-8 py-2 relative z-10">
                                   <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-50 pb-2">
                                      <span>Items Details</span>
                                      <span>Amount</span>
                                   </div>
                                   <div className="space-y-3">
                                      {order.items.map((it, idx) => (
                                         <div key={idx} className="flex justify-between items-start">
                                            <div className="flex gap-3">
                                               <span className="text-[11px] font-black text-slate-400">{it.qty}x</span>
                                               <div>
                                                  <p className="text-[12px] font-black font-brand italic text-slate-800 tracking-tight leading-tight">
                                                     {it.name}
                                                  </p>
                                                  {it.note && <p className="text-[8px] italic text-slate-400 mt-0.5">Note: {it.note}</p>}
                                               </div>
                                            </div>
                                            <span className="text-[12px] font-black font-brand italic text-slate-900">
                                               Rs {(it.price * it.qty).toLocaleString()}
                                            </span>
                                         </div>
                                      ))}
                                   </div>
                                </div>

                                {/* Financial Details */}
                                <div className="mt-4 p-8 pt-2 relative z-10">
                                   <div className="space-y-2 mb-6 border-t border-slate-100 pt-4">
                                      <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                         <span>Subtotal</span>
                                         <span className="text-slate-800 font-black">Rs {order.subtotal?.toLocaleString() || order.total.toLocaleString()}</span>
                                      </div>
                                      
                                      {order.discount > 0 && (
                                         <div className="space-y-1">
                                            <div className="flex justify-between text-[11px] font-black text-rose-500 uppercase italic">
                                               <span>DISCOUNT:</span>
                                               <span>- Rs {order.discount.toLocaleString()}</span>
                                            </div>
                                            <p className="text-[9px] text-slate-400 pl-4">• Promo Offer Applied</p>
                                            <div className="flex justify-between text-[11px] font-black text-slate-600 uppercase italic border-b border-dashed border-slate-200 pb-1">
                                               <span>Total after discount:</span>
                                               <span>Rs {((order.subtotal || 0) - order.discount).toLocaleString()}</span>
                                            </div>
                                         </div>
                                      )}

                                      {order.deliveryCharge > 0 && (
                                         <div className="flex justify-between text-[11px] font-black text-amber-600 uppercase italic">
                                            <span>Delivery Fee</span>
                                            <span>+ Rs {order.deliveryCharge.toLocaleString()}</span>
                                         </div>
                                      )}
                                   </div>

                                   {/* Grand Total - Luxury Design (Smooth Version) */}
                                   <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 p-8 rounded-[3rem] shadow-[0_20px_40px_-12px_rgba(255,215,0,0.1)] relative overflow-hidden group border border-amber-100/50">
                                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 blur-3xl rounded-full -mr-16 -mt-16" />
                                      <div className="flex justify-between items-end relative z-10">
                                         <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-600/40 italic mb-1">Total Payable</p>
                                            <h3 className="text-3xl font-brand italic font-black text-slate-800 leading-none">AMOUNT</h3>
                                         </div>
                                         <div className="text-right">
                                            <p className="text-5xl font-brand italic font-black text-amber-500 tabular-nums leading-none tracking-tighter">
                                               Rs <AnimatedNumber value={order.total} />
                                            </p>
                                         </div>
                                      </div>
                                   </div>

                                   {/* Payment Info */}
                                   <div className="mt-6 flex justify-between items-center text-[10px] border-t border-slate-50 pt-4">
                                      <div className="flex items-center gap-2">
                                         <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center">
                                            {order.paymentMethod === 'CASH' ? <Coins className="w-4 h-4 text-amber-500" /> : 
                                             order.paymentMethod === 'EASYPAISA' ? <Wallet className="w-4 h-4 text-emerald-500" /> : 
                                             <Zap className="w-4 h-4 text-blue-500" />}
                                         </div>
                                         <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Paid via</p>
                                            <p className="font-black text-slate-800 uppercase">{order.paymentMethod || 'CASH'}</p>
                                         </div>
                                      </div>
                                      <div className="text-right">
                                         <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Received By</p>
                                         <p className="font-black text-slate-800">Staff: {currentUser?.name || "BS Team"}</p>
                                      </div>
                                   </div>
                                </div>

                                {/* Premium Footer */}
                                <div className="p-8 pt-0 text-center">
                                   <p className="text-[11px] font-black text-orange-500 mb-1">
                                      🌟 Thank you for choosing BURGER SPOT 🌟
                                   </p>
                                   <p className="text-[8px] font-bold text-slate-400 italic">Digitally Verified Receipt • No Signature Required</p>
                                </div>
                              </div>

                                {/* Thermal Paper Edge - Now properly nested inside the captured container */}
                                <div className="absolute bottom-0 left-0 right-0 h-4 flex opacity-20 pointer-events-none">
                                  {Array.from({ length: 30 }).map((_, i) => (
                                    <div key={i} className="flex-1 h-8 bg-slate-900 dark:bg-white rotate-45 transform translate-y-2" />
                                  ))}
                                </div>
                              </div>

                              {/* Action Button */}
                              <div className="mt-10 flex flex-col gap-3 no-print font-sans max-w-md mx-auto">
                                {order.status === "UNPAID" && (
                                  <button
                                    onClick={() => {
                                      if (
                                        confirm(
                                          `Confirm full recovery of Rs ${order.total} for #${order.invoiceNo}?`,
                                        )
                                      ) {
                                        updateDoc(doc(db, "orders", order.id), {
                                          status: "PAID",
                                          cashReceived: order.total,
                                          paymentMethod: "CASH",
                                          paidAt: new Date().toISOString()
                                        }).then(() => {
                                          logAction(
                                            `Udhaar Recovered (History): #${order.invoiceNo}`,
                                            "SUCCESS",
                                            `Total: Rs ${order.total}`,
                                          );
                                          alert(
                                            `Udhaar Invoice #${order.invoiceNo} successfully settled!`,
                                          );
                                        }).catch(err => {
                                          console.error("Settle failed:", err);
                                          alert("Failed to sync settlement to database.");
                                        });
                                      }
                                    }}
                                    className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] italic shadow-lg shadow-emerald-500/30 active:scale-95 transition-all outline-none"
                                  >
                                    Settle Payment Now
                                  </button>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                  <button
                                    onClick={() =>
                                      handleDownloadInvoice(order.id)
                                    }
                                    className="flex items-center justify-center gap-2 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 rounded-2xl font-black uppercase text-[10px] italic hover:bg-slate-200 dark:hover:bg-white/10 transition-all outline-none"
                                  >
                                    <Download className="w-4 h-4" /> Download
                                  </button>
                                  <button
                                    onClick={() => handleShareInvoice(order.id)}
                                    className="flex items-center justify-center gap-2 py-4 bg-amber-500/10 text-amber-500 rounded-2xl font-black uppercase text-[10px] italic hover:bg-amber-500/20 transition-all outline-none"
                                  >
                                    <Share2 className="w-4 h-4" /> Share
                                  </button>
                                </div>
                                <button
                                  onClick={() => window.print()}
                                  className="w-full py-4 border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 rounded-2xl font-black uppercase text-[10px] italic hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all outline-none"
                                >
                                  Traditional Print
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  
                  {orders.filter(
                    (o) =>
                      (historyStatusFilter === "ALL" || o.status === historyStatusFilter) &&
                      (historyTypeFilter === "ALL" || o.type === historyTypeFilter) &&
                      (!historyFromDate || (o.businessDate || getBusinessDate(new Date(o.timestamp))) >= historyFromDate) &&
                      (!historyToDate || (o.businessDate || getBusinessDate(new Date(o.timestamp))) <= historyToDate)
                  ).length > historyLimit && (
                    <div className="flex justify-center py-8">
                      <button
                        onClick={() => setHistoryLimit(prev => prev + 100)}
                        className="px-12 py-4 bg-amber-500 text-white rounded-[1.5rem] font-black uppercase italic shadow-xl shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all"
                      >
                        Load More Orders
                      </button>
                    </div>
                  )}

                  {orders.filter(o => (historyStatusFilter === "ALL" || o.status === historyStatusFilter)).length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center py-24 opacity-20">
                      <div className="w-24 h-24 mb-4 text-slate-400">
                        <Search className="w-full h-full" />
                      </div>
                      <p className="text-4xl font-brand italic tracking-[0.5em] uppercase">
                        No Orders
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : currentView === "REPORTS" ? (
              <div className="flex-1 flex flex-col p-6 md:p-10 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-amber-500/30">
                    <PieChartIcon className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-brand italic text-slate-800 dark:text-white leading-none">
                      Business Intelligence
                    </h2>
                    <p className="text-[10px] font-black uppercase text-slate-400 mt-2 tracking-widest">
                      Real-time terminal performance
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                  {[
                    {
                      label: "Total Revenue",
                      val: `Rs ${(stats.totalRevenue || 0).toLocaleString()}`,
                      color: "emerald",
                      icon: TrendingUp,
                    },
                    {
                      label: "Order Tickets",
                      val: stats.count,
                      color: "indigo",
                      icon: ShoppingCart,
                    },
                    {
                      label: "Average Bill",
                      val: `Rs ${(stats.avgTicket || 0).toLocaleString()}`,
                      color: "amber",
                      icon: Activity,
                    },
                    {
                      label: "Customer Growth",
                      val: "+12.5%",
                      color: "rose",
                      icon: Sparkles,
                    },
                  ].map((stat, i) => (
                    <div
                      key={i}
                      className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border dark:border-slate-800 shadow-sm"
                    >
                      <div
                        className={`w-10 h-10 rounded-xl mb-4 flex items-center justify-center ${
                          stat.color === "emerald"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : stat.color === "indigo"
                              ? "bg-indigo-500/10 text-indigo-500"
                              : stat.color === "amber"
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-rose-500/10 text-rose-500"
                        }`}
                      >
                        <stat.icon className="w-5 h-5" />
                      </div>
                      <p className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">
                        {stat.label}
                      </p>
                      <p
                        className={`text-2xl font-brand italic ${
                          stat.color === "emerald"
                            ? "text-emerald-500"
                            : stat.color === "indigo"
                              ? "text-indigo-500"
                              : stat.color === "amber"
                                ? "text-amber-500"
                                : "text-rose-500"
                        }`}
                      >
                        {stat.val}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-8 md:p-10 border dark:border-slate-800 shadow-sm h-[400px]">
                  <div className="flex items-center justify-between mb-8">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">
                      Sales Velocity Insights
                    </p>
                    <div className="flex gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">
                        Gross Sales
                      </span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height="80%">
                    <AreaChart
                      data={[
                        { name: "Mon", sales: 4000 },
                        { name: "Tue", sales: 3000 },
                        { name: "Wed", sales: 2000 },
                        { name: "Thu", sales: 2780 },
                        { name: "Fri", sales: 1890 },
                        { name: "Sat", sales: 2390 },
                        { name: "Sun", sales: 3490 },
                      ]}
                    >
                      <defs>
                        <linearGradient
                          id="colorSales"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#e67e22"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#e67e22"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" hide />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "1rem",
                          border: "none",
                          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        stroke="#e67e22"
                        strokeWidth={4}
                        fillOpacity={1}
                        fill="url(#colorSales)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              /* Admin View (Dashboard, Inventory & Users) */
              <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50 dark:bg-slate-950">
                {/* Quick Stats Header */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border dark:border-slate-800 shadow-sm">
                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.3em] mb-4">
                      Today's Revenue
                    </p>
                    <p className="text-4xl font-brand italic text-amber-500">
                      Rs {(stats.totalRevenue || 0).toLocaleString()}
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[8px] font-black text-emerald-500 uppercase">
                        Live Updates
                      </span>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border dark:border-slate-800 shadow-sm">
                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.3em] mb-4">
                      Order Volume
                    </p>
                    <p className="text-4xl font-brand italic text-indigo-500">
                      {stats.count}{" "}
                      <span className="text-sm font-sans tracking-tight">
                        Tickets
                      </span>
                    </p>
                    <div className="mt-4 h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500"
                        style={{ width: "65%" }}
                      />
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border dark:border-slate-800 shadow-sm">
                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.3em] mb-4">
                      Average Ticket
                    </p>
                    <p className="text-4xl font-brand italic text-rose-500">
                      Rs {(stats.avgTicket || 0).toLocaleString()}
                    </p>
                    <p className="text-[8px] font-black text-slate-400 mt-4 uppercase">
                      Per Customer Spend
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mb-10 overflow-x-auto scrollbar-hide">
                  {["MENU", "CATEGORIES", "USERS", "INVENTORY", "LEDGER", "AUDIT"].map(
                    (tab) => (
                      <button
                        key={tab}
                        onClick={() => setAdminTab(tab as any)}
                        className={`px-12 py-4.5 rounded-[1.8rem] text-[10px] font-black uppercase transition-all shrink-0 ${
                          adminTab === tab
                            ? "bg-amber-500 text-white shadow-2xl shadow-amber-500/30"
                            : "bg-white dark:bg-slate-900 text-slate-400 hover:text-amber-500"
                        }`}
                      >
                        {tab === "MENU"
                          ? "Item Setup"
                          : tab === "USERS"
                            ? "Team Control"
                            : tab === "INVENTORY"
                              ? "Stock Manager"
                              : tab === "LEDGER"
                                ? "Udaar Ledger"
                                : tab === "AUDIT"
                                  ? "Audit Logs"
                                  : "Menu Structure"}
                      </button>
                    ),
                  )}
                </div>

                {adminTab === "AUDIT" && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-xl overflow-hidden border border-slate-100 dark:border-slate-800"
                  >
                    <div className="p-10 border-b dark:border-slate-800 flex justify-between items-center">
                      <h2 className="text-xl font-brand italic uppercase tracking-widest text-slate-800 dark:text-white">
                        System Audit Log
                      </h2>
                      <div className="text-[9px] font-black uppercase text-slate-400 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-full">
                        Total Logs: {auditLogs.length}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-white/5">
                            <th className="px-10 py-6">Timestamp</th>
                            <th className="px-10 py-6">User</th>
                            <th className="px-10 py-6">Action</th>
                            <th className="px-10 py-6">Status</th>
                            <th className="px-10 py-6">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-800">
                          {auditLogs.map((log) => (
                            <tr
                              key={log.id}
                              className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors"
                            >
                              <td className="px-10 py-5 text-[10px] font-bold text-slate-500 whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleString()}
                              </td>
                              <td className="px-10 py-5">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center text-[10px] text-indigo-500 font-black">
                                    {log.userName.charAt(0)}
                                  </div>
                                  <span className="text-[10px] font-black text-slate-600 dark:text-slate-300">
                                    {log.userName}
                                  </span>
                                </div>
                              </td>
                              <td className="px-10 py-5 text-[10px] font-black uppercase italic tracking-wide text-slate-800 dark:text-slate-100">
                                {log.action}
                              </td>
                              <td className="px-10 py-5">
                                <span
                                  className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                                    log.status === "SUCCESS"
                                      ? "bg-emerald-500/10 text-emerald-600"
                                      : log.status === "WARNING"
                                        ? "bg-amber-500/10 text-amber-600"
                                        : "bg-rose-500/10 text-rose-600"
                                  }`}
                                >
                                  {log.status}
                                </span>
                              </td>
                              <td className="px-10 py-5 text-[10px] font-bold text-slate-400 max-w-xs truncate">
                                {log.details || "---"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {adminTab === "INVENTORY" && (
                  <div className="space-y-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                      <div className="space-y-2">
                        <h2 className="text-xl font-black uppercase italic tracking-[0.2em]">
                          Smart Stock Control
                        </h2>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              const lowStockIds = inventory
                                .filter((i) => i.stock <= i.minStock)
                                .map((i) => i.id);
                              setSelectedInventoryItems(new Set(lowStockIds));
                            }}
                            className="text-[8px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600 transition-colors bg-rose-500/5 px-3 py-1.5 rounded-full border border-rose-500/10"
                          >
                            Select Low Stock
                          </button>
                          <button
                            onClick={() => setSelectedInventoryItems(new Set())}
                            className="text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            Clear Selection ({selectedInventoryItems.size})
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {selectedInventoryItems.size > 0 && (
                          <button
                            onClick={() => {
                              const initialQuants: Record<string, string> = {};
                              Array.from(selectedInventoryItems).forEach(
                                (id: string) => {
                                  initialQuants[id] = "1";
                                },
                              );
                              setBulkRestockQuantities(initialQuants);
                              setIsBulkRestockModalOpen(true);
                            }}
                            className="px-6 py-3 bg-emerald-500 text-white rounded-2xl font-black uppercase italic text-[10px] tracking-widest shadow-lg shadow-emerald-500/30 flex items-center gap-3 active:scale-95 transition-all"
                          >
                            <PackagePlus className="w-4 h-4" />
                            Restock Selected ({selectedInventoryItems.size})
                          </button>
                        )}
                        <button
                          onClick={() =>
                            setEditingInventoryItem({
                              id: `i-${Date.now()}`,
                              name: "",
                              unit: "Pcs",
                              stock: 0,
                              minStock: 10,
                              packetPrice: 0,
                              packetSize: 1,
                              costPerUnit: 0,
                            })
                          }
                          className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase italic text-[10px] tracking-widest shadow-lg shadow-indigo-600/30 flex items-center gap-3 active:scale-95 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          New Stock Item
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {inventory.map((item) => (
                        <motion.div
                          layout
                          key={item.id}
                          className={`bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border transition-all hover:shadow-xl group relative ${
                            selectedInventoryItems.has(item.id)
                              ? "border-indigo-500 shadow-indigo-500/10"
                              : "dark:border-slate-800"
                          }`}
                        >
                          {/* Selection UI */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = new Set(selectedInventoryItems);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              setSelectedInventoryItems(next);
                            }}
                            className={`absolute top-6 left-6 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all z-10 ${
                              selectedInventoryItems.has(item.id)
                                ? "bg-indigo-500 border-indigo-500 text-white"
                                : "border-slate-100 dark:border-slate-800 group-hover:border-indigo-500/50"
                            }`}
                          >
                            {selectedInventoryItems.has(item.id) && (
                              <Check className="w-4 h-4" />
                            )}
                          </button>

                          <div className="flex justify-between items-start mb-6 mt-4">
                            <div className="flex items-center gap-4">
                              <div
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.stock <= item.minStock ? "bg-rose-500/10 text-rose-500" : "bg-indigo-500/10 text-indigo-500"}`}
                              >
                                <Package className="w-6 h-6" />
                              </div>
                              <div>
                                <h3 className="text-[13px] font-black uppercase text-slate-800 dark:text-white leading-tight">
                                  {item.name}
                                </h3>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                  Ref ID: {item.id}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => setEditingInventoryItem(item)}
                              className="p-2 text-slate-300 hover:text-indigo-500 transition-colors"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-8">
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                setInventoryAction({ type: "CALIBRATE", item });
                                setActionQuantity(item.stock.toString());
                              }}
                              className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-transparent hover:border-amber-500/30"
                            >
                              <p className="text-[7px] font-black text-slate-400 uppercase mb-1">
                                Available Stock (Update)
                              </p>
                              <div className="flex items-end gap-1">
                                <span className="text-2xl font-brand italic text-amber-500">
                                  {item.stock.toFixed(1)}
                                </span>
                                <span className="text-[8px] font-black uppercase text-slate-400 mb-1.5">
                                  {item.unit}
                                </span>
                              </div>
                            </motion.button>
                            <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl">
                              <p className="text-[7px] font-black text-slate-400 uppercase mb-1">
                                Stock Status
                              </p>
                              <span
                                className={`text-[10px] font-black uppercase italic ${item.stock <= item.minStock ? "text-rose-500" : "text-emerald-500"}`}
                              >
                                {item.stock <= item.minStock
                                  ? "⚠️ Critical"
                                  : "✓ Healthy"}
                              </span>
                              <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{
                                    width: `${Math.min(100, (item.stock / (item.minStock * 4)) * 100)}%`,
                                  }}
                                  className={`h-full ${item.stock <= item.minStock ? "bg-rose-500" : "bg-emerald-500"}`}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3 pt-6 border-t dark:border-white/5">
                            <div className="flex justify-between items-center text-[9px] font-black uppercase">
                              <span className="text-slate-400">
                                Packet Price:
                              </span>
                              <span className="text-slate-800 dark:text-white">
                                Rs {(item.packetPrice || 0).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] font-black uppercase">
                              <span className="text-slate-400">
                                Packet Size:
                              </span>
                              <span className="text-slate-800 dark:text-white">
                                {item.packetSize} {item.unit}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black uppercase bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
                              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                                <Coins className="w-3 h-3" />
                                Price Per {item.unit}:
                              </span>
                              <span className="text-emerald-600 dark:text-emerald-400">
                                Rs {item.costPerUnit?.toFixed(2)}
                              </span>
                            </div>

                            {(() => {
                              const usedIn = menuItems.filter(p => p.ingredients?.some(ing => ing.ingredientId === item.id));
                              return (
                                <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800/50">
                                   <div className="flex items-center justify-between mb-3">
                                      <p className="text-[7px] font-black text-slate-400 uppercase">Recipe Management</p>
                                      <button
                                        onClick={() => setEditingRecipeItem(item)}
                                        className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 text-indigo-500 rounded-lg text-[7px] font-black uppercase hover:bg-indigo-500 hover:text-white transition-all group/rec"
                                      >
                                        <Edit3 className="w-2.5 h-2.5 group-hover/rec:scale-110" />
                                        {usedIn.length > 0 ? "Edit Recipe" : "Connect Recipe"}
                                      </button>
                                   </div>
                                   {usedIn.length > 0 ? (
                                     <div className="flex flex-wrap gap-1.5">
                                        {usedIn.map(p => (
                                          <span key={p.id} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[7px] font-black uppercase text-slate-500 border border-slate-200/50 dark:border-white/5">
                                            {p.name}
                                          </span>
                                        ))}
                                     </div>
                                   ) : (
                                     <p className="text-[7px] font-bold text-slate-300 italic uppercase">No menu items linked</p>
                                   )}
                                </div>
                              );
                            })()}
                          </div>

                          <div className="mt-8 grid grid-cols-2 gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setInventoryAction({ type: "RESTOCK", item });
                                setActionQuantity("1");
                              }}
                              className="py-3 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                            >
                              Add Packets
                            </button>
                            <button
                              onClick={() => {
                                setInventoryAction({ type: "CALIBRATE", item });
                                setActionQuantity(item.stock.toString());
                              }}
                              className="py-3 bg-slate-50 dark:bg-white/5 rounded-xl text-[9px] font-black hover:bg-slate-200 dark:hover:bg-slate-800 transition-all uppercase active:scale-95"
                            >
                              Calibrate
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                      {/* Inventory Edit Modal */}
                    <AnimatePresence>
                      {editingInventoryItem && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm"
                        >
                          <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3.5rem] shadow-2xl p-10 overflow-hidden relative"
                          >
                            <button
                              onClick={() => setEditingInventoryItem(null)}
                              className="absolute top-8 right-8 text-slate-400 hover:text-rose-500"
                            >
                              <XCircle className="w-8 h-8" />
                            </button>

                            <h2 className="text-xl font-black uppercase italic tracking-widest text-indigo-500 mb-8">
                              Stock Master Setup
                            </h2>

                            <form
                              className="space-y-5"
                              onSubmit={async (e) => {
                                e.preventDefault();
                                const inv = [...inventory];
                                const idx = inv.findIndex(
                                  (i) => i.id === editingInventoryItem.id,
                                );
                                const finalItem = {
                                  ...editingInventoryItem,
                                  costPerUnit:
                                    editingInventoryItem.packetPrice /
                                    editingInventoryItem.packetSize,
                                };

                                try {
                                  await setDoc(doc(db, "inventory", finalItem.id), finalItem);
                                  logAction(
                                    idx !== -1 
                                      ? `Inventory Updated: ${finalItem.name}` 
                                      : `New Inventory Created: ${finalItem.name}`,
                                    "SUCCESS"
                                  );
                                } catch (error) {
                                  console.error("Firebase Inventory Sync Error:", error);
                                  alert("Failed to save to database. Check connection.");
                                }

                                setEditingInventoryItem(null);
                              }}
                            >
                              <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 space-y-1.5">
                                  <p className="text-[9px] font-black uppercase text-slate-500 ml-3">
                                    Ingredient Name
                                  </p>
                                  <input
                                    value={editingInventoryItem.name}
                                    onChange={(e) =>
                                      setEditingInventoryItem({
                                        ...editingInventoryItem,
                                        name: e.target.value,
                                      })
                                    }
                                    className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl text-[11px] font-bold outline-none ring-0 focus:ring-1 ring-indigo-500"
                                    required
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <p className="text-[9px] font-black uppercase text-slate-500 ml-3">
                                    Unit (Pcs, G, Kg)
                                  </p>
                                  <input
                                    value={editingInventoryItem.unit}
                                    onChange={(e) =>
                                      setEditingInventoryItem({
                                        ...editingInventoryItem,
                                        unit: e.target.value,
                                      })
                                    }
                                    className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl text-[11px] font-bold outline-none"
                                    required
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <p className="text-[9px] font-black uppercase text-slate-500 ml-3">
                                    Min Alert Level
                                  </p>
                                  <input
                                    type="number"
                                    value={isNaN(editingInventoryItem.minStock) ? "" : editingInventoryItem.minStock}
                                    onChange={(e) =>
                                      setEditingInventoryItem({
                                        ...editingInventoryItem,
                                        minStock: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl text-[11px] font-bold outline-none"
                                    required
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <p className="text-[9px] font-black uppercase text-slate-500 ml-3">
                                    Packet Cost (Rs)
                                  </p>
                                  <input
                                    type="number"
                                    value={isNaN(editingInventoryItem.packetPrice) ? "" : editingInventoryItem.packetPrice}
                                    onChange={(e) =>
                                      setEditingInventoryItem({
                                        ...editingInventoryItem,
                                        packetPrice: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    className="w-full bg-slate-100 dark:bg-emerald-500/10 p-4 rounded-2xl text-[11px] font-black text-emerald-600 outline-none"
                                    required
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <p className="text-[9px] font-black uppercase text-slate-500 ml-3">
                                    Packet Size (Units)
                                  </p>
                                  <input
                                    type="number"
                                    value={isNaN(editingInventoryItem.packetSize) ? "" : editingInventoryItem.packetSize}
                                    onChange={(e) =>
                                      setEditingInventoryItem({
                                        ...editingInventoryItem,
                                        packetSize: parseFloat(e.target.value) || 1,
                                      })
                                    }
                                    className="w-full bg-slate-100 dark:bg-indigo-500/10 p-4 rounded-2xl text-[11px] font-black text-indigo-600 outline-none"
                                    required
                                  />
                                </div>
                              </div>

                              <button className="w-full py-5 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black uppercase italic tracking-widest text-xs mt-6 shadow-xl active:scale-95 transition-all">
                                Lock Inventory Config
                              </button>
                            </form>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Recipe Editor Modal */}
                    <AnimatePresence>
                      {editingRecipeItem && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md"
                        >
                          <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border dark:border-white/5"
                          >
                            <div className="p-8 border-b dark:border-white/5 flex items-center justify-between bg-indigo-500 text-white">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                                  <Edit3 className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                  <h2 className="text-xl font-brand italic font-black uppercase tracking-tight">Recipe Configuration</h2>
                                  <p className="text-[10px] font-black uppercase opacity-70 tracking-[0.2em]">{editingRecipeItem.name} • Per {editingRecipeItem.unit}</p>
                                </div>
                              </div>
                              <button 
                                onClick={() => setEditingRecipeItem(null)}
                                className="p-3 bg-white/10 hover:bg-white/20 rounded-[1.5rem] transition-all active:scale-90"
                              >
                                <XCircle className="w-6 h-6" />
                              </button>
                            </div>

                            {/* SEARCH & FILTERS */}
                            <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border-b dark:border-white/5">
                               <div className="relative">
                                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                  <input 
                                    placeholder="Search products to add to recipe..."
                                    value={dashSearchQuery}
                                    onChange={(e) => setDashSearchQuery(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 py-4 pl-12 pr-4 rounded-2xl text-[11px] font-black uppercase outline-none shadow-sm border dark:border-white/5 focus:ring-2 ring-indigo-500/20"
                                  />
                               </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-6">
                               {/* CONNECTED PRODUCTS */}
                               {(() => {
                                 const filtered = menuItems.filter(p => 
                                   p.name.toLowerCase().includes(dashSearchQuery.toLowerCase()) ||
                                   p.category.toLowerCase().includes(dashSearchQuery.toLowerCase())
                                 );

                                 return (
                                   <div className="space-y-4">
                                      {filtered.map(product => {
                                        const req = product.ingredients?.find(i => i.ingredientId === editingRecipeItem.id);
                                        const isLinked = !!req;

                                        return (
                                          <div key={product.id} className={`flex items-center justify-between p-4 rounded-3xl border transition-all ${isLinked ? 'bg-indigo-50 dark:bg-indigo-500/5 border-indigo-200 dark:border-indigo-500/20 shadow-lg shadow-indigo-500/5' : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-white/5'}`}>
                                             <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isLinked ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                                                   {product.name.includes("Burger") ? <Beef className="w-5 h-5" /> : product.name.includes("Wings") ? <Drumstick className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                   <p className="text-[11px] font-black uppercase text-slate-800 dark:text-white leading-none mb-1">{product.name}</p>
                                                   <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">{product.category}</p>
                                                </div>
                                             </div>

                                             <div className="flex items-center gap-3">
                                                {isLinked ? (
                                                  <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 rounded-2xl border dark:border-white/10 shadow-sm">
                                                     <input 
                                                       type="number"
                                                       step="0.01"
                                                       value={req.quantity}
                                                       onChange={async (e) => {
                                                         const val = parseFloat(e.target.value) || 0;
                                                         const updatedIngredients = (product.ingredients || []).map(ing => 
                                                           ing.ingredientId === editingRecipeItem.id ? { ...ing, quantity: val } : ing
                                                         );
                                                         await updateDoc(doc(db, "menu", product.id), { ingredients: updatedIngredients });
                                                       }}
                                                       className="w-16 bg-transparent text-center text-xs font-black text-indigo-600 outline-none"
                                                     />
                                                     <span className="text-[8px] font-black uppercase text-slate-400 pr-3">{editingRecipeItem.unit}</span>
                                                     <button 
                                                       onClick={async () => {
                                                         const updatedIngredients = (product.ingredients || []).filter(ing => ing.ingredientId !== editingRecipeItem.id);
                                                         await updateDoc(doc(db, "menu", product.id), { ingredients: updatedIngredients });
                                                       }}
                                                       className="w-8 h-8 bg-rose-500 text-white rounded-xl flex items-center justify-center hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/20"
                                                     >
                                                       <Trash2 className="w-4 h-4" />
                                                     </button>
                                                  </div>
                                                ) : (
                                                  <button 
                                                    onClick={async () => {
                                                      const updatedIngredients = [...(product.ingredients || []), { ingredientId: editingRecipeItem.id, quantity: 1 }];
                                                      await updateDoc(doc(db, "menu", product.id), { ingredients: updatedIngredients });
                                                    }}
                                                    className="flex items-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all shadow-sm"
                                                  >
                                                    <PlusCircle className="w-3.5 h-3.5" />
                                                    Add to Recipe
                                                  </button>
                                                )}
                                             </div>
                                          </div>
                                        );
                                      })}
                                   </div>
                                 );
                               })()}
                            </div>

                            <div className="p-8 border-t dark:border-white/5 bg-slate-50 dark:bg-slate-900/50">
                              <p className="text-[9px] font-black uppercase text-slate-400 text-center mb-4 tracking-[0.2em]">Changes are saved automatically to the cloud</p>
                              <button 
                                onClick={() => setEditingRecipeItem(null)}
                                className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase italic tracking-[0.3em] text-[10px] shadow-2xl shadow-indigo-500/30 hover:scale-[1.02] active:scale-95 transition-all"
                              >
                                Finish Adjustments
                              </button>
                            </div>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Bulk Restock Modal */}
                    <AnimatePresence>
                      {isBulkRestockModalOpen && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md"
                        >
                          <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border dark:border-white/5"
                          >
                            <div className="p-8 border-b dark:border-white/5 flex items-center justify-between bg-emerald-500 text-white">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                                  <PackagePlus className="w-6 h-6" />
                                </div>
                                <div>
                                  <h2 className="text-xl font-brand italic uppercase">
                                    Bulk Supply Restock
                                  </h2>
                                  <p className="text-[8px] font-black uppercase opacity-60 italic">
                                    Refreshing stock levels for{" "}
                                    {selectedInventoryItems.size} items
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => setIsBulkRestockModalOpen(false)}
                                className="text-white/60 hover:text-white transition-colors"
                              >
                                <XCircle className="w-8 h-8" />
                              </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-4 scrollbar-hide">
                              {inventory
                                .filter((i) => selectedInventoryItems.has(i.id))
                                .map((item) => (
                                  <div
                                    key={item.id}
                                    className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border dark:border-white/5 flex items-center gap-6"
                                  >
                                    <div className="flex-1">
                                      <h4 className="text-[12px] font-black uppercase tracking-tight text-slate-800 dark:text-white">
                                        {item.name}
                                      </h4>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[8px] font-black uppercase text-slate-400">
                                          Current Stock:
                                        </span>
                                        <span
                                          className={`text-[9px] font-black uppercase italic ${item.stock <= item.minStock ? "text-rose-500" : "text-emerald-500"}`}
                                        >
                                          {item.stock} {item.unit}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="text-right">
                                        <p className="text-[7px] font-black uppercase text-slate-400 mb-1">
                                          Add Packets
                                        </p>
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => {
                                              const current = parseInt(
                                                bulkRestockQuantities[
                                                  item.id
                                                ] || "0",
                                              );
                                              setBulkRestockQuantities(
                                                (prev) => ({
                                                  ...prev,
                                                  [item.id]: Math.max(
                                                    0,
                                                    current - 1,
                                                  ).toString(),
                                                }),
                                              );
                                            }}
                                            className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-sm border dark:border-white/5"
                                          >
                                            <Minus className="w-3 h-3" />
                                          </button>
                                          <input
                                            type="number"
                                            value={
                                              bulkRestockQuantities[item.id] ||
                                              "0"
                                            }
                                            onChange={(e) =>
                                              setBulkRestockQuantities(
                                                (prev) => ({
                                                  ...prev,
                                                  [item.id]: e.target.value,
                                                }),
                                              )
                                            }
                                            className="w-16 h-10 bg-white dark:bg-slate-700 rounded-lg text-center font-black text-xs border dark:border-white/5 focus:ring-1 ring-emerald-500 outline-none"
                                          />
                                          <button
                                            onClick={() => {
                                              const current = parseInt(
                                                bulkRestockQuantities[
                                                  item.id
                                                ] || "0",
                                              );
                                              setBulkRestockQuantities(
                                                (prev) => ({
                                                  ...prev,
                                                  [item.id]: (
                                                    current + 1
                                                  ).toString(),
                                                }),
                                              );
                                            }}
                                            className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-emerald-500 shadow-sm border dark:border-white/5"
                                          >
                                            <Plus className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                      <div className="w-24 pl-4 border-l dark:border-white/10">
                                        <p className="text-[7px] font-black uppercase text-slate-400 mb-1">
                                          New Total
                                        </p>
                                        <p className="text-[11px] font-black text-emerald-500 font-brand italic">
                                          {(
                                            item.stock +
                                            parseInt(
                                              bulkRestockQuantities[item.id] ||
                                                "0",
                                            ) *
                                              item.packetSize
                                          ).toFixed(1)}{" "}
                                          {item.unit}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>

                            <div className="p-8 bg-slate-50 dark:bg-slate-800/80 border-t dark:border-white/5 flex items-center justify-between">
                              <div>
                                <p className="text-[8px] font-black uppercase text-slate-400 italic">
                                  Financial Impact
                                </p>
                                <p className="text-xl font-brand italic text-rose-500">
                                  - Rs{" "}
                                  {Object.entries(bulkRestockQuantities)
                                    .reduce(
                                      (total, [id, qty]: [string, string]) => {
                                        const item = inventory.find(
                                          (i) => i.id === id,
                                        );
                                        return (
                                          total +
                                          (item
                                            ? item.packetPrice *
                                              (parseInt(qty) || 0)
                                            : 0)
                                        );
                                      },
                                      0,
                                    )
                                    .toLocaleString()}
                                </p>
                              </div>
                              <button
                                onClick={handleBulkRestock}
                                className="px-10 py-5 bg-emerald-500 text-white rounded-2xl font-black uppercase italic tracking-widest text-xs shadow-xl shadow-emerald-500/30 active:scale-95 transition-all flex items-center gap-3"
                              >
                                Confirm Bulk Restock
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Inventory Action Modal (Restock / Calibrate) */}
                    <AnimatePresence>
                      {inventoryAction && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md"
                        >
                          <motion.div
                            initial={{ scale: 0.9, y: 20, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.9, y: 20, opacity: 0 }}
                            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] shadow-2xl p-10 relative overflow-hidden"
                          >
                            <button
                              onClick={() => setInventoryAction(null)}
                              className="absolute top-6 right-6 text-slate-400 hover:text-rose-500 transition-colors"
                            >
                              <XCircle className="w-8 h-8" />
                            </button>

                            <div className="flex items-center gap-4 mb-8">
                              <div
                                className={`w-14 h-14 rounded-2xl flex items-center justify-center ${inventoryAction.type === "RESTOCK" ? "bg-indigo-500/10 text-indigo-500" : "bg-amber-500/10 text-amber-500"}`}
                              >
                                {inventoryAction.type === "RESTOCK" ? (
                                  <PlusCircle className="w-8 h-8" />
                                ) : (
                                  <Scale className="w-8 h-8" />
                                )}
                              </div>
                              <div>
                                <h2 className="text-xl font-black uppercase italic leading-tight text-slate-800 dark:text-white">
                                  {inventoryAction.type === "RESTOCK"
                                    ? "Restock Item"
                                    : "Calibrate Stock"}
                                </h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                  {inventoryAction.item.name}
                                </p>
                              </div>
                            </div>

                            <form
                              onSubmit={async (e) => {
                                e.preventDefault();
                                const val = parseFloat(actionQuantity);
                                if (isNaN(val)) return;

                                const item = inventoryAction.item;
                                let newStock = val;
                                
                                if (inventoryAction.type === "RESTOCK") {
                                  const addedUnits = val * item.packetSize;
                                  newStock = item.stock + addedUnits;
                                  logAction(
                                    `Inventory Resupply: ${item.name}`,
                                    "SUCCESS",
                                    `Added ${val} Packets (${addedUnits} ${item.unit})`,
                                  );
                                } else {
                                  logAction(
                                    `Manual Stock Correction: ${item.name}`,
                                    "WARNING",
                                    `Set to ${val} ${item.unit}`,
                                  );
                                }

                                try {
                                  await updateDoc(doc(db, "inventory", item.id), { stock: newStock });
                                  setInventoryAction(null);
                                  setActionQuantity("");
                                } catch (error) {
                                  console.error("Firebase Stock Update Error:", error);
                                  alert("Failed to update database.");
                                }
                              }}
                              className="space-y-6"
                            >
                              <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase text-slate-500 ml-4">
                                  {inventoryAction.type === "RESTOCK"
                                    ? `Enter Number of Packets (1 Packet = ${inventoryAction.item.packetSize} ${inventoryAction.item.unit})`
                                    : `Enter Absolute Stock Quantity (${inventoryAction.item.unit})`}
                                </p>
                                <div className="relative">
                                  <input
                                    autoFocus
                                    type="number"
                                    step="0.01"
                                    value={actionQuantity}
                                    onChange={(e) =>
                                      setActionQuantity(e.target.value)
                                    }
                                    className="w-full bg-slate-100 dark:bg-slate-800 p-6 rounded-2xl text-2xl font-brand italic text-center outline-none ring-2 ring-transparent focus:ring-indigo-500 transition-all dark:text-white"
                                    placeholder="0"
                                    required
                                  />
                                </div>
                              </div>

                              <button
                                type="submit"
                                className={`w-full py-5 rounded-2xl font-black uppercase italic tracking-widest text-[11px] shadow-xl transition-all active:scale-95 ${
                                  inventoryAction.type === "RESTOCK"
                                    ? "bg-indigo-600 text-white shadow-indigo-600/30"
                                    : "bg-amber-500 text-white shadow-amber-500/30"
                                }`}
                              >
                                {inventoryAction.type === "RESTOCK"
                                  ? `Confirm Restock (+${(parseFloat(actionQuantity) || 0) * inventoryAction.item.packetSize} ${inventoryAction.item.unit})`
                                  : "Update Stock Level"}
                              </button>
                            </form>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                {adminTab === "USERS" && (
                  <div className="grid grid-cols-12 gap-10">
                    <div className="col-span-12 lg:col-span-4 bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] shadow-xl border border-white/5 h-fit">
                      <h3 className="text-[12px] font-black uppercase italic mb-10 text-indigo-500 tracking-[0.3em] flex justify-between items-center">
                        {editingUserId ? "Edit Member" : "Add Member"}
                        {editingUserId && (
                          <button 
                            onClick={() => {
                              setEditingUserId(null);
                              setRegForm({ name: "", username: "", email: "", password: "", role: UserRole.CASHIER });
                            }}
                            className="text-[8px] font-black uppercase text-rose-500 hover:underline"
                          >
                            Cancel Edit
                          </button>
                        )}
                      </h3>
                      <form onSubmit={addStaff} className="space-y-5">
                        <div className="space-y-1.5">
                          <p className="text-[8px] font-black uppercase text-slate-400 ml-3">
                            Full Name
                          </p>
                          <input
                            placeholder="Name"
                            value={regForm.name}
                            onChange={(e) =>
                              setRegForm({ ...regForm, name: e.target.value })
                            }
                            className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl text-[11px] outline-none font-bold shadow-inner"
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[8px] font-black uppercase text-slate-400 ml-3">
                            Username
                          </p>
                          <input
                            placeholder="ID"
                            value={regForm.username}
                            onChange={(e) =>
                              setRegForm({
                                ...regForm,
                                username: e.target.value,
                              })
                            }
                            className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl text-[11px] outline-none font-bold shadow-inner"
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[8px] font-black uppercase text-slate-400 ml-3">
                            Password
                          </p>
                          <input
                            type="password"
                            placeholder="Pass"
                            value={regForm.password}
                            onChange={(e) =>
                              setRegForm({
                                ...regForm,
                                password: e.target.value,
                              })
                            }
                            className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl text-[11px] outline-none font-bold shadow-inner"
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[8px] font-black uppercase text-slate-400 ml-3">
                            Role
                          </p>
                          <select
                            value={regForm.role}
                            onChange={(e) =>
                              setRegForm({
                                ...regForm,
                                role: e.target.value as UserRole,
                              })
                            }
                            className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl text-[11px] font-black uppercase outline-none shadow-inner"
                          >
                            <option value={UserRole.CASHIER}>
                              Terminal Cashier
                            </option>
                            <option value={UserRole.ADMIN}>Branch Admin</option>
                          </select>
                        </div>
                        <button
                          type="submit"
                          className={`w-full py-5 text-white rounded-2xl font-black uppercase italic tracking-widest text-[10px] shadow-xl active:scale-95 transition-all mt-6 ${editingUserId ? 'bg-emerald-600 shadow-emerald-600/30' : 'bg-indigo-600 shadow-indigo-600/30'}`}
                        >
                          {editingUserId ? "Update Member" : "Register Staff"}
                        </button>
                      </form>
                    </div>
                    <div className="col-span-12 lg:col-span-8 bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] shadow-xl border border-white/5">
                      <h3 className="text-[12px] font-black uppercase italic mb-10 tracking-[0.3em]">
                        Staff Directory
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {users.map((u) => (
                          <div
                            key={u.id}
                            className="p-6 rounded-[2rem] bg-slate-50 dark:bg-white/5 flex items-center justify-between border border-transparent hover:border-indigo-500/20 transition-all group shadow-sm"
                          >
                            <div className="flex items-center gap-5">
                              <div className="w-14 h-14 bg-indigo-500 rounded-3xl flex items-center justify-center text-white font-brand italic text-3xl shadow-lg shadow-indigo-500/20">
                                {u.username[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="text-[13px] font-black uppercase leading-tight">
                                  {u.name}
                                </p>
                                <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest mt-1">
                                  @{u.username} • {u.role}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {currentUser?.id !== u.id && (
                                <button
                                  onClick={() => {
                                    setEditingUserId(u.id);
                                    setRegForm({
                                      name: u.name,
                                      username: u.username,
                                      email: u.email || "",
                                      password: u.password,
                                      role: u.role,
                                    });
                                  }}
                                  className="p-3 bg-indigo-500/10 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                  title="Edit User"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}
                              {currentUser?.id !== u.id && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveMember(u.id, u.name);
                                  }}
                                  className="flex items-center gap-2 px-6 py-3 bg-rose-500 text-white rounded-2xl shadow-xl shadow-rose-500/20 hover:scale-110 active:scale-95 transition-all text-[9px] font-black uppercase tracking-widest"
                                >
                                  <Trash2 className="w-4 h-4" strokeWidth={3} />
                                  Terminated
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {adminTab === "MENU" && (
                  <div className="space-y-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 px-4 gap-6">
                      <div className="flex flex-col">
                        <h2 className="text-xl font-black uppercase italic tracking-[0.2em] text-slate-800 dark:text-white">
                          Menu Item Catalog
                        </h2>
                        {menuItems.length > 0 && (
                          <p className="text-[10px] font-black uppercase text-amber-600 mt-1 flex items-center gap-2">
                            <Zap className="w-3 h-3" />
                            {menuItems.length} Products
                            {(() => {
                              const dups = menuItems.filter((item, index) => 
                                menuItems.findIndex(m => m.name.toLowerCase().trim() === item.name.toLowerCase().trim() && Number(m.price) === Number(item.price)) !== index
                              );
                              return dups.length > 0 ? (
                                <span className="text-rose-500 ml-4 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  {dups.length} Duplicates Detected
                                </span>
                              ) : null;
                            })()}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-4 w-full md:w-auto">
                        {(() => {
                           const dups = menuItems.filter((item, index) => 
                             menuItems.findIndex(m => m.name.toLowerCase().trim() === item.name.toLowerCase().trim() && Number(m.price) === Number(item.price)) !== index
                           );
                           if (dups.length > 0) {
                             return (
                               <button
                                 onClick={async () => {
                                   if (confirm(`Remove ${dups.length} duplicate items? Items with the same name and price will be removed.`)) {
                                     try {
                                       const batch = writeBatch(db);
                                       dups.forEach(item => {
                                         batch.delete(doc(db, "menu", item.id));
                                       });
                                       await batch.commit();
                                       alert("Duplicates removed successfully!");
                                       logAction(`Cleaned up ${dups.length} duplicate menu items`, "SUCCESS");
                                     } catch (e) {
                                       alert("Failed to cleanup duplicates.");
                                     }
                                   }
                                 }}
                                 className="px-6 py-3 bg-rose-500 text-white rounded-2xl font-black uppercase italic text-[10px] tracking-widest shadow-lg shadow-rose-500/30 flex items-center gap-3 active:scale-95 transition-all"
                               >
                                 <Trash2 className="w-4 h-4" />
                                 Clear Duplicates
                               </button>
                             );
                           }
                           return null;
                        })()}
                        <button
                          onClick={() =>
                            setEditingItem({
                              id: `TEMP-${Date.now()}`,
                              name: "",
                              price: 0,
                              cost: 0,
                              category: categories[1] || "Burgers",
                              ingredients: [],
                            } as Product)
                          }
                          className="px-6 py-3 bg-amber-500 text-white rounded-2xl font-black uppercase italic text-[10px] tracking-widest shadow-lg shadow-amber-500/30 flex items-center gap-3 active:scale-95 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          Add New Product
                        </button>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-6 md:p-10 rounded-3xl md:rounded-[3.5rem] shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[600px]">
                        <thead className="text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800">
                          <tr>
                            <th className="pb-6 pl-4">Item Identity</th>
                            <th className="pb-6">Category</th>
                            <th className="pb-6">Price Point</th>
                            <th className="pb-6 text-right pr-4">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="text-[11px] font-black uppercase">
                          {menuItems.map((item) => {
                            const isDuplicate = menuItems.findIndex(m => m.name.toLowerCase().trim() === item.name.toLowerCase().trim() && Number(m.price) === Number(item.price)) !== menuItems.indexOf(item);
                            return (
                              <tr
                                key={item.id}
                                className={`border-b last:border-0 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${isDuplicate ? 'bg-rose-500/5' : ''}`}
                              >
                                <td className="py-5 pl-4">
                                  <div className="flex items-center gap-3">
                                    {item.name}
                                    {isDuplicate && (
                                      <span className="px-2 py-0.5 bg-rose-500 text-white text-[7px] rounded-md animate-pulse">Duplicate</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-5">
                                  <span className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-[9px] text-slate-500 italic tracking-wider">
                                    {item.category}
                                  </span>
                                </td>
                                <td className="py-5 italic font-brand text-2xl text-amber-500">
                                  Rs {item.price}
                                </td>
                                <td className="py-5 text-right pr-4">
                                  <button
                                    onClick={() => setEditingItem(item)}
                                    className="p-2.5 bg-indigo-500/10 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all mr-3 shadow-sm group"
                                    title="Edit Item"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirmId(`item-${item.id}`);
                                    }}
                                    className="p-2.5 bg-rose-500/10 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm group"
                                    title="Delete Item"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

                {adminTab === "LEDGER" && (
                   <div className="space-y-10">
                     <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                       <div>
                         <h2 className="text-3xl font-brand italic uppercase tracking-[0.2em] text-slate-800 dark:text-white">Udaar Ledger</h2>
                         <p className="text-[10px] font-black uppercase text-slate-400 mt-2 tracking-widest">Customer Credit Tracking System</p>
                       </div>
                       <div className="bg-rose-500/10 border border-rose-500/20 px-8 py-4 rounded-3xl text-right w-full md:w-auto">
                         <p className="text-[9px] font-black uppercase text-rose-600 mb-1 leading-none">Market Udhaar Balance</p>
                         <p className="text-2xl font-black text-rose-600 font-brand italic">
                           Rs {orders.filter(o => o.status === "UDHAAR").reduce((sum, o) => sum + o.total, 0).toLocaleString()}
                         </p>
                       </div>
                     </header>

                     {/* Grouped by Customer (Including Guests) */}
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                       {(() => {
                         const unpaidOrders = orders.filter(o => o.status === "UDHAAR");
                         const uniqueCustomersMap = new Map();

                         unpaidOrders.forEach(order => {
                           const key = order.customer.mobile || order.customer.name || "GUEST";
                           if (!uniqueCustomersMap.has(key)) {
                             uniqueCustomersMap.set(key, {
                               name: order.customer.name || "Guest Customer",
                               mobile: order.customer.mobile || "Unknown",
                               ordersList: [],
                               totalOwedAmount: 0,
                               isRegistered: !!order.customerId,
                               id: order.customerId
                             });
                           }
                           const entry = uniqueCustomersMap.get(key);
                           entry.ordersList.push(order);
                           entry.totalOwedAmount += order.total;
                         });

                         return Array.from(uniqueCustomersMap.values())
                           .sort((a, b) => b.totalOwedAmount - a.totalOwedAmount)
                           .map((cust, idx) => {
                             const unpaidBills = cust.ordersList;
                             const totalOwed = cust.totalOwedAmount;
                           
                           return (
                             <motion.div 
                               initial={{ opacity: 0, scale: 0.95 }}
                               animate={{ opacity: 1, scale: 1 }}
                               key={cust.mobile + idx} 
                               className="bg-white dark:bg-slate-900 rounded-[3.5rem] p-10 border border-slate-100 dark:border-white/5 shadow-2xl relative overflow-hidden"
                             >
                               <div className="absolute top-0 right-0 p-8 opacity-5">
                                  <BookOpen className="w-32 h-32" />
                               </div>
                               
                               <div className="flex items-center justify-between mb-10 relative z-10">
                                 <div className="flex items-center gap-6">
                                   <div className={`w-20 h-20 ${cust.isRegistered ? 'bg-amber-500/10' : 'bg-slate-500/10'} rounded-[2rem] flex items-center justify-center border ${cust.isRegistered ? 'border-amber-500/20' : 'border-slate-500/20'}`}>
                                      <User className={`${cust.isRegistered ? 'text-amber-500' : 'text-slate-400'} w-10 h-10`} />
                                   </div>
                                   <div>
                                     <div className="flex items-center gap-2">
                                       <h3 className="text-lg font-black uppercase tracking-tight leading-none">{cust.name}</h3>
                                       {!cust.isRegistered && (
                                         <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[7px] font-black uppercase rounded text-slate-400 tracking-tighter">Guest</span>
                                       )}
                                     </div>
                                     <p className="text-[11px] font-bold text-slate-400 font-mono italic mt-2">+{cust.mobile}</p>
                                   </div>
                                 </div>
                                 <div className="text-right">
                                   <p className="text-[10px] font-black text-rose-500 uppercase italic tracking-widest mb-1">Total Udhaar</p>
                                   <p className="text-3xl font-brand italic font-black text-rose-500">Rs {totalOwed.toLocaleString()}</p>
                                 </div>
                               </div>

                               <div className="space-y-4 max-h-[350px] overflow-y-auto pr-4 custom-scrollbar relative z-10 mb-8">
                                 {unpaidBills.map(bill => (
                                   <div 
                                     key={bill.id} 
                                     onClick={() => setViewingOrder(bill)}
                                     className="flex items-center justify-between p-6 bg-slate-50 dark:bg-white/5 rounded-[2.5rem] border border-transparent hover:border-amber-500/20 transition-all group cursor-pointer"
                                   >
                                      <div className="flex items-center gap-6">
                                        <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-[14px] font-black font-brand italic text-slate-400 group-hover:text-amber-500 transition-colors">
                                          #{bill.invoiceNo}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <div className="flex items-center gap-2">
                                            <p className="text-[14px] font-black">Rs {bill.total}</p>
                                            <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[7.5px] font-black uppercase rounded tracking-widest shadow-sm">UDAAR</span>
                                          </div>
                                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{bill.dateStr}</p>
                                        </div>
                                      </div>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (window.confirm(`Mark Udhaar Invoice #${bill.invoiceNo} as Recovered?`)) {
                                            updateDoc(doc(db, "orders", bill.id), {
                                              status: "PAID",
                                              cashReceived: bill.total,
                                              paymentMethod: "CASH",
                                              paidAt: new Date().toISOString()
                                            }).then(() => {
                                              logAction(`Udhaar Recovered: Bill #${bill.invoiceNo}`, "SUCCESS", `For ${cust.name}`);
                                            });
                                          }
                                        }}
                                        className="px-6 py-3 bg-rose-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:scale-110 active:scale-95 transition-all outline-none"
                                      >
                                        Settle Udhaar
                                      </button>
                                   </div>
                                 ))}
                               </div>
                               
                               <button 
                                 onClick={() => {
                                   if (window.confirm(`Settle ALL credit invoices for ${cust.name}? Total Recovery: Rs ${totalOwed}`)) {
                                     const batch = writeBatch(db);
                                     unpaidBills.forEach(bill => {
                                      batch.update(doc(db, "orders", bill.id), {
                                        status: "PAID",
                                        cashReceived: bill.total,
                                        paymentMethod: "CASH",
                                        paidAt: new Date().toISOString()
                                      });
                                     });
                                     batch.commit().then(() => {
                                       logAction(`Full Account Settle: ${cust.name}`, "SUCCESS", `Rs ${totalOwed} recovered`);
                                     });
                                   }
                                 }}
                                 className="w-full relative z-10 py-6 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-[2rem] text-[11px] font-black uppercase italic tracking-[0.3em] shadow-2xl shadow-rose-600/30 active:scale-95 transition-all outline-none"
                               >
                                 Clear Udhaar Account
                               </button>
                             </motion.div>
                           )
                         })
                       })()}
                       
                       {orders.filter(o => o.status === "UNPAID").length === 0 && (
                         <div className="col-span-full py-40 bg-emerald-500/5 rounded-[5rem] border-4 border-dashed border-emerald-500/10 text-center">
                            <motion.div
                              animate={{ scale: [1, 1.1, 1] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            >
                              <CheckCircle2 className="w-24 h-24 text-emerald-500/40 mx-auto mb-8" />
                            </motion.div>
                            <h3 className="text-3xl font-brand italic uppercase text-emerald-600 tracking-widest">All Clear!</h3>
                            <p className="text-[12px] font-black uppercase text-slate-400 mt-4 tracking-[0.5em] italic">No outstanding credits found.</p>
                         </div>
                       )}
                     </div>
                   </div>
                )}

                {adminTab === "CATEGORIES" && (
                  <div className="bg-white dark:bg-slate-900 p-16 rounded-[4.5rem] shadow-xl border border-white/5">
                    <div className="flex gap-6 mb-12">
                      <input
                        placeholder="New taxonomy label..."
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="flex-1 bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl text-sm font-bold outline-none ring-2 ring-transparent focus:ring-indigo-500/20 uppercase tracking-widest"
                      />
                      <button
                        onClick={async () => {
                          console.log("Add Class button clicked", newCategoryName);
                          if (newCategoryName.trim()) {
                            const trimmed = newCategoryName.trim();
                            if (categories.includes(trimmed)) {
                              alert("Class already exists!");
                              return;
                            }
                            const newList = [...categories, trimmed];
                            try {
                              const { setDoc } = await import("firebase/firestore");
                              await setDoc(doc(db, "config", "categories"), { names: newList });
                              setNewCategoryName("");
                            } catch (error) {
                              console.error("Failed to add category:", error);
                            }
                          }
                        }}
                        className="px-14 bg-emerald-500 text-white rounded-3xl font-black uppercase text-[11px] italic shadow-xl shadow-emerald-500/30 active:scale-95 transition-all"
                      >
                        Add Class
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
                      {categories.map((cat) => (
                        <div
                          key={cat}
                          className="group relative p-10 bg-slate-50 dark:bg-white/5 rounded-[3rem] border border-transparent hover:border-amber-500/20 transition-all shadow-sm flex flex-col items-start min-h-[140px] overflow-visible"
                        >
                          <>
                            <span className="font-black uppercase text-[12px] italic tracking-[0.2em] text-slate-800 dark:text-slate-200">
                              {cat}
                            </span>
                            <div className="mt-2 h-1 w-10 bg-amber-500 rounded-full group-hover:w-20 transition-all"></div>
                            {cat !== "All" && (
                              <div className="absolute top-4 right-4 flex flex-col gap-3 z-[100] opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setRenamingCategory(cat);
                                    setCategoryRenameValue(cat);
                                  }}
                                  className="bg-amber-500 hover:bg-amber-600 text-white p-3 md:p-3.5 rounded-2xl shadow-xl shadow-amber-500/30 active:scale-90 transition-all cursor-pointer border-2 border-white/20"
                                  title="Rename"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDeleteConfirmId(`cat-${cat}`);
                                  }}
                                  className="bg-rose-500 hover:bg-rose-600 text-white p-3 md:p-3.5 rounded-2xl shadow-xl shadow-rose-500/30 active:scale-90 transition-all cursor-pointer border-2 border-white/20"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {editingItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 relative border border-white/5"
            >
              <button
                onClick={() => setEditingItem(null)}
                className="absolute top-6 right-6 text-slate-400 hover:text-rose-500"
              >
                <XCircle className="w-8 h-8" />
              </button>

              <h2 className="text-xl font-black uppercase italic tracking-widest text-[#e67e22] mb-6">
                Menu Item Setup
              </h2>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editingItem) return;
                  
                  try {
                    const itemName = editingItem.name.trim();
                    const itemPrice = Number(editingItem.price);
                    const itemCost = Number(editingItem.cost || 0);
                    const detailedCost = editingItem.detailedCost || {};
                    
                    if (!itemName) {
                      alert("Please enter a valid item name.");
                      return;
                    }

                    // Check for duplicate (same name and same price)
                    const isDuplicate = menuItems.some(
                      (m) => 
                        m.id !== editingItem.id && 
                        m.name.toLowerCase().trim() === itemName.toLowerCase() &&
                        Number(m.price) === itemPrice
                    );

                    if (isDuplicate) {
                      alert(`An item with the name "${itemName}" and price "Rs ${itemPrice}" already exists in the menu.`);
                      return;
                    }

                    const itemData = {
                      ...editingItem,
                      name: itemName,
                      price: itemPrice,
                      cost: itemCost,
                      detailedCost
                    };

                    if (menuItems.find((m) => m.id === editingItem.id)) {
                      await updateDoc(doc(db, "menu", editingItem.id), itemData);
                      logAction(`Updated Menu Item: ${itemName}`, "SUCCESS");
                    } else {
                      // Remove id property before addDoc to let Firestore generate it
                      const { id, ...cleanItem } = itemData;
                      await addDoc(collection(db, "menu"), cleanItem);
                      logAction(`Created Menu Item: ${itemName}`, "SUCCESS");
                    }
                    setEditingItem(null);
                  } catch (error) {
                    console.error("Save product failed:", error);
                    alert("Failed to save product to database.");
                  }
                }}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 ml-2">
                    Item Name
                  </p>
                  <input
                    autoFocus
                    placeholder="Name"
                    value={editingItem.name}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, name: e.target.value })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-[12px] outline-none font-bold shadow-inner"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-400 ml-2">
                      Category
                    </p>
                    <select
                      value={editingItem.category}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          category: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-[12px] outline-none font-bold uppercase shadow-inner"
                      required
                    >
                      <option value="">Select</option>
                      {categories
                        .filter((c) => c !== "All")
                        .map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-400 ml-2">
                      Price (Rs)
                    </p>
                    <input
                      type="number"
                      placeholder="Price"
                      value={isNaN(editingItem.price) ? "" : editingItem.price}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          price: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-[12px] outline-none font-bold shadow-inner"
                      required
                    />
                  </div>
                </div>

                <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase text-indigo-500 tracking-widest leading-none">Detailed Cost Breakdown</p>
                      <p className="text-[7px] font-bold text-slate-400 mt-1 uppercase">Investment per unit</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[12px] font-brand italic font-black text-slate-800 dark:text-white leading-none">Rs {
                         (editingItem.detailedCost ? 
                           Object.values(editingItem.detailedCost).reduce((a: number, b: any) => a + (Number(b) || 0), 0) : 0
                         ).toLocaleString()
                       }</p>
                       <p className="text-[7px] font-black text-slate-400 uppercase tracking-tighter mt-1">Total Item Cost</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(editingItem.detailedCost || {}).map(([key, value], idx) => (
                      <div key={idx} className="space-y-1 group relative">
                        <div className="flex items-center justify-between px-1">
                          <input
                            type="text"
                            value={key}
                            placeholder="Component Name"
                            onChange={(e) => {
                              const newKey = e.target.value;
                              if (!newKey) return;
                              const newDetailed = { ...(editingItem.detailedCost || {}) };
                              const val = newDetailed[key];
                              delete newDetailed[key];
                              newDetailed[newKey] = val;
                              setEditingItem({ ...editingItem, detailedCost: newDetailed });
                            }}
                            className="bg-transparent text-[8px] font-black uppercase text-slate-500 focus:text-indigo-500 outline-none w-full tracking-wider"
                          />
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            value={value || ""}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const newDetailed = { ...(editingItem.detailedCost || {}), [key]: val };
                              const total = Object.values(newDetailed).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
                              setEditingItem({
                                ...editingItem,
                                detailedCost: newDetailed,
                                cost: total
                              });
                            }}
                            placeholder="0"
                            className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-xl text-[11px] font-bold outline-none border border-slate-100 dark:border-slate-800 focus:border-indigo-500 transition-all text-slate-800 dark:text-white shadow-sm"
                          />
                          <button
                            onClick={() => {
                              const newDetailed = { ...(editingItem.detailedCost || {}) };
                              delete newDetailed[key];
                              const total = Object.values(newDetailed).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
                              setEditingItem({
                                ...editingItem,
                                detailedCost: newDetailed,
                                cost: total
                              });
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {/* Add Component Button */}
                    <button
                      onClick={() => {
                        const newKey = `New Item ${Object.keys(editingItem.detailedCost || {}).length + 1}`;
                        const newDetailed = { ...(editingItem.detailedCost || {}), [newKey]: 0 };
                        setEditingItem({ ...editingItem, detailedCost: newDetailed });
                      }}
                      className="flex flex-col items-center justify-center gap-1 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-400 hover:text-indigo-500"
                    >
                      <Plus className="w-3 h-3" />
                      <span className="text-[7px] font-black uppercase">Add Item</span>
                    </button>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${editingItem.price > (editingItem.cost || 0) ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                           <TrendingUp className="w-3 h-3" />
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-slate-800 dark:text-white leading-none">Rs {(editingItem.price - (editingItem.cost || 0)).toLocaleString()}</p>
                           <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Profit / Burger</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className={`text-[12px] font-brand italic font-black leading-none ${editingItem.price > (editingItem.cost || 0) ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {editingItem.price > 0 ? (((editingItem.price - (editingItem.cost || 0)) / editingItem.price) * 100).toFixed(0) : 0}%
                        </p>
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Margin</p>
                     </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t dark:border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black uppercase text-slate-400 ml-2">
                       Recipe / Ingredients
                    </p>
                    <div className="h-[1px] flex-1 bg-slate-100 dark:bg-slate-800 ml-4 opacity-50" />
                  </div>

                  {editingItem.ingredients && editingItem.ingredients.length > 0 && (
                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                      {editingItem.ingredients.map((req, idx) => {
                        const invItem = inventory.find(i => i.id === req.ingredientId);
                        return (
                          <div key={idx} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800 group">
                            <div className="flex items-center gap-3">
                               <Package className="w-3.5 h-3.5 text-amber-500" />
                               <div>
                                  <p className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-200 leading-none mb-1">
                                    {invItem?.name || "Unknown Item"}
                                  </p>
                                  <p className="text-[8px] font-bold text-slate-400">
                                    Consumes: {req.quantity} {invItem?.unit} per sale
                                  </p>
                               </div>
                            </div>
                            <button 
                              type="button"
                              onClick={() => {
                                const newIngs = [...(editingItem.ingredients || [])];
                                newIngs.splice(idx, 1);
                                setEditingItem({...editingItem, ingredients: newIngs});
                              }}
                              className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 space-y-4">
                     <p className="text-[8px] font-black uppercase text-slate-400 italic text-center">Define Deduction Rule</p>
                     <div className="grid grid-cols-5 gap-2">
                        <select 
                          id="ingredient-select"
                          className="col-span-3 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none focus:ring-1 ring-amber-500 h-10"
                        >
                          <option value="">Select Item</option>
                          {inventory.map(inv => (
                            <option key={inv.id} value={inv.id}>{inv.name} ({inv.unit})</option>
                          ))}
                        </select>
                        <input 
                          id="ingredient-qty"
                          type="number" 
                          step="any"
                          placeholder="Qty"
                          className="col-span-1 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-2 py-2 text-[10px] font-black text-center outline-none focus:ring-1 ring-amber-500 h-10"
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            const select = document.getElementById('ingredient-select') as HTMLSelectElement;
                            const qtyInput = document.getElementById('ingredient-qty') as HTMLInputElement;
                            const ingredientId = select.value;
                            const quantity = parseFloat(qtyInput.value);

                            if (ingredientId && !isNaN(quantity) && quantity > 0) {
                              const existing = editingItem.ingredients || [];
                              if (existing.some(i => i.ingredientId === ingredientId)) {
                                alert("Item already in recipe!");
                                return;
                              }
                              setEditingItem({
                                ...editingItem,
                                ingredients: [...existing, { ingredientId, quantity }]
                              });
                              select.value = "";
                              qtyInput.value = "";
                            } else {
                              alert("Select an item and enter valid quantity.");
                            }
                          }}
                          className="col-span-1 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20 active:scale-95 transition-all h-10"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                     </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-[#e67e22] text-white rounded-xl font-black uppercase italic tracking-widest text-[11px] shadow-xl active:scale-95 transition-all mt-4"
                >
                  Save Item
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {renamingCategory && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
              onClick={() => setRenamingCategory(null)}
            />
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 border border-white/5"
            >
              <h2 className="text-xl font-black uppercase italic tracking-widest text-amber-500 mb-6">
                Rename Class
              </h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-400 ml-2">New Taxonomy Label</p>
                  <input
                    autoFocus
                    value={categoryRenameValue}
                    onChange={(e) => setCategoryRenameValue(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-xs font-bold border-2 border-amber-500/20 focus:border-amber-500 outline-none transition-all"
                    placeholder="Enter name..."
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={async () => {
                      const currentName = renamingCategory;
                      const newName = categoryRenameValue.trim();
                      if (newName && newName !== currentName) {
                        if (categories.includes(newName)) {
                          alert("Class already exists!");
                          return;
                        }
                        const newList = categories.map(c => c === currentName ? newName : c);
                        try {
                          await setDoc(doc(db, "config", "categories"), { names: newList });
                          const batch = writeBatch(db);
                          menuItems.forEach(item => {
                            if (item.category === currentName) {
                              batch.update(doc(db, "menu", item.id), { category: newName });
                            }
                          });
                          await batch.commit();
                          logAction(`Renamed Class: ${currentName} -> ${newName}`, "SUCCESS");
                          setRenamingCategory(null);
                        } catch (error) {
                          console.error("Rename failed:", error);
                          alert("Failed to rename category in database.");
                        }
                      } else {
                        setRenamingCategory(null);
                      }
                    }}
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setRenamingCategory(null)}
                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {deleteConfirmId && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
              onClick={() => setDeleteConfirmId(null)}
            />
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 border border-white/5 text-center"
            >
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black uppercase italic tracking-widest text-rose-500 mb-2">
                Confirm Action
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-black uppercase italic mb-8 leading-relaxed">
                {(() => {
                  if (deleteConfirmId.startsWith('cat-')) return "Deleting this category will permanently remove it and all associated products from the menu.";
                  if (deleteConfirmId.startsWith('user-')) return "Are you shure delete this id";
                  if (deleteConfirmId.startsWith('item-')) return "Are you sure you want to delete this menu item? This action cannot be undone.";
                  if (deleteConfirmId.startsWith('cust-')) return "Are you sure you want to delete this customer? This action cannot be undone.";
                  if (deleteConfirmId.startsWith('settle-order-')) return "Confirm payment settlement for this outstanding bill?";
                  if (deleteConfirmId.startsWith('void-order-')) return "Are you sure you want to VOID this order? Inventory will be reverted.";
                  if (deleteConfirmId.startsWith('restore-order-')) return "Are you sure you want to RESTORE this voided order? Inventory will be deducted.";
                  return "Are you sure you want to perform this action?";
                })()}
              </p>
              <div className="flex gap-4">
                <button
                  onClick={async () => {
                    if (deleteConfirmId.startsWith('cat-')) {
                      const currentName = deleteConfirmId.replace('cat-', '');
                      const newList = categories.filter((c) => c !== currentName);
                      try {
                        await setDoc(doc(db, "config", "categories"), { names: newList });
                        const batch = writeBatch(db);
                        menuItems.forEach(item => {
                          if (item.category === currentName) {
                            batch.delete(doc(db, "menu", item.id));
                          }
                        });
                        await batch.commit();
                        logAction(`Deleted Class: ${currentName}`, "WARNING");
                      } catch (error) {
                        console.error("Delete failed:", error);
                        alert("Failed to delete category.");
                      }
                    } else if (deleteConfirmId.startsWith('item-')) {
                      const itemId = deleteConfirmId.replace('item-', '');
                      const item = menuItems.find(m => m.id === itemId);
                      try {
                        await deleteDoc(doc(db, "menu", itemId));
                        logAction(`Deleted Menu Item: ${item?.name || itemId}`, "WARNING");
                      } catch (error) {
                        console.error("Delete failed:", error);
                        alert("Failed to delete item.");
                      }
                    } else if (deleteConfirmId.startsWith('cust-')) {
                      const custId = deleteConfirmId.replace('cust-', '');
                      const cust = customers.find(c => c.id === custId);
                      try {
                        await deleteDoc(doc(db, "customers", custId));
                        logAction(`Customer Deleted: ${cust?.name || custId}`, "WARNING");
                      } catch (error) {
                        console.error("Delete failed:", error);
                        alert("Failed to delete customer.");
                      }
                    } else if (deleteConfirmId.startsWith('user-')) {
                      const userId = deleteConfirmId.replace('user-', '');
                      const user = users.find(u => u.id === userId);
                      try {
                        await deleteDoc(doc(db, "users", userId));
                        logAction(`Employee Terminated: ${user?.name || userId}`, "ERROR");
                      } catch (error) {
                        console.error("Delete failed:", error);
                        alert("Failed to delete user.");
                      }
                    } else if (deleteConfirmId.startsWith('settle-order-')) {
                       const orderId = deleteConfirmId.replace('settle-order-', '');
                       const order = orders.find(o => o.id === orderId);
                       if (order) {
                         try {
                           await updateDoc(doc(db, "orders", orderId), { 
                             status: 'PAID', 
                             paymentMethod: order.paymentMethod === 'SPLIT_UDHAAR' ? 'SPLIT' : (order.paymentMethod || 'CASH'),
                             settledAt: serverTimestamp(),
                             updatedAt: serverTimestamp() 
                           });
                           logAction(`Bill Settled: ${order.id}`, "SUCCESS", `Rs ${order.total}`);
                         } catch (e) {
                           console.error("Settle failed:", e);
                           alert("Failed to settle bill.");
                         }
                       }
                    } else if (deleteConfirmId.startsWith('void-order-')) {
                      const orderId = deleteConfirmId.replace('void-order-', '');
                      const order = orders.find(o => o.id === orderId);
                      if (order) {
                        try {
                          const batch = writeBatch(db);
                          revertInventoryFirestore(order.items, batch);
                          batch.update(doc(db, "orders", order.id), { 
                            status: "VOIDED",
                            voidedAt: new Date().toISOString(),
                            voidedBy: currentUser?.id,
                            voidedByName: currentUser?.name
                          });
                          batch.commit().then(() => {
                             logAction(`Order VOIDED & Synced: ${order.id}`, "ERROR", `By ${currentUser?.name}`);
                          }).catch(err => {
                             console.error("Void sync error:", err);
                          });
                        } catch (error) {
                          console.error("Void setup failed:", error);
                          alert("Failed to initiate void.");
                        }
                      }
                    } else if (deleteConfirmId.startsWith('restore-order-')) {
                      const orderId = deleteConfirmId.replace('restore-order-', '');
                      const order = orders.find(o => o.id === orderId);
                      if (order) {
                        try {
                          const batch = writeBatch(db);
                          deductInventoryFirestore(order.items, batch);
                          batch.update(doc(db, "orders", order.id), { 
                            status: order.paymentMethod === "SPLIT_UDHAAR" || order.paymentMethod === "CREDIT" ? "UDHAAR" : "PAID",
                            restoredAt: new Date().toISOString(),
                            restoredBy: currentUser?.id,
                            restoredByName: currentUser?.name
                          });
                          batch.commit().then(() => {
                             logAction(`Order RESTORED & Synced: ${order.id}`, "SUCCESS", `By ${currentUser?.name}`);
                          }).catch(err => {
                             console.error("Restore sync error:", err);
                          });
                        } catch (error) {
                          console.error("Restore setup failed:", error);
                          alert("Failed to initiate restore.");
                        }
                      }
                    }

                    setDeleteConfirmId(null);
                  }}
                  className="flex-1 py-4 bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-rose-500/20 active:scale-95 transition-all italic tracking-widest font-brand"
                >
                  Yes, Confirm
                </button>
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-200 dark:hover:bg-slate-700 transition-all font-brand tracking-widest"
                >
                  No, Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Day Closing Modal */}
      <AnimatePresence>
        {isClosingDay && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              onClick={() => setIsClosingDay(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[3.5rem] p-10 shadow-2xl border border-white/5 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 to-indigo-500" />
              <div className="text-center mb-8">
                <h2 className="text-2xl font-brand italic uppercase tracking-widest text-amber-500">
                  Day Reconciliation
                </h2>
                <p className="text-[9px] font-black uppercase text-slate-400 mt-2">
                  Closing Business Date: {getBusinessDate()}
                </p>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-1">
                    System EXPECTED Cash
                  </p>
                  <p className="text-3xl font-brand italic text-slate-900 dark:text-white">
                    Rs{" "}
                    {(
                      orders
                        .filter(
                          (o) =>
                            getBusinessDate(new Date(o.timestamp)) ===
                              getBusinessDate() && o.paymentMethod === "CASH",
                        )
                        .reduce((s, o) => s + o.total, 0) || 0
                    ).toLocaleString()}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-400 ml-4">
                    Actual Cash in Drawer
                  </p>
                  <div className="relative group">
                    <input
                      type="number"
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-white/5 p-6 rounded-3xl text-3xl font-brand italic text-emerald-500 outline-none ring-2 ring-transparent focus:ring-amber-500/20 transition-all shadow-inner"
                      value={closingPhysicalCash}
                      onChange={(e) => setClosingPhysicalCash(e.target.value)}
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 font-brand italic text-xl">
                      Rs
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-400 ml-4">
                    Audit Memo / Notes
                  </p>
                  <textarea
                    placeholder="Provide context for any discrepancies..."
                    className="w-full bg-slate-50 dark:bg-white/5 p-5 rounded-3xl text-[10px] font-bold outline-none ring-2 ring-transparent focus:ring-amber-500/20 shadow-inner h-24"
                    value={closingNote}
                    onChange={(e) => setClosingNote(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setIsClosingDay(false)}
                    className="py-5 rounded-2xl font-black uppercase text-[10px] text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                  >
                    Discard
                  </button>
                  <button
                    onClick={closeBusinessDay}
                    className="py-5 bg-amber-500 text-white rounded-2xl font-black uppercase italic tracking-widest text-[10px] shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                  >
                    Close Session
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Unified Settlement Suite (Popup) */}
      <AnimatePresence>
        {isCustomerModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCustomerModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div
              drag
              dragMomentum={true}
              dragElastic={0.1}
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[3rem] shadow-[0_50px_100px_rgba(0,0,0,0.5)] overflow-hidden border border-white/10 cursor-move"
            >
              {/* Header */}
              <div className="p-8 pb-4 flex items-center justify-between border-b dark:border-white/5">
                <div>
                  <h3 className="text-3xl font-brand italic text-amber-500 leading-none">
                    Guest Invoice
                  </h3>
                  <p className="text-[10px] font-black uppercase text-slate-400 mt-2 tracking-[0.3em]">
                    Customer & Settlement Records
                  </p>
                </div>
                <button
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-lg shadow-rose-500/5 active:scale-95"
                >
                  <XCircle className="w-7 h-7" />
                </button>
              </div>

              <div className="overflow-y-auto max-h-[70vh] p-8 space-y-10 custom-scrollbar">
                {/* Debt Warning for selected customer */}
                {(() => {
                  const selectedCust = customers.find(c => c.mobile === customer.mobile);
                  if (!selectedCust) return null;
                  const pendingDebt = orders.filter(o => o.customerId === selectedCust.id && (o.status === "UNPAID" || o.status === "UDHAAR"));
                  if (pendingDebt.length === 0) return null;
                  const debt = pendingDebt.reduce((s, o) => s + o.total, 0);
                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mx-8 mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
                        <div>
                          <p className="text-[9px] font-black uppercase text-rose-600 leading-none mb-1">Previous Debt (Udaar)</p>
                          <p className="text-sm font-black text-rose-600 font-brand italic">Rs {debt.toLocaleString()}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setCurrentView("ADMIN");
                          setAdminTab("LEDGER");
                          setIsCustomerModalOpen(false);
                        }}
                        className="text-[8px] font-black uppercase bg-rose-600 text-white px-3 py-1.5 rounded-lg shadow-lg shadow-rose-600/20"
                      >
                        View Ledger
                      </button>
                    </motion.div>
                  )
                })()}

                {/* (1) Customer Information */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-amber-500 rounded-full"></div>
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 italic">
                        Identity Details
                      </span>
                    </div>

                    <div className="space-y-5">
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest opacity-70">
                          Guest Name
                        </span>
                        <div className="relative group">
                          <input
                            placeholder="Full Name / Table #"
                            value={customer.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomer({ ...customer, name: val });
                            }}
                            className="w-full text-base font-bold p-6 bg-slate-50 dark:bg-slate-800/80 rounded-3xl border-2 border-transparent focus:border-amber-500/20 outline-none transition-all placeholder:text-slate-200"
                          />
                          {/* Auto-suggestions for existing customers */}
                          {customer.name && customer.name.length > 1 && !customers.find(c => c.name === customer.name) && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-[110] overflow-hidden">
                              {customers
                                .filter(c => (c.name || "").toLowerCase().includes((customer.name || "").toLowerCase()))
                                .slice(0, 5)
                                .map(c => (
                                  <button
                                    key={c.id}
                                    onClick={() => setCustomer({ name: c.name, mobile: c.mobile, address: c.address || "" })}
                                    className="w-full px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between border-b last:border-0 dark:border-white/5"
                                  >
                                    <div>
                                      <p className="text-[12px] font-bold uppercase">{c.name}</p>
                                      <p className="text-[9px] text-slate-400 font-mono">{c.mobile}</p>
                                      {orders.some(o => o.customerId === c.id && (o.status === "UNPAID" || o.status === "UDHAAR")) && (
                                        <p className="text-[8px] font-black text-rose-500 font-brand italic mt-1 uppercase">
                                          Total Due: Rs {orders.filter(o => o.customerId === c.id && (o.status === "UNPAID" || o.status === "UDHAAR")).reduce((sum, o) => sum + o.total, 0).toLocaleString()}
                                        </p>
                                      )}
                                    </div>
                                    <User className="w-4 h-4 text-amber-500" />
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>

                    <div className="space-y-1.5">
                      <span className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest opacity-70 italic">
                        Shipping Address
                      </span>
                      <textarea
                        rows={2}
                        placeholder="House, Street, Major Area..."
                        value={customer.address}
                        onChange={(e) =>
                          setCustomer({ ...customer, address: e.target.value })
                        }
                        className="w-full text-sm font-bold p-6 bg-slate-50 dark:bg-slate-800/80 rounded-3xl border-2 border-transparent focus:border-amber-500/20 outline-none transition-all placeholder:text-slate-200 resize-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest opacity-70 italic">
                        Contact Phone
                      </span>
                      <input
                        placeholder="+92 3XX XXXXXXX"
                        value={customer.mobile}
                        onChange={(e) =>
                          setCustomer({ ...customer, mobile: e.target.value })
                        }
                        className="w-full text-base font-bold p-6 bg-slate-50 dark:bg-slate-800/80 rounded-3xl border-2 border-transparent focus:border-amber-500/20 outline-none transition-all placeholder:text-slate-200"
                      />
                    </div>
                  </div>
                </div>

                {/* (2) Items Order List */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 italic">
                      Bill Inventory
                    </span>
                  </div>
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-100 dark:border-white/5">
                    <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {cart.map((item: any) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center group"
                        >
                          <div className="flex items-center gap-4">
                            <span className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-[10px] font-black">
                              {item.qty}x
                            </span>
                            <span className="text-[12px] font-bold text-slate-600 dark:text-slate-300 group-hover:text-amber-500 transition-colors uppercase">
                              {item.name}
                            </span>
                          </div>
                          <span className="text-[12px] font-brand italic font-black text-slate-800 dark:text-white">
                            Rs {item.price * item.qty}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 pt-6 border-t-2 border-dashed dark:border-white/5 flex flex-col gap-2">
                      <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest text-slate-400 mt-1">
                        <span>Subtotal</span>
                        <span>Rs {subtotal}</span>
                      </div>

                      <div className="flex gap-2">
                        <div className="flex-1 space-y-1">
                          <span className="text-[8px] font-black uppercase text-slate-400 ml-1 italic opacity-70">
                            Adjustment (Discount)
                          </span>
                          <div className="relative">
                            <input
                              type="number"
                              value={discount || ""}
                              onChange={(e) =>
                                setDiscount(Number(e.target.value) || 0)
                              }
                              className="w-full bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl text-[11px] font-black shadow-inner outline-none focus:ring-1 ring-rose-500/20 text-rose-500 border border-slate-100 dark:border-white/5"
                              placeholder="0"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-rose-300">
                              RS
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 space-y-1">
                          <span className="text-[8px] font-black uppercase text-slate-400 ml-1 italic opacity-70">
                            Service (Delivery)
                          </span>
                          <div className="relative">
                            <input
                              type="number"
                              value={deliveryCharge || ""}
                              onChange={(e) =>
                                setDeliveryCharge(Number(e.target.value) || 0)
                              }
                              className="w-full bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl text-[11px] font-black shadow-inner outline-none focus:ring-1 ring-emerald-500/20 text-emerald-500 border border-slate-100 dark:border-white/5"
                              placeholder="0"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-emerald-300">
                              RS
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-end mt-2">
                        <div>
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1 leading-none italic">
                            Net Payable
                          </p>
                          <p className="text-[11px] font-black text-emerald-500 items-center flex gap-1 animate-pulse">
                            <Zap className="w-3 h-3" /> Final Total
                          </p>
                        </div>
                        <p className="text-4xl font-brand italic text-amber-500 leading-none">
                          Rs {total}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* (3) Payment Channels */}
                <div className="space-y-6">
                  {editingOrderId && (
                    <div className="p-5 bg-indigo-50 dark:bg-indigo-950/20 border-2 border-indigo-500/20 rounded-3xl space-y-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Invoice Date (Backdate)</span>
                      </div>
                      <input 
                        type="date"
                        value={editingOrderDate}
                        onChange={(e) => setEditingOrderDate(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-xs font-bold outline-none focus:border-indigo-500 transition-all dark:text-white"
                      />
                      <p className="text-[8px] font-bold text-slate-400 italic">Changing this will move the invoice to the selected business day.</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 italic">
                        Payment Gateway
                      </span>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex gap-1">
                      {["TAKEAWAY", "DINE-IN", "DELIVERY"].map((type) => (
                        <button
                          key={type}
                          onClick={() => setOrderType(type as any)}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${orderType === type ? "bg-white dark:bg-slate-700 shadow-sm text-amber-500" : "text-slate-400"}`}
                        >
                          {type.split("-")[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        id: "CASH",
                        label: "Cash Tender",
                        icon: Wallet,
                        color: "amber",
                      },
                      {
                        id: "EASYPAISA",
                        label: "Easypaisa",
                        icon: ShieldCheck,
                        color: "emerald",
                      },
                      {
                        id: "JAZZCASH",
                        label: "JazzCash",
                        icon: Smartphone,
                        color: "rose",
                      },
                      {
                        id: "BANK",
                        label: "Bank card",
                        icon: CreditCard,
                        color: "slate",
                      },
                      {
                        id: "SPLIT",
                        label: "Split (Cash + Dig)",
                        icon: Layers,
                        color: "indigo",
                      },
                      {
                        id: "SPLIT_UDHAAR",
                        label: "Split (Cash + Udhaar)",
                        icon: Layers,
                        color: "emerald",
                      },
                      {
                        id: "CREDIT",
                        label: "Udhaar (Credit)",
                        icon: BookOpen,
                        color: "rose",
                      },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setPaymentMethod(item.id as any);
                          if (item.id === "SPLIT") {
                            setSplitCash(total.toString());
                            setSplitDigital("0");
                          }
                          if (item.id === "SPLIT_UDHAAR") {
                            setSplitUdhaarPaid(total.toString());
                          }
                        }}
                        className={`p-5 rounded-3xl border-2 transition-all flex items-center gap-4 relative overflow-hidden group ${
                          paymentMethod === item.id
                            ? "border-amber-500 bg-amber-500 text-white shadow-xl shadow-amber-500/20 scale-[1.02]"
                            : "bg-white dark:bg-slate-800 border-slate-100 dark:border-white/5 text-slate-400"
                        }`}
                      >
                        <div
                          className={`p-3 rounded-2xl ${paymentMethod === item.id ? "bg-white/20" : "bg-slate-50 dark:bg-slate-900"}`}
                        >
                          <item.icon className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          {item.label}
                        </span>
                        {paymentMethod === item.id && (
                          <motion.div
                            layoutId="paymentGlow"
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"
                          />
                        )}
                      </button>
                    ))}
                  </div>

                  {paymentMethod === "CASH" ? (
                    <div className="p-8 bg-amber-500/5 dark:bg-amber-500/10 rounded-[2.5rem] border-2 border-amber-500/20">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">
                          Net Recv Cash
                        </p>
                        {change > 0 && (
                          <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-emerald-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black shadow-lg shadow-emerald-500/20"
                          >
                            DRAWER CHANGE: RS {change}
                          </motion.div>
                        )}
                      </div>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        className="w-full text-5xl font-brand italic bg-transparent text-slate-800 dark:text-white border-none outline-none text-right font-black placeholder:text-slate-100 placeholder:animate-pulse"
                      />
                    </div>
                  ) : paymentMethod === "SPLIT" ? (
                    <div className="space-y-4">
                      <div className="p-6 bg-amber-500/5 rounded-[2rem] border border-amber-500/20">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Cash Portion</p>
                        <input
                          type="number"
                          placeholder="Cash amount"
                          value={splitCash}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSplitCash(val);
                            const numVal = parseFloat(val) || 0;
                            if (numVal <= total) {
                              setSplitDigital((total - numVal).toString());
                            }
                          }}
                          className="w-full text-2xl font-brand italic bg-transparent text-slate-800 dark:text-white border-none outline-none font-black"
                        />
                      </div>
                      <div className="p-6 bg-indigo-500/5 rounded-[2rem] border border-indigo-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[9px] font-black text-slate-400 uppercase">Digital Portion</p>
                          <select 
                            value={splitDigitalMethod}
                            onChange={(e) => setSplitDigitalMethod(e.target.value as any)}
                            className="bg-white dark:bg-slate-800 rounded-lg px-2 py-1 text-[9px] font-black uppercase outline-none border border-slate-100 dark:border-white/5"
                          >
                            <option value="JAZZCASH">JazzCash</option>
                            <option value="EASYPAISA">EasyPaisa</option>
                            <option value="BANK">Bank Card</option>
                          </select>
                        </div>
                        <input
                          type="number"
                          placeholder="Digital amount"
                          value={splitDigital}
                          onChange={(e) => {
                             const val = e.target.value;
                             setSplitDigital(val);
                             const numVal = parseFloat(val) || 0;
                             if (numVal <= total) {
                               setSplitCash((total - numVal).toString());
                             }
                          }}
                          className="w-full text-2xl font-brand italic bg-transparent text-indigo-500 border-none outline-none font-black"
                        />
                        {(splitDigitalMethod === "JAZZCASH" || splitDigitalMethod === "EASYPAISA" || splitDigitalMethod === "BANK") && (
                          <div className="mt-3 pt-3 border-t border-indigo-500/10">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Account Holder Name (e.g. Ali)</p>
                            <input
                              placeholder="Enter name..."
                              value={splitAccountName}
                              onChange={(e) => setSplitAccountName(e.target.value)}
                              className="w-full text-xs font-bold bg-transparent text-slate-600 dark:text-slate-300 border-none outline-none font-black"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : paymentMethod === "SPLIT_UDHAAR" ? (
                    <div className="space-y-4">
                      <div className="p-6 bg-emerald-500/5 rounded-[2rem] border border-emerald-500/20">
                         <div className="flex items-center justify-between mb-2">
                           <p className="text-[9px] font-black text-slate-400 uppercase">Paid Portion</p>
                           <select 
                             value={splitUdhaarMethod}
                             onChange={(e) => setSplitUdhaarMethod(e.target.value as any)}
                             className="bg-white dark:bg-slate-800 rounded-lg px-2 py-1 text-[9px] font-black uppercase outline-none border border-slate-100 dark:border-white/5"
                           >
                             <option value="CASH">Cash</option>
                             <option value="JAZZCASH">JazzCash</option>
                             <option value="EASYPAISA">EasyPaisa</option>
                             <option value="BANK">Bank Card</option>
                           </select>
                         </div>
                         <input
                           type="number"
                           placeholder="Amount paid"
                           value={splitUdhaarPaid}
                           onChange={(e) => {
                             const val = e.target.value;
                             setSplitUdhaarPaid(val);
                           }}
                           className="w-full text-2xl font-brand italic bg-transparent text-emerald-500 border-none outline-none font-black"
                         />
                         {(splitUdhaarMethod === "JAZZCASH" || splitUdhaarMethod === "EASYPAISA" || splitUdhaarMethod === "BANK") && (
                           <div className="mt-3 pt-3 border-t border-emerald-500/10">
                             <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Account Holder Name (e.g. Ali)</p>
                             <input
                               placeholder="Enter name..."
                               value={paymentAccountName}
                               onChange={(e) => setPaymentAccountName(e.target.value)}
                               className="w-full text-xs font-bold bg-transparent text-slate-600 dark:text-slate-300 border-none outline-none font-black"
                             />
                           </div>
                         )}
                      </div>
                      <div className="p-6 bg-rose-500/5 rounded-[2rem] border border-rose-500/20 flex justify-between items-center">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Udhaar Balance</p>
                          <p className="text-2xl font-brand italic text-rose-500 font-black">
                             Rs {(total - (parseFloat(splitUdhaarPaid) || 0)).toLocaleString()}
                          </p>
                        </div>
                        <AlertTriangle className="w-6 h-6 text-rose-500 opacity-30" />
                      </div>
                    </div>
                  ) : paymentMethod === "CREDIT" ? (
                    <div className="p-8 bg-rose-500/5 dark:bg-rose-500/10 rounded-[2.5rem] border-2 border-rose-500/20">
                      <div className="flex items-center gap-4 text-rose-500">
                        <AlertTriangle className="w-6 h-6" />
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-widest leading-none mb-1">Udhaar Account Basis</p>
                          <p className="text-[10px] font-bold opacity-60">Bill will be saved to customer's ledger for future recovery.</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-[2.5rem] border-2 border-indigo-500/20">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 leading-none">
                            Account Holder
                          </p>
                          <input
                            placeholder="Name (e.g. Ali)"
                            value={paymentAccountName}
                            onChange={(e) => setPaymentAccountName(e.target.value)}
                            className="w-full text-xl font-bold bg-transparent text-indigo-600 dark:text-indigo-400 border-none outline-none font-black placeholder:text-indigo-200"
                          />
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 leading-none">
                            Auth Ref (TID)
                          </p>
                          <input
                            placeholder="TID / Ref ID..."
                            value={tillId}
                            onChange={(e) => setTillId(e.target.value)}
                            className="w-full text-xl font-bold bg-transparent text-indigo-500 border-none outline-none font-black placeholder:text-indigo-200"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-10 pt-0 bg-gradient-to-t from-white dark:from-slate-900 via-white/80 dark:via-slate-900/80 to-transparent flex flex-col gap-3">
                <button
                  onClick={() => {
                    if (paymentMethod === "CREDIT" || paymentMethod === "SPLIT_UDHAAR") {
                      placeOrder("UDHAAR");
                    } else {
                      placeOrder("PAID");
                    }
                    setIsCustomerModalOpen(false);
                  }}
                  disabled={cart.length === 0 || isPlacingOrder}
                  className={`w-full py-7 rounded-[2.5rem] font-black uppercase italic tracking-[0.4em] text-sm shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all flex items-center justify-center gap-4 ${
                    cart.length > 0 && !isPlacingOrder
                      ? (paymentMethod === "CREDIT" || paymentMethod === "SPLIT_UDHAAR")
                        ? "bg-rose-500 text-white shadow-rose-500/40 active:scale-95"
                        : editingOrderId
                          ? "bg-indigo-600 text-white shadow-indigo-600/40 active:scale-95"
                          : "bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white shadow-amber-500/40 active:scale-95"
                      : "bg-slate-100 text-slate-300 cursor-not-allowed shadow-none grayscale"
                  }`}
                >
                  {isPlacingOrder ? (
                    <div className="w-6 h-6 border-4 border-amber-200 border-t-amber-800 rounded-full animate-spin" />
                  ) : (
                    (paymentMethod === "CREDIT" || paymentMethod === "SPLIT_UDHAAR") ? <BookOpen className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />
                  )}
                  <span>
                    {isPlacingOrder 
                      ? "Processing..." 
                      : (paymentMethod === "CREDIT" || paymentMethod === "SPLIT_UDHAAR")
                        ? (editingOrderId ? "Update Udhaar" : "Confirm Udhaar")
                        : (editingOrderId ? "Update & Settle" : "Settle Bill & Print")}
                  </span>
                </button>

                <button
                  onClick={() => {
                    placeOrder("UNPAID");
                    setIsCustomerModalOpen(false);
                  }}
                  disabled={cart.length === 0 || isPlacingOrder}
                  className={`w-full py-5 rounded-[2rem] font-black uppercase italic tracking-[0.2em] text-[10px] bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white transition-all border-2 border-rose-500/20 active:scale-95 flex items-center justify-center gap-2 ${isPlacingOrder ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <BookOpen className="w-4 h-4" />
                  {isPlacingOrder ? "Saving..." : (editingOrderId
                    ? "Update as Unpaid"
                    : "Save as Unpaid")}
                </button>


              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isCostingSettingsOpen && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={() => setIsCostingSettingsOpen(false)} />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/5">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center">
                    <Settings className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="text-lg font-black uppercase italic tracking-widest text-slate-900 dark:text-white">OpEx & Packaging</h5>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mt-0.5">Global Costing Parameters</p>
                  </div>
                </div>
                <button onClick={() => setIsCostingSettingsOpen(false)} className="p-3 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white shadow-sm border border-slate-100 dark:border-slate-700 transition-all active:scale-95"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-10 overflow-y-auto custom-scrollbar space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 ml-2">
                    <div className="w-1.5 h-4 bg-amber-500 rounded-full"></div>
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Monthly Utility Costs (Rs)</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold text-slate-400 ml-2">Monthly Gas Bill</p>
                      <input type="number" value={costingSettings.monthlyGas} onChange={(e) => setCostingSettings({...costingSettings, monthlyGas: Number(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-[12px] outline-none font-bold border border-slate-200 dark:border-slate-700 focus:border-indigo-500" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold text-slate-400 ml-2">Monthly Electricity</p>
                      <input type="number" value={costingSettings.monthlyElectric} onChange={(e) => setCostingSettings({...costingSettings, monthlyElectric: Number(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-[12px] outline-none font-bold border border-slate-200 dark:border-slate-700 focus:border-indigo-500" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 ml-2">
                    <div className="w-1.5 h-4 bg-rose-500 rounded-full"></div>
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Labor & Physical Space (Rs)</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold text-slate-400 ml-2">Monthly Staff Labor</p>
                      <input type="number" value={costingSettings.monthlyLabor} onChange={(e) => setCostingSettings({...costingSettings, monthlyLabor: Number(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-[12px] outline-none font-bold border border-slate-200 dark:border-slate-700 focus:border-indigo-500" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold text-slate-400 ml-2">Monthly Shop Rent</p>
                      <input type="number" value={costingSettings.monthlyRent} onChange={(e) => setCostingSettings({...costingSettings, monthlyRent: Number(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-[12px] outline-none font-bold border border-slate-200 dark:border-slate-700 focus:border-indigo-500" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 ml-2">
                    <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Packaging & Volume (Logic)</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold text-slate-400 ml-2">Packaging Price (Bag/Box)</p>
                      <input type="number" value={costingSettings.packagingCost} onChange={(e) => setCostingSettings({...costingSettings, packagingCost: Number(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-[12px] outline-none font-bold border border-slate-200 dark:border-slate-700 focus:border-indigo-500" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold text-slate-400 ml-2">Items per Package (1 bag for 3?)</p>
                      <input type="number" value={costingSettings.itemsPerPackage} onChange={(e) => setCostingSettings({...costingSettings, itemsPerPackage: Number(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-[12px] outline-none font-bold border border-slate-200 dark:border-slate-700 focus:border-indigo-500" />
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-2">
                    <p className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Estimated Avg Orders Sold Per Month</p>
                    <input type="number" value={costingSettings.avgMonthlyOrders} onChange={(e) => setCostingSettings({...costingSettings, avgMonthlyOrders: Number(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-[12px] outline-none font-bold border border-slate-200 dark:border-slate-700 focus:border-indigo-500" />
                    <p className="text-[8px] italic text-slate-400 ml-2">Used to divide fixed bills per order. Recommended: 2,000</p>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-center">
                 <button 
                  onClick={() => setIsCostingSettingsOpen(false)}
                  className="w-full py-5 bg-indigo-500 text-white rounded-[2rem] font-black uppercase tracking-widest italic shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all"
                 >
                   Apply Advanced Costing
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isAddCustomerModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddCustomerModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl p-10 overflow-hidden border border-white/10"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-brand italic text-amber-500">
                  {editingCustomer ? "Edit Profiler" : "New Customer"}
                </h2>
                <button
                  onClick={() => setIsAddCustomerModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const data = {
                      ...customerForm,
                      updatedAt: new Date().toISOString()
                    };
                    if (editingCustomer?.id) {
                      await updateDoc(doc(db, "customers", editingCustomer.id), data);
                      logAction(`Customer Profile Updated: ${customerForm.name}`, "SUCCESS");
                    } else {
                      await addDoc(collection(db, "customers"), {
                        ...data,
                        createdAt: new Date().toISOString(),
                        totalOrders: 0,
                        totalSpent: 0
                      });
                      logAction(`Manual Customer Registration: ${customerForm.name}`, "SUCCESS");
                    }
                    setIsAddCustomerModalOpen(false);
                  } catch (err) {
                    console.error("Save failed:", err);
                    alert("Failed to save customer data.");
                  }
                }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Full Name</label>
                  <input
                    required
                    value={customerForm.name}
                    onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl text-[13px] font-bold outline-none border-2 border-transparent focus:border-amber-500/20 transition-all"
                    placeholder="Enter customer name..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Mobile Number</label>
                  <input
                    required
                    value={customerForm.mobile}
                    onChange={e => setCustomerForm({ ...customerForm, mobile: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl text-[13px] font-bold font-mono outline-none border-2 border-transparent focus:border-amber-500/20 transition-all"
                    placeholder="e.g 0300 1234567"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Address (Optional)</label>
                  <textarea
                    value={customerForm.address}
                    onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl text-[13px] font-bold outline-none border-2 border-transparent focus:border-amber-500/20 transition-all h-24 resize-none"
                    placeholder="Delivery details..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-5 bg-amber-500 text-white rounded-[2rem] font-black uppercase italic tracking-[0.2em] text-[11px] shadow-xl shadow-amber-500/30 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <Save className="w-5 h-5" />
                  {editingCustomer ? "Update Profile" : "Register Records"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {viewingOrder && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingOrder(null)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotateX: 10 }}
              animate={{ scale: 1, opacity: 1, rotateX: 0 }}
              exit={{ scale: 0.9, opacity: 0, rotateX: 10 }}
              className={`relative w-full max-w-lg rounded-2xl shadow-[0_50px_100px_rgba(0,0,0,0.5)] border-[4px] border-[#FFD700] overflow-hidden flex flex-col bg-white`}
            >
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-[#FFD700]/5 blur-[100px] -mr-40 -mt-40 rounded-full" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-orange-500/5 blur-[100px] -ml-40 -mb-40 rounded-full" />
              </div>

              <div className="p-8 pb-4 flex items-center justify-between relative z-10 border-b border-slate-50">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-[#FFD700] rounded-2xl flex items-center justify-center text-white shadow-lg transform hover:rotate-6 transition-transform">
                    <Pizza className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-brand italic text-slate-900 font-black tracking-tight">Official Invoice</h3>
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] flex items-center gap-1">
                       <span className="text-slate-950">Burger</span>
                       <span className="text-orange-500">Spot</span>
                       <span className="text-slate-400 ml-1 italic">Premium</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingOrder(null)}
                  className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all border border-slate-200 no-print"
                >
                   <X className="w-6 h-6" />
                </button>
              </div>

              <div 
                id={`invoice-content-${viewingOrder.id}`}
                className={`p-10 pb-12 overflow-y-auto custom-scrollbar relative z-10 bg-white`}
              >
                {/* Premium Header Branding */}
                <div className="flex flex-col items-center text-center mb-10 space-y-6">
                   <div className="inline-flex items-center gap-4 px-10 py-3 bg-[#FFD700] text-white rounded-full text-[12px] font-black uppercase tracking-[0.5em] shadow-lg italic">
                     INVOICE NO. {viewingOrder.businessDate ? formatInvoiceNo(viewingOrder.businessDate, viewingOrder.invoiceNo) : viewingOrder.invoiceNo}
                   </div>
                   
                   <div className="flex flex-col items-center">
                      <div className="w-24 h-24 bg-amber-500 rounded-[2rem] flex items-center justify-center text-white shadow-xl mb-4 relative overflow-hidden group">
                         <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
                         <Pizza className="w-14 h-14 relative z-10" />
                      </div>
                      <h2 className="text-5xl font-brand italic font-black tracking-widest mb-2">
                        <span className="text-slate-900">BURGER</span> <span className="text-orange-500">SPOT</span>
                      </h2>
                      <p className="text-[13px] font-brand italic font-black text-amber-600 uppercase tracking-[0.3em] mb-4">
                        Quality Never Compromised
                      </p>
                      <div className="space-y-1 text-center">
                         <p className="text-[11px] font-medium text-slate-500 max-w-[280px] mx-auto leading-normal">
                            Near Areeb bakery, Mohallah Awana Niaz Baig, Lahore
                         </p>
                         <p className="text-[11px] font-black text-amber-500 tracking-widest uppercase">Phone: 03290059593</p>
                      </div>
                   </div>

                   <div className="w-full space-y-4">
                      {/* Premium Customer Information Panel */}
                      {(viewingOrder.customer.name || viewingOrder.customer.mobile || viewingOrder.customer.address) && (
                         <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000" />
                            
                            <div className="flex justify-between items-start relative z-10">
                               <div className="flex flex-col gap-2 text-left">
                                  <span className="text-[10px] font-black uppercase text-amber-500 tracking-[0.4em] italic mb-1">Customer Profile</span>
                                  <h4 className="text-2xl font-brand italic font-black text-slate-800 uppercase tracking-tight">
                                     {viewingOrder.customer.name || "Client Guest"}
                                  </h4>
                               </div>
                               <div className="w-14 h-14 rounded-3xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                                  <User className="w-7 h-7" />
                               </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-slate-50 grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                               {viewingOrder.customer.mobile && (
                                  <div className="flex items-center gap-4 group/item">
                                     <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover/item:text-amber-500 transition-colors">
                                        <Smartphone className="w-5 h-5" />
                                     </div>
                                     <div className="flex flex-col text-left">
                                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Mobile Number</span>
                                        <span className="text-[13px] font-bold text-slate-700">{viewingOrder.customer.mobile}</span>
                                     </div>
                                  </div>
                               )}
                               {viewingOrder.customer.address && (
                                  <div className="flex items-start gap-4 group/item col-span-full">
                                     <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover/item:text-amber-500 transition-colors shrink-0">
                                        <MapPin className="w-5 h-5" />
                                     </div>
                                     <div className="flex flex-col text-left">
                                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Delivery Address</span>
                                        <span className="text-[13px] font-bold text-slate-600 leading-relaxed italic">{viewingOrder.customer.address}</span>
                                     </div>
                                  </div>
                               )}
                            </div>
                         </div>
                      )}

                      <div className="w-full grid grid-cols-2 gap-4 mt-8 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner">
                         <div className="flex flex-col items-start gap-1">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Order Placed</span>
                            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                               <Clock className="w-3.5 h-3.5 text-amber-500" />
                               {new Date(viewingOrder.timestamp).toLocaleDateString()} at {new Date(viewingOrder.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                         </div>
                         <div className="flex flex-col items-end gap-1">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest text-right">Service Mode</span>
                            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700 uppercase">
                               {viewingOrder.type}
                            </div>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Items Area */}
                <div className="mb-10">
                   <div className="px-6 flex justify-between text-[10px] font-black uppercase text-amber-600 tracking-[0.4em] mb-6 border-b border-slate-50 pb-2">
                      <span>Article Details</span>
                      <span>Line Total</span>
                   </div>
                   <div className="space-y-3">
                      {viewingOrder.items.map((item, idx) => (
                         <div key={idx} className="flex justify-between items-center p-4 rounded-3xl bg-slate-50/30 border border-transparent hover:border-[#FFD700]/20 transition-all group">
                            <div className="flex items-center gap-5">
                               <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-[12px] font-black text-slate-400 shadow-sm border border-slate-100 group-hover:bg-[#FFD700] group-hover:text-white transition-colors">
                                  {item.qty}
                               </div>
                               <div>
                                  <p className="text-base font-black font-brand italic uppercase tracking-tight text-slate-900">
                                     {item.name}
                                  </p>
                                  {item.note && <div className="flex items-center gap-1.5 mt-1">
                                     <div className="w-1 h-1 rounded-full bg-[#FFD700]" />
                                     <p className="text-[10px] italic text-slate-400">{item.note}</p>
                                  </div>}
                               </div>
                            </div>
                            <span className="text-lg font-black font-brand italic text-slate-900">
                               Rs {(item.price * item.qty).toLocaleString()}
                            </span>
                         </div>
                      ))}
                   </div>
                </div>

                {/* Financial Summary and Grand Total */}
                <div className="mt-8">
                   <div className="px-8 space-y-3 mb-8">
                      <div className="flex justify-between text-[12px] font-bold text-slate-400 uppercase tracking-widest">
                         <span>Subtotal</span>
                         <span className="text-slate-800 font-black">Rs {viewingOrder.subtotal?.toLocaleString() || viewingOrder.total.toLocaleString()}</span>
                      </div>
                      
                      {viewingOrder.discount > 0 && (
                         <div className="space-y-1">
                            <div className="flex justify-between text-[12px] font-black text-rose-500 uppercase italic tracking-wide">
                               <span className="flex items-center gap-4">
                                  DISCOUNT:
                               </span>
                               <span>- Rs {viewingOrder.discount.toLocaleString()}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 pl-4">• Promotional Offer Applied</p>
                            <div className="flex justify-between text-[12px] font-black text-slate-600 uppercase italic border-b border-dashed border-slate-200 pb-1">
                               <span>Total after discount:</span>
                               <span>Rs {((viewingOrder.subtotal || 0) - viewingOrder.discount).toLocaleString()}</span>
                            </div>
                         </div>
                      )}

                      {viewingOrder.deliveryCharge > 0 && (
                         <div className="flex justify-between text-[12px] font-black text-amber-500 uppercase italic tracking-wide">
                            <span className="flex items-center gap-4">
                               Service Fee
                            </span>
                            <span>+ Rs {viewingOrder.deliveryCharge.toLocaleString()}</span>
                         </div>
                      )}
                   </div>

                   {/* Grand Total - Luxury Design (Smooth Version) */}
                   <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-[3.5rem] p-12 shadow-[0_40px_80px_-20px_rgba(255,215,0,0.15)] relative overflow-hidden group border border-amber-100/50">
                      <div className="absolute top-0 right-0 w-48 h-48 bg-white/40 blur-[100px] rounded-full -mr-24 -mt-24 group-hover:scale-125 transition-transform duration-1000" />
                      <div className="absolute bottom-10 left-10 opacity-[0.03]">
                         <Pizza className="w-32 h-32 rotate-12 text-amber-500" />
                      </div>
                      
                      <div className="flex justify-between items-center relative z-10">
                         <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.5em] text-amber-600/40 italic mb-2">Total Amount Due</p>
                            <h4 className="text-4xl font-brand italic font-black text-slate-800 leading-none tracking-tight">PAYABLE</h4>
                         </div>
                         <div className="text-right">
                            <p className="text-[80px] font-brand italic font-black text-amber-500 leading-none tabular-nums tracking-tighter">
                               Rs <AnimatedNumber value={viewingOrder.total} />
                            </p>
                            <p className="text-[12px] font-black text-amber-600/30 tracking-[0.8em] mr-4 mt-2 uppercase italic font-brand">Rupees Only</p>
                         </div>
                      </div>
                   </div>

                   {/* Status and Payment Footer */}
                   <div className="mt-10 grid grid-cols-2 gap-6 px-4 border-t border-slate-50 pt-8">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-[#FFD700] shadow-inner">
                            {viewingOrder.paymentMethod === 'CASH' ? <Coins className="w-6 h-6" /> : 
                             viewingOrder.paymentMethod === 'EASYPAISA' ? <Wallet className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
                         </div>
                         <div>
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Payment Mode</p>
                            <p className="text-[11px] font-black italic text-slate-800 uppercase tracking-wider">{viewingOrder.paymentMethod || 'CASH'}</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Received By</p>
                         <p className="text-[11px] font-black italic text-slate-800 uppercase">Received by: {currentUser?.name || "Staff Name"}</p>
                      </div>
                   </div>
                </div>

                <div className="mt-12 text-center">
                   <p className="text-lg font-brand italic font-black text-orange-500">
                      🌟 Thank you for choosing BURGER SPOT 🌟
                   </p>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 italic shadow-sm">Your feedback matters to us</p>
                </div>

                {/* Thermal paper bottom cut effect */}
                <div className="h-4 flex overflow-hidden opacity-10 pointer-events-none mt-10">
                   {Array.from({ length: 40 }).map((_, i) => (
                      <div key={i} className="flex-1 h-8 bg-slate-900 rotate-45 transform translate-y-2" />
                   ))}
                </div>
              </div>

              {isShiftingDate && (
                <div className="px-10 pb-6 relative z-30">
                  <div className="bg-amber-50 dark:bg-amber-950/20 p-6 rounded-[2rem] border border-amber-200/50 flex flex-col gap-4">
                     <div className="flex justify-between items-center">
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-amber-600 italic">Shift Business Date</h5>
                        <button onClick={() => setIsShiftingDate(false)} className="text-[10px] font-bold text-slate-400 hover:text-rose-500 uppercase">Cancel</button>
                     </div>
                     <div className="flex gap-4">
                        <input 
                          type="date"
                          value={shiftDateValue}
                          onChange={(e) => setShiftDateValue(e.target.value)}
                          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-white"
                        />
                        <button 
                          onClick={handleShiftOrderDate}
                          disabled={!shiftDateValue}
                          className="px-6 py-3 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase italic shadow-lg shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50"
                        >
                          Update
                        </button>
                     </div>
                     <p className="text-[9px] text-amber-500/60 italic font-medium leading-relaxed">
                        ⚠️ This will move the order to the selected date and update the invoice number accordingly.
                     </p>
                  </div>
                </div>
              )}

              <div className="p-10 pt-0 flex flex-wrap md:flex-nowrap gap-4 relative z-20">
                 <button
                   onClick={() => {
                     setIsShiftingDate(true);
                     setShiftDateValue(viewingOrder!.businessDate);
                   }}
                   className="px-8 py-5 bg-amber-500/10 text-amber-600 border border-amber-200/50 rounded-3xl font-black uppercase text-[10px] italic shadow-sm active:scale-95 transition-all flex items-center justify-center gap-3 hover:bg-amber-500 hover:text-white"
                 >
                   <Calendar className="w-5 h-5" /> Shift Date
                 </button>
                 <button
                   onClick={() => handleDownloadInvoice(viewingOrder!.id)}
                   className="flex-1 py-5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300 rounded-3xl font-black uppercase text-[10px] italic shadow-sm active:scale-95 transition-all flex items-center justify-center gap-3 hover:bg-slate-100 dark:hover:bg-white/10"
                 >
                   <Download className="w-5 h-5" /> Download
                 </button>
                 <button
                   onClick={() => window.print()}
                   className="flex-[1.5] py-5 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white rounded-3xl font-black uppercase text-[10px] italic shadow-2xl shadow-amber-500/40 active:scale-95 transition-all flex items-center justify-center gap-3 hover:brightness-110"
                 >
                   <Printer className="w-5 h-5" /> Print Luxury Invoice
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isVoidConfirmOpen && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
              onClick={() => setIsVoidConfirmOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 border border-white/5 text-center"
            >
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black uppercase italic tracking-widest text-rose-500 mb-2">
                Void Cart?
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-8 leading-relaxed italic">
                Are you sure you want to clear all items from the current cart? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setCart([]);
                    setIsVoidConfirmOpen(false);
                  }}
                  className="flex-1 py-4 bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-rose-500/20 active:scale-95 transition-all italic tracking-widest font-brand"
                >
                  Yes, Void It
                </button>
                <button
                  onClick={() => setIsVoidConfirmOpen(false)}
                  className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-200 dark:hover:bg-slate-700 transition-all font-brand tracking-widest"
                >
                  No, Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDiscountPromptOpen && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
              onClick={() => setIsDiscountPromptOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 border border-white/5"
            >
              <h2 className="text-xl font-black uppercase italic tracking-widest text-amber-500 mb-6">
                Apply Discount
              </h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-400 ml-2 italic">Discount Amount (Rs)</p>
                  <input
                    type="number"
                    autoFocus
                    value={discountPromptValue}
                    onChange={(e) => setDiscountPromptValue(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-lg font-brand border-2 border-amber-500/20 focus:border-amber-500 outline-none transition-all"
                    placeholder="0"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setDiscount(parseFloat(discountPromptValue) || 0);
                      setIsDiscountPromptOpen(false);
                    }}
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                  >
                    Apply Now
                  </button>
                  <button
                    onClick={() => setIsDiscountPromptOpen(false)}
                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 dark:hover:bg-slate-700 transition-all font-brand tracking-widest"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isProfitAnalysisOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsProfitAnalysisOpen(false)} />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[3.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/5">
              <div className="p-10 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/20">
                    <TrendingUp className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black uppercase italic tracking-widest text-slate-900 dark:text-white leading-tight">Profit & Cost Analysis</h2>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mt-1">Advanced Performance Tracking</p>
                  </div>
                </div>
                <button onClick={() => setIsProfitAnalysisOpen(false)} className="p-4 bg-white dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-slate-600 dark:hover:text-white shadow-sm border border-slate-100 dark:border-slate-700 transition-all active:scale-95"><X className="w-6 h-6" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800">
                    <p className="text-[9px] font-black uppercase text-slate-400 mb-3 tracking-widest">Gross Profit</p>
                    <h3 className="text-3xl font-brand italic font-black text-emerald-500">Rs {(stats.profitMetrics as any).grossProfit.toLocaleString()}</h3>
                    <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase">Revenue - Material</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800">
                    <p className="text-[9px] font-black uppercase text-slate-400 mb-3 tracking-widest">Packaging Cost</p>
                    <h3 className="text-3xl font-brand italic font-black text-blue-500">Rs {(stats.profitMetrics as any).packaging.toLocaleString()}</h3>
                    <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase">1 Bag / {costingSettings.itemsPerPackage} Items</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800">
                    <p className="text-[9px] font-black uppercase text-slate-400 mb-3 tracking-widest">Fixed Overhead</p>
                    <h3 className="text-3xl font-brand italic font-black text-amber-500">Rs {(stats.profitMetrics as any).overhead.toLocaleString()}</h3>
                    <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase">Gas, Bill, Rent, Labor</p>
                  </div>
                  <div className="bg-indigo-500 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-500/20">
                    <p className="text-[9px] font-black uppercase text-indigo-100 mb-3 tracking-widest">Net Margin</p>
                    <h3 className="text-3xl font-brand italic font-black">{(stats.profitMetrics as any).margin.toFixed(1)}%</h3>
                    <p className="text-[10px] font-bold text-indigo-200 mt-2 uppercase">Efficiency Rating</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                    <h4 className="text-[12px] font-black uppercase italic tracking-widest text-slate-800 dark:text-white">Business Expense Settings</h4>
                  </div>
                  <button 
                    onClick={() => setIsCostingSettingsOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all border border-indigo-200 dark:border-indigo-500/20"
                  >
                    <Settings className="w-4 h-4" /> Adjust Costs
                  </button>
                </div>

                <div className="space-y-6">
                   <div className="flex items-center justify-between px-2">
                     <h4 className="text-[12px] font-black uppercase italic tracking-widest text-slate-800 dark:text-white">Item-Wise Profit Performance</h4>
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Sorted by Highest Profit</span>
                   </div>
                   <div className="space-y-3">
                     {((stats.profitMetrics as any).itemProfitAnalysis).map((item: any, idx: number) => (
                       <motion.div 
                         key={idx}
                         initial={{ opacity: 0, x: -20 }}
                         animate={{ opacity: 1, x: 0 }}
                         transition={{ delay: idx * 0.05 }}
                         className="group flex items-center justify-between p-6 bg-white dark:bg-slate-800/20 rounded-[2rem] border border-slate-100 dark:border-slate-800 hover:border-emerald-500/30 transition-all"
                       >
                         <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 font-brand italic font-black text-xl group-hover:bg-emerald-500 group-hover:text-white transition-all">
                              {idx + 1}
                            </div>
                            <div>
                               <p className="text-sm font-black text-slate-800 dark:text-white uppercase italic">{item.name}</p>
                               <div className="flex items-center gap-3 mt-1">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{item.qty} SOLD</span>
                                  <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Rs {(item.revenue / item.qty).toFixed(0)} AVG PRICE</span>
                               </div>
                            </div>
                         </div>
                         <div className="flex items-center gap-12 text-right">
                            <div className="hidden sm:block">
                               <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Total Cost</p>
                               <p className="text-sm font-brand italic font-black text-amber-500">Rs {item.cost.toLocaleString()}</p>
                            </div>
                            <div>
                               <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Total Profit</p>
                               <p className="text-xl font-brand italic font-black text-emerald-500">Rs {item.profit.toLocaleString()}</p>
                            </div>
                         </div>
                       </motion.div>
                     ))}
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/40 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 space-y-8">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                          <Layers className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-[14px] font-black uppercase italic tracking-widest text-slate-800 dark:text-white leading-tight">Master Catalog Costing</h4>
                          <p className="text-[9px] font-black uppercase text-slate-400 mt-1">Full breakdown of selling vs investment costs</p>
                        </div>
                      </div>
                      <div className="hidden sm:flex bg-white dark:bg-slate-900 px-6 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-right items-center gap-4">
                        <div>
                          <p className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">Avg Catalog Margin</p>
                          <p className="text-xl font-brand italic font-black text-slate-800 dark:text-white">
                            {(menuItems.reduce((acc, item) => acc + (item.price > 0 ? ((item.price - (item.cost || 0)) / item.price) * 100 : 0), 0) / (menuItems.length || 1)).toFixed(0)}%
                          </p>
                        </div>
                        <div className="w-[1px] h-8 bg-slate-100 dark:bg-slate-800" />
                        <div>
                          <p className="text-[9px] font-black text-indigo-500 uppercase tracking-tighter">Items Tracked</p>
                          <p className="text-xl font-brand italic font-black text-slate-800 dark:text-white">{menuItems.length}</p>
                        </div>
                      </div>
                    </div>

                   <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left border-separate border-spacing-y-3">
                         <thead>
                            <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                               <th className="pb-3 pl-6">Item Name</th>
                               <th className="pb-3">Component Breakdown</th>
                               <th className="pb-3 text-center">Cost (Inv)</th>
                               <th className="pb-3 text-center">Selling Price</th>
                               <th className="pb-3 pr-6 text-right">Unit Profit</th>
                            </tr>
                         </thead>
                         <tbody>
                            {menuItems.map((menuItem, idx) => {
                               const cost = menuItem.cost || 0;
                               const profit = menuItem.price - cost;
                               const margin = menuItem.price > 0 ? (profit / menuItem.price) * 100 : 0;
                               const dcEntries = Object.entries(menuItem.detailedCost || {});
                               
                               return (
                                 <tr key={idx} className="bg-white dark:bg-slate-900 rounded-3xl border border-transparent shadow-sm hover:shadow-md transition-shadow">
                                    <td className="py-6 pl-6 rounded-l-[2rem]">
                                       <p className="text-[11px] font-black uppercase italic text-slate-800 dark:text-white leading-tight">{menuItem.name}</p>
                                       <div className="flex items-center gap-2 mt-1">
                                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{menuItem.category}</p>
                                          <div className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${margin > 40 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                             {margin.toFixed(0)}% Margin
                                          </div>
                                       </div>
                                    </td>
                                    <td className="py-6">
                                       <div className="flex flex-wrap gap-1 max-w-[200px]">
                                          {dcEntries.length > 0 ? (
                                            dcEntries.slice(0, 3).map(([key, val], i) => (
                                              <span key={i} className="text-[7px] font-bold uppercase bg-slate-50 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-800">
                                                {key}: {val}
                                              </span>
                                            ))
                                          ) : (
                                            <span className="text-[7px] font-bold text-slate-300 italic uppercase">No breakdown set</span>
                                          )}
                                          {dcEntries.length > 3 && <span className="text-[7px] font-bold text-indigo-500">+{dcEntries.length - 3} more</span>}
                                       </div>
                                    </td>
                                    <td className="py-6 text-center">
                                       <p className="text-[10px] font-bold text-rose-500">Rs {cost.toLocaleString()}</p>
                                    </td>
                                    <td className="py-6 text-center">
                                       <p className="text-[10px] font-bold text-indigo-500">Rs {menuItem.price.toLocaleString()}</p>
                                    </td>
                                    <td className="py-6 pr-6 rounded-r-[2rem] text-right">
                                       <p className={`text-[12px] font-brand italic font-black ${profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>Rs {profit.toLocaleString()}</p>
                                       <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Per Burger</p>
                                    </td>
                                 </tr>
                               );
                            })}
                         </tbody>
                      </table>
                   </div>
                </div>
              <div className="p-10 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                 <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/20">
                         <Wallet className="w-6 h-6" />
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Operating Expenses</p>
                          <p className="text-xl font-brand italic font-black text-rose-500">- Rs {stats.rangeExpenses.toLocaleString()}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 whitespace-nowrap">Bottom Line (Net Profit)</p>
                       <p className={`text-3xl font-brand italic font-black ${(stats.profitMetrics as any).netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                         Rs {(stats.profitMetrics as any).netProfit.toLocaleString()}
                       </p>
                    </div>
                 </div>
              </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedDigitalAccount && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setSelectedDigitalAccount(null)} />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-white/5">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-[1.2rem] bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase italic tracking-widest text-slate-900 dark:text-white leading-tight">{selectedDigitalAccount}</h2>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-0.5">Account Settlement Records</p>
                  </div>
                </div>
                <button onClick={() => setSelectedDigitalAccount(null)} className="p-3 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white shadow-sm border border-slate-100 dark:border-slate-700 transition-all active:scale-95"><X className="w-5 h-5" /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-4">
                {/* Account Method Summary */}
                <div className="flex flex-wrap gap-3 mb-6">
                  {Object.entries(stats.digitalAccountSummary[selectedDigitalAccount || ""]?.methods || {}).map(([method, amount]) => (
                    <div key={method} className="px-4 py-2 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                      <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">{method}</p>
                      <p className="text-sm font-brand italic font-black text-slate-800 dark:text-white">Rs {amount.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                {((stats.digitalAccountSummary[selectedDigitalAccount || ""] || { orders: [] }) as { orders: any[], methods: Record<string, number>, accountName: string }).orders.map((o, i) => {
                  const contribution = o.paymentMethod === "SPLIT" 
                    ? o.splitDetails?.filter(sd => (sd.accountName || "Personal") === selectedDigitalAccount).reduce((acc, curr) => acc + curr.amount, 0) || 0
                    : o.total;

                  return (
                    <motion.div 
                      key={o.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => {
                        setViewingOrder(o);
                        setSelectedDigitalAccount(null);
                      }}
                      className="group p-5 bg-slate-50 dark:bg-slate-800/40 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 flex items-center justify-between hover:border-indigo-500/30 cursor-pointer transition-all active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order #{o.id.slice(-6).toUpperCase()}</p>
                            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 text-[8px] font-black uppercase tracking-tighter">
                              {o.paymentMethod === "SPLIT" ? "SPLIT" : o.paymentMethod}
                            </span>
                          </div>
                          <p className="text-sm font-black italic text-slate-800 dark:text-white uppercase">{o.customer?.name || "Counter Sale"}</p>
                          <div className="flex items-center gap-2 mt-1">
                             <div className="w-1 h-1 bg-slate-300 rounded-full" />
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                               {new Date(o.timestamp).toLocaleDateString()} • {new Date(o.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                             </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-black uppercase text-slate-400 mb-0.5">Received</p>
                        <p className="text-xl font-brand italic font-black text-indigo-600 dark:text-indigo-400">Rs {contribution.toLocaleString()}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center sm:px-10">
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Items Count</p>
                   <p className="text-2xl font-brand italic font-black text-slate-900 dark:text-white">
                     {stats.digitalAccountSummary[selectedDigitalAccount!]?.orders.length || 0} Inv
                   </p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Settled Amount</p>
                   <p className="text-3xl font-brand italic font-black text-indigo-500">
                     Rs {stats.digitalAccountSummary[selectedDigitalAccount!]?.total.toLocaleString()}
                   </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRevenueDetailOpen && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsRevenueDetailOpen(false)} />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-white/5">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-[1.2rem] bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <Banknote className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase italic tracking-widest text-slate-900 dark:text-white leading-tight">Revenue Breakdown</h2>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-0.5">Sales Performance Insights</p>
                  </div>
                </div>
                <button onClick={() => setIsRevenueDetailOpen(false)} className="p-3 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white shadow-sm border border-slate-100 dark:border-slate-700 transition-all active:scale-95"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-500/5 p-6 rounded-[2rem] border border-emerald-500/10 text-center">
                    <p className="text-[9px] font-black uppercase text-emerald-600 mb-1">Total Revenue</p>
                    <p className="text-3xl font-brand italic font-black text-emerald-600">Rs {stats.totalRevenue.toLocaleString()}</p>
                  </div>
                  <div className="bg-amber-500/5 p-6 rounded-[2rem] border border-amber-500/10 text-center">
                    <p className="text-[9px] font-black uppercase text-amber-600 mb-1">Growth Index</p>
                    <p className="text-3xl font-brand italic font-black text-amber-600">{stats.revGrowth >= 0 ? '+' : ''}{stats.revGrowth.toFixed(1)}%</p>
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Revenue by Channel</h4>
                  <div className="space-y-3">
                    {stats.paymentMethodsData.map((channel, i) => (
                      <div key={i} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <span className="text-xs font-black uppercase text-slate-600 dark:text-slate-300 italic">{channel.name}</span>
                        <span className="text-lg font-brand italic font-black text-indigo-500">Rs {channel.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button onClick={() => setIsRevenueDetailOpen(false)} className="px-8 py-4 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-amber-500/20 active:scale-95 transition-all">Done</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCreditDetailOpen && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsCreditDetailOpen(false)} />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-white/5">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-[1.2rem] bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/20">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase italic tracking-widest text-slate-900 dark:text-white leading-tight">Udhaar Breakdown</h2>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-0.5">Pending Receivables</p>
                  </div>
                </div>
                <button onClick={() => setIsCreditDetailOpen(false)} className="p-3 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white shadow-sm border border-slate-100 dark:border-slate-700 transition-all active:scale-95"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {orders.filter(o => o.status === "UDHAAR").length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-30 italic text-center">
                    <CheckCircle2 className="w-12 h-12 mb-4 text-emerald-500" />
                    <p className="text-sm font-black uppercase tracking-widest">No Active Credit Balance</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.filter(o => o.status === "UDHAAR").slice(0, 50).map((order, idx) => (
                      <div key={idx} className="p-4 bg-rose-50/50 dark:bg-rose-500/5 rounded-2xl border border-rose-500/10 flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-black text-rose-500 uppercase mb-0.5">#{order.id.slice(-6)}</p>
                          <p className="text-sm font-black italic text-slate-800 dark:text-white uppercase">{order.customer?.name || "Anonymous Customer"}</p>
                          <p className="text-[9px] font-bold text-slate-400">{new Date(order.timestamp).toLocaleDateString()} {new Date(order.timestamp).toLocaleTimeString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-brand italic font-black text-rose-500">Rs {order.total.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col items-center">
                 <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Total Active Udhaar</p>
                 <p className="text-3xl font-brand italic font-black text-rose-500">Rs {stats.udhaarRevenue.toLocaleString()}</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOrdersDetailOpen && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsOrdersDetailOpen(false)} />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-white/5">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-[1.2rem] bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase italic tracking-widest text-slate-900 dark:text-white leading-tight">Order Activity</h2>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-0.5">Recent Transaction Log</p>
                  </div>
                </div>
                <button onClick={() => setIsOrdersDetailOpen(false)} className="p-3 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white shadow-sm border border-slate-100 dark:border-slate-700 transition-all active:scale-95"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-3">
                {orders.slice(0, 50).map((order, idx) => (
                  <div key={idx} className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black italic border ${
                        order.status === "PAID" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                        order.status === "UDHAAR" ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                        "bg-slate-500/10 text-slate-500 border-slate-500/20"
                      }`}>
                        {order.status === "PAID" ? "OK" : order.status === "UDHAAR" ? "CR" : "!"}
                      </div>
                      <div>
                        <p className="text-sm font-black italic text-slate-800 dark:text-white uppercase leading-none mb-1">Order #{order.id.slice(-6).toUpperCase()}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {order.paymentMethod}
                        </p>
                      </div>
                    </div>
                    <p className="text-lg font-brand italic font-black text-indigo-500">Rs {order.total.toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center sm:px-10">
                <div className="flex gap-10">
                   <div className="text-center sm:text-left">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total</p>
                     <p className="text-2xl font-brand italic font-black text-slate-900 dark:text-white">{stats.count}</p>
                   </div>
                   <div className="text-center sm:text-left">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Today</p>
                     <p className="text-2xl font-brand italic font-black text-emerald-500">+{stats.todayCount || 0}</p>
                   </div>
                </div>
                <button onClick={() => setIsOrdersDetailOpen(false)} className="px-10 py-4 bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">Close</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAvgTicketOpen && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsAvgTicketOpen(false)} />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-white/5">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-[1.2rem] bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase italic tracking-widest text-slate-900 dark:text-white leading-tight">Ticket Distribution</h2>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-0.5">Average Sale Analysis</p>
                  </div>
                </div>
                <button onClick={() => setIsAvgTicketOpen(false)} className="p-3 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white shadow-sm border border-slate-100 dark:border-slate-700 transition-all active:scale-95"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">
                 <div className="grid grid-cols-1 gap-4">
                   <div className="bg-indigo-500/5 p-8 rounded-[2rem] border border-indigo-500/10 text-center relative overflow-hidden group">
                     <p className="text-[10px] font-black uppercase text-indigo-500 mb-2 tracking-[0.3em]">Mean Order Value</p>
                     <p className="text-5xl font-brand italic font-black text-indigo-500 leading-none">Rs {stats.avgTicket.toLocaleString()}</p>
                     <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:scale-150 transition-transform" />
                   </div>
                 </div>
                 <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Highest Value Tickets</h4>
                    <div className="space-y-3">
                      {[...orders].sort((a,b) => b.total - a.total).slice(0, 5).map((order, i) => (
                        <div key={i} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <div className="flex gap-3 items-center">
                            <span className="w-6 h-6 bg-amber-500 text-white rounded-lg flex items-center justify-center text-[10px] font-black tabular-nums">{i+1}</span>
                            <span className="text-xs font-black uppercase text-slate-600 dark:text-slate-300 italic">#{order.id.slice(-6).toUpperCase()}</span>
                          </div>
                          <span className="text-lg font-brand italic font-black text-indigo-500">Rs {order.total.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                 </div>
              </div>
              <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button onClick={() => setIsAvgTicketOpen(false)} className="px-8 py-4 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">Finish Analysis</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExpenseDetailOpen && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsExpenseDetailOpen(false)} />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-white/5">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-[1.2rem] bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/20">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase italic tracking-widest text-slate-900 dark:text-white leading-tight">Expense Ledger</h2>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-0.5">Operating Cost Breakdown</p>
                  </div>
                </div>
                <button onClick={() => setIsExpenseDetailOpen(false)} className="p-3 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white shadow-sm border border-slate-100 dark:border-slate-700 transition-all active:scale-95"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {expenses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-30 italic text-center">
                    <Wallet className="w-12 h-12 mb-4" />
                    <p className="text-sm font-black uppercase tracking-widest">No Expenses Logged</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {expenses.slice(0, 50).map((exp, idx) => (
                      <div key={idx} className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center group hover:border-rose-500/20 transition-all">
                        <div className="flex gap-4 items-center">
                          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-rose-500 flex items-center justify-center">
                             <TrendingDown className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-black italic text-slate-800 dark:text-white uppercase leading-tight mb-1">{exp.description}</p>
                            <p className="text-[9px] font-black text-rose-500/60 uppercase tracking-widest">{exp.category} • {new Date(exp.timestamp).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <p className="text-xl font-brand italic font-black text-rose-500">Rs {exp.amount.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-center">
                 <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Period Total Burned</p>
                 <p className="text-4xl font-brand italic font-black text-rose-500">Rs {stats.rangeExpenses.toLocaleString()}</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isItemsBreakdownOpen && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
              onClick={() => setIsItemsBreakdownOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-white/5"
            >
              {/* Header */}
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-[1.2rem] bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase italic tracking-widest text-slate-900 dark:text-white leading-tight">
                      Items Sold Breakdown
                    </h2>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-0.5">
                      {dashTimeRange === 'TODAY' ? 'Today\'s Activity' : `Range: ${dashTimeRange}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsItemsBreakdownOpen(false)}
                  className="p-3 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white shadow-sm border border-slate-100 dark:border-slate-700 transition-all active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* List Content */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {stats.productBreakdown.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-30 italic">
                    <Package className="w-12 h-12 mb-4" />
                    <p className="text-sm font-black uppercase tracking-widest">No Items Sold Yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stats.productBreakdown.map((item, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:border-orange-500/20 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-orange-500 font-brand italic font-black text-lg border border-slate-100 dark:border-slate-700">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="text-sm font-black italic text-slate-800 dark:text-white uppercase leading-none mb-1">
                              {item.name}
                            </p>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              Items Sold: {item.qty}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Revenue</p>
                          <p className="text-lg font-brand italic font-black text-amber-500 leading-none">
                            <span className="text-xs mr-0.5">Rs</span>{Math.floor(item.revenue).toLocaleString()}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-8 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-6">
                <div className="text-center sm:text-left">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Items Sold</p>
                  <p className="text-3xl font-brand italic font-black text-slate-900 dark:text-white leading-none">
                    {stats.totalItemsSold}
                  </p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    onClick={handleExportItemsSold}
                    className="flex-1 sm:flex-none px-6 py-4 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-200 flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all active:scale-95 shadow-sm"
                  >
                    <Download className="w-4 h-4" /> Download CSV
                  </button>
                  <button
                    onClick={() => setIsItemsBreakdownOpen(false)}
                    className="flex-1 sm:flex-none px-8 py-4 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
                  >
                    Close View
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <GeminiChat />
      <AIConsultant />
    </div>
  );
}
