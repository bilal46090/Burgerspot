
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

const SHOP_OPEN_HOUR = 8;
const getBusinessDate = (date: Date = new Date()) => {
  const d = new Date(date);
  if (d.getHours() < SHOP_OPEN_HOUR) {
    d.setDate(d.getDate() - 1);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export async function getTodaySales() {
  const today = getBusinessDate();
  const q = query(collection(db, 'orders'), where('businessDate', '==', today));
  const snap = await getDocs(q);
  return snap.docs.reduce((sum, doc) => sum + (doc.data().total || 0), 0);
}

export async function getLowStockItems() {
  const snap = await getDocs(collection(db, 'inventory'));
  return snap.docs
    .map(doc => ({ name: doc.data().name, qty: doc.data().stock }))
    .filter(item => (item.qty || 0) < 5);
}

export async function getPendingOrders() {
  // Assuming UNPAID or status != PAID
  const snap = await getDocs(collection(db, 'orders'));
  const pending = snap.docs.filter(doc => doc.data().status !== 'PAID');
  return {
    count: pending.length,
    amount: pending.reduce((sum, doc) => sum + (doc.data().total || 0), 0),
    list: pending.map(doc => `#${doc.id.slice(-6)}: Rs ${doc.data().total}`).join(', ')
  };
}
