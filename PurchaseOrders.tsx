import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  Plus, 
  Search, 
  Truck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  ArrowLeft,
  Calendar,
  DollarSign,
  Briefcase,
  Layers,
  ChevronRight,
  Eye,
  Check,
  AlertCircle
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp,
  increment,
  writeBatch
} from 'firebase/firestore';
import { db } from '../src/lib/firebase';
import { PurchaseOrder, Supplier, POStatus, POPaymentStatus, InventoryItem } from '../types';
import Button from './Button';

interface PurchaseOrdersProps {
  inventory: InventoryItem[];
  logAction: (action: string, status?: 'SUCCESS' | 'WARNING' | 'ERROR', details?: string) => void;
}

const PurchaseOrders: React.FC<PurchaseOrdersProps> = ({ inventory, logAction }) => {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isAddingPO, setIsAddingPO] = useState(false);
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // Form states for new PO
  const [newPO, setNewPO] = useState<{
    supplierId: string;
    items: { itemId: string; name: string; qty: number; costPrice: number; unit: string }[];
    notes: string;
  }>({
    supplierId: '',
    items: [],
    notes: ''
  });

  // Form states for new Supplier
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    mobile: '',
    address: '',
    category: ''
  });

  useEffect(() => {
    const unsubPOs = onSnapshot(query(collection(db, 'purchase_orders'), orderBy('orderDate', 'desc')), (snapshot) => {
      setPos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder)));
    });

    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    });

    return () => {
      unsubPOs();
      unsubSuppliers();
    };
  }, []);

  const handleAddSupplier = async () => {
    if (!newSupplier.name || !newSupplier.mobile) return;
    try {
      await addDoc(collection(db, 'suppliers'), {
        ...newSupplier,
        totalDue: 0
      });
      setIsAddingSupplier(false);
      setNewSupplier({ name: '', mobile: '', address: '', category: '' });
      logAction(`Supplier Added: ${newSupplier.name}`, 'SUCCESS');
    } catch (error) {
      logAction('Error adding supplier', 'ERROR');
    }
  };

  const handleCreatePO = async () => {
    if (!newPO.supplierId || newPO.items.length === 0) return;

    const supplier = suppliers.find(s => s.id === newPO.supplierId);
    if (!supplier) return;

    const subtotal = newPO.items.reduce((acc, item) => acc + (item.qty * item.costPrice), 0);
    const tax = 0; // Simple for now
    const total = subtotal + tax;

    const poData: Omit<PurchaseOrder, 'id'> = {
      poNumber: `PO-${Date.now().toString().slice(-6)}`,
      supplierId: supplier.id,
      supplierName: supplier.name,
      items: newPO.items.map(it => ({ ...it, total: it.qty * it.costPrice })),
      subtotal,
      tax,
      total,
      status: 'SENT',
      paymentStatus: 'UNPAID',
      amountPaid: 0,
      orderDate: Date.now(),
      notes: newPO.notes
    };

    try {
      await addDoc(collection(db, 'purchase_orders'), poData);
      setIsAddingPO(false);
      setNewPO({ supplierId: '', items: [], notes: '' });
      logAction(`Purchase Order Created: ${poData.poNumber}`, 'SUCCESS');
    } catch (error) {
      logAction('Error creating PO', 'ERROR');
    }
  };

  const handleReceivePO = async (po: PurchaseOrder) => {
    if (po.status === 'RECEIVED') return;

    try {
      const batch = writeBatch(db);

      // Update PO status
      const poRef = doc(db, 'purchase_orders', po.id);
      batch.update(poRef, {
        status: 'RECEIVED',
        receivedDate: Date.now()
      });

      // Update Inventory levels
      po.items.forEach(item => {
        const invRef = doc(db, 'inventory', item.itemId);
        batch.update(invRef, {
          stock: increment(item.qty)
        });
      });

      // Update Supplier total due (if not fully paid)
      if (po.paymentStatus !== 'PAID') {
        const supplierRef = doc(db, 'suppliers', po.supplierId);
        batch.update(supplierRef, {
          totalDue: increment(po.total - po.amountPaid)
        });
      }

      await batch.commit();
      logAction(`PO Received: ${po.poNumber}`, 'SUCCESS', 'Stock updated and due added to supplier');
      setSelectedPO(null);
    } catch (error) {
      logAction('Error receiving PO', 'ERROR');
    }
  };

  const handlePOPayment = async (po: PurchaseOrder, amount: number) => {
    if (amount <= 0 || amount > (po.total - po.amountPaid)) return;

    try {
      const batch = writeBatch(db);
      const newAmountPaid = po.amountPaid + amount;
      const newStatus: POPaymentStatus = newAmountPaid >= po.total ? 'PAID' : 'PARTIAL';

      const poRef = doc(db, 'purchase_orders', po.id);
      batch.update(poRef, {
        amountPaid: newAmountPaid,
        paymentStatus: newStatus
      });

      const supplierRef = doc(db, 'suppliers', po.supplierId);
      batch.update(supplierRef, {
        totalDue: increment(-amount)
      });

      // Also log this as an expense? 
      // For now just keep it in PO module
      await batch.commit();
      logAction(`Payment Made: Rs ${amount} for ${po.poNumber}`, 'SUCCESS');
    } catch (error) {
      logAction('Error making payment', 'ERROR');
    }
  };

  const addItemToPO = (itemId: string) => {
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;

    if (newPO.items.find(i => i.itemId === itemId)) return;

    setNewPO(prev => ({
      ...prev,
      items: [...prev.items, { itemId, name: item.name, qty: 1, costPrice: 0, unit: item.unit }]
    }));
  };

  const updatePOItem = (itemId: string, field: 'qty' | 'costPrice', value: number) => {
    setNewPO(prev => ({
      ...prev,
      items: prev.items.map(it => it.itemId === itemId ? { ...it, [field]: value } : it)
    }));
  };

  const filteredPOs = pos.filter(po => 
    po.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    po.supplierName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="px-8 py-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-800 dark:text-white">
            Inventory <span className="text-indigo-500">Procurement</span>
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-1">
            Purchase Orders & Supplier Management
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              placeholder="Search POs/Suppliers..."
              className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-2xl py-3 pl-12 pr-6 text-sm font-bold w-64 outline-none focus:border-indigo-500/20 transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsAddingSupplier(true)}
            className="p-3 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-2xl text-slate-600 dark:text-slate-400 hover:text-indigo-500 transition-all"
          >
            <Briefcase className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsAddingPO(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase italic text-xs shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Purchase Order
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-8 pb-32 md:pb-8 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPOs.map((po) => (
            <motion.div
              key={po.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelectedPO(po)}
              className="glass-card p-6 rounded-[2.5rem] border border-slate-100 dark:border-white/5 cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="p-4 bg-indigo-500/10 rounded-2xl group-hover:scale-110 transition-transform">
                  <Package className="w-6 h-6 text-indigo-500" />
                </div>
                <div className="text-right">
                  <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest mb-1 ${
                    po.status === 'RECEIVED' ? 'bg-emerald-100 text-emerald-600' :
                    po.status === 'CANCELLED' ? 'bg-rose-100 text-rose-600' :
                    'bg-amber-100 text-amber-600'
                  }`}>
                    {po.status}
                  </div>
                  <p className="text-sm font-black text-slate-800 dark:text-white">{po.poNumber}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Supplier</p>
                  <h3 className="text-base font-black text-slate-800 dark:text-white uppercase truncate italic">{po.supplierName}</h3>
                </div>

                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Grand Total</p>
                    <p className="text-xl font-black text-indigo-600">Rs {po.total.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Payment</p>
                    <p className={`text-[10px] font-black uppercase italic ${
                      po.paymentStatus === 'PAID' ? 'text-emerald-500' :
                      po.paymentStatus === 'PARTIAL' ? 'text-indigo-500' :
                      'text-rose-500'
                    }`}>
                      {po.paymentStatus}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="w-3 h-3" />
                  <span className="text-[10px] font-bold">{new Date(po.orderDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <Layers className="w-3 h-3" />
                  <span className="text-[10px] font-bold">{po.items.length} items</span>
                </div>
              </div>
            </motion.div>
          ))}

          {filteredPOs.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900/50 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-white/5">
              <Package className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-slate-500 font-bold">No purchase orders found</p>
            </div>
          )}
        </div>
      </main>

      {/* PO Detail Modal */}
      <AnimatePresence>
        {selectedPO && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md pointer-events-auto"
              onClick={() => setSelectedPO(null)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-6">
                  <div className="p-4 bg-indigo-600 text-white rounded-2xl">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black uppercase italic italic tracking-tighter dark:text-white">
                      Order <span className="text-indigo-500">#{selectedPO.poNumber}</span>
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedPO.supplierName}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedPO(null)}
                  className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors"
                >
                  <ArrowLeft className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-white/5">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Order Status</p>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          selectedPO.status === 'RECEIVED' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}>
                          {selectedPO.status === 'RECEIVED' ? <Check className="w-3 h-3 text-white" /> : <Clock className="w-3 h-3 text-white" />}
                        </div>
                        <p className="text-lg font-black uppercase italic dark:text-white">{selectedPO.status}</p>
                      </div>
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-white/5">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Payment Status</p>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          selectedPO.paymentStatus === 'PAID' ? 'bg-emerald-500' : 
                          selectedPO.paymentStatus === 'PARTIAL' ? 'bg-indigo-500' : 'bg-rose-500'
                        }`}>
                          <DollarSign className="w-3 h-3 text-white" />
                        </div>
                        <p className="text-lg font-black uppercase italic dark:text-white">{selectedPO.paymentStatus}</p>
                      </div>
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-white/5">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Order Total</p>
                      <p className="text-2xl font-black text-indigo-600">Rs {selectedPO.total.toLocaleString()}</p>
                    </div>
                 </div>

                 <div className="mb-12">
                   <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-6">Order Items</h3>
                   <div className="space-y-3">
                     {selectedPO.items.map((item, idx) => (
                       <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-white/5">
                         <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center font-black text-indigo-600 border border-slate-100 dark:border-white/5 shadow-sm">
                             {idx + 1}
                           </div>
                           <div>
                             <p className="text-sm font-black uppercase text-slate-800 dark:text-white">{item.name}</p>
                             <p className="text-[10px] font-bold text-slate-400 uppercase">Unit Cost: Rs {item.costPrice.toLocaleString()} / {item.unit}</p>
                           </div>
                         </div>
                         <div className="text-right">
                           <p className="text-sm font-black text-slate-800 dark:text-white">{item.qty} {item.unit}</p>
                           <p className="text-[11px] font-bold text-indigo-500">Rs {item.total.toLocaleString()}</p>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>

                 {selectedPO.notes && (
                   <div className="p-6 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-slate-200 dark:border-white/5 italic">
                     <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Internal Notes</p>
                     <p className="text-sm text-slate-600 dark:text-slate-400">{selectedPO.notes}</p>
                   </div>
                 )}
              </div>

              <div className="p-8 border-t dark:border-white/5 bg-slate-50 dark:bg-slate-800/50 flex flex-col md:flex-row gap-4">
                {selectedPO.status === 'SENT' && (
                  <button 
                    onClick={() => handleReceivePO(selectedPO)}
                    className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase italic text-sm shadow-lg shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Mark as Received
                  </button>
                )}
                
                {selectedPO.paymentStatus !== 'PAID' && (
                  <button 
                    onClick={() => {
                        const amount = prompt(`Enter payment amount (Remaining: ${selectedPO.total - selectedPO.amountPaid})`, (selectedPO.total - selectedPO.amountPaid).toString());
                        if (amount) handlePOPayment(selectedPO, parseFloat(amount));
                    }}
                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase italic text-sm shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    <DollarSign className="w-5 h-5" />
                    Make Payment
                  </button>
                )}
                
                <button 
                  className="px-8 py-4 bg-white dark:bg-slate-900 text-slate-500 border-2 border-slate-100 dark:border-white/5 rounded-2xl font-black uppercase italic text-sm hover:text-rose-500 transition-all flex items-center justify-center gap-3"
                >
                  <FileText className="w-5 h-5" />
                  Download PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add PO Modal */}
      <AnimatePresence>
        {isAddingPO && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md pointer-events-auto"
              onClick={() => setIsAddingPO(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b dark:border-white/5 bg-slate-50 dark:bg-slate-800/50">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter dark:text-white">New Purchase Order</h2>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Supplier</label>
                     <select 
                       className="w-full bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-2xl p-4 text-sm font-bold outline-none"
                       value={newPO.supplierId}
                       onChange={(e) => setNewPO(p => ({ ...p, supplierId: e.target.value }))}
                     >
                       <option value="">Select Supplier</option>
                       {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.category})</option>)}
                     </select>
                   </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Select Items</h3>
                    <div className="flex gap-2 overflow-x-auto pb-2 scroll-hide max-w-md">
                      {inventory.map(item => (
                        <button 
                          key={item.id}
                          onClick={() => addItemToPO(item.id)}
                          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-black uppercase whitespace-nowrap hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2"
                        >
                          <Plus className="w-3 h-3" />
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {newPO.items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-4 items-center p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-white/5">
                        <div className="col-span-4">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.name}</p>
                          <p className="text-[8px] font-bold text-indigo-500 uppercase">Unit: {item.unit}</p>
                        </div>
                        <div className="col-span-3">
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Quantity</p>
                          <input 
                            type="number"
                            value={item.qty}
                            onChange={(e) => updatePOItem(item.itemId, 'qty', parseFloat(e.target.value))}
                            className="w-full bg-white dark:bg-slate-800 border dark:border-white/5 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="col-span-4">
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Unit Cost (Rs)</p>
                          <input 
                            type="number"
                            value={item.costPrice}
                            onChange={(e) => updatePOItem(item.itemId, 'costPrice', parseFloat(e.target.value))}
                            className="w-full bg-white dark:bg-slate-800 border dark:border-white/5 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button 
                            onClick={() => setNewPO(p => ({ ...p, items: p.items.filter(it => it.itemId !== item.itemId) }))}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Internal Notes</label>
                   <textarea 
                     rows={3}
                     className="w-full bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-2xl p-4 text-sm font-bold outline-none"
                     placeholder="Any special instructions or reference numbers..."
                     value={newPO.notes}
                     onChange={(e) => setNewPO(p => ({ ...p, notes: e.target.value }))}
                   />
                </div>
              </div>

              <div className="p-8 border-t dark:border-white/5 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-4">
                <button 
                  onClick={() => setIsAddingPO(false)}
                  className="px-8 py-4 text-slate-500 font-black uppercase italic text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreatePO}
                  disabled={!newPO.supplierId || newPO.items.length === 0}
                  className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase italic text-sm shadow-xl shadow-indigo-600/30 active:scale-95 transition-all disabled:opacity-50"
                >
                  Create Purchase Order
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Supplier Modal */}
      <AnimatePresence>
        {isAddingSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md pointer-events-auto"
              onClick={() => setIsAddingSupplier(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8"
            >
              <h2 className="text-xl font-black uppercase italic mb-8 dark:text-white">Add New Supplier</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Vendor Name</label>
                  <input 
                    placeholder="Enter supplier/company name"
                    className="w-full bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-xl p-3 text-sm font-bold outline-none"
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier(p => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Mobile Number</label>
                  <input 
                    placeholder="e.g., 03XX XXXXXXX"
                    className="w-full bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-xl p-3 text-sm font-bold outline-none"
                    value={newSupplier.mobile}
                    onChange={(e) => setNewSupplier(p => ({ ...p, mobile: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Category (Optional)</label>
                  <input 
                    placeholder="e.g., Meat, Buns, Soda"
                    className="w-full bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-xl p-3 text-sm font-bold outline-none"
                    value={newSupplier.category}
                    onChange={(e) => setNewSupplier(p => ({ ...p, category: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                 <button onClick={() => setIsAddingSupplier(false)} className="px-6 py-3 text-slate-400 font-bold uppercase text-[10px]">Cancel</button>
                 <button 
                   onClick={handleAddSupplier}
                   className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase italic text-[10px] shadow-lg shadow-indigo-600/20"
                 >
                   Save Supplier
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PurchaseOrders;
