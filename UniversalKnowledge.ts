
import { collection, getDocs, query as fsQuery, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

// ============================================
// 1. KNOWLEDGE CATEGORIES
// ============================================

interface KnowledgeCategory {
  name: string;
  keywords: string[];
  fetch: (query: string, params?: any) => Promise<string>;
}

// ============================================
// 2. ALL KNOWLEDGE SOURCES
// ============================================

const knowledgeSources: KnowledgeCategory[] = [
  // Sales & Revenue
  {
    name: 'sales',
    keywords: ['sale', 'earning', 'revenue', 'kamai', 'kitni', 'total', 'amount', '₹', 'rupees', 'price', 'rate'],
    fetch: async (queryText) => {
      const ordersSnap = await getDocs(collection(db, 'orders'));
      const orders = ordersSnap.docs.map(doc => doc.data());
      const total = orders.reduce((sum, o) => sum + (o.total || 0), 0);
      const paid = orders.filter(o => o.status === 'PAID').reduce((sum, o) => sum + (o.total || 0), 0);
      const unpaid = orders.filter(o => o.status !== 'PAID').reduce((sum, o) => sum + (o.total || 0), 0);
      
      // Specific item price check
      if (queryText.includes('price') || queryText.includes('rate') || queryText.includes('kitne ka')) {
        const menuSnap = await getDocs(collection(db, 'menu'));
        const items = menuSnap.docs.map(doc => ({ name: doc.data().name, price: doc.data().price }));
        const matchedItem = items.find(i => queryText.toLowerCase().includes(i.name.toLowerCase()));
        if (matchedItem) {
          return `🍔 ${matchedItem.name} ki price Rs ${matchedItem.price} hai.`;
        }
      }
      
      return `📊 Total sale: Rs ${total.toLocaleString()}\n🟠 Paid: Rs ${paid.toLocaleString()} | 🔴 Unpaid: Rs ${unpaid.toLocaleString()}\n📦 Orders: ${orders.length}`;
    }
  },
  
  // Inventory & Stock
  {
    name: 'inventory',
    keywords: ['stock', 'inventory', 'bacha', 'kam', 'khatam', 'left', 'quantity', 'available', 'item', 'menu'],
    fetch: async (queryText) => {
      const inventorySnap = await getDocs(collection(db, 'inventory'));
      const items = inventorySnap.docs.map(doc => ({ name: doc.data().name, quantity: doc.data().stock, price: doc.data().price }));
      
      // Specific item check
      const specificItem = items.find(i => queryText.toLowerCase().includes(i.name.toLowerCase()));
      if (specificItem) {
        return `📦 ${specificItem.name}: ${specificItem.quantity} pieces available. ${specificItem.quantity < 10 ? '⚠️ Low stock!' : '✅ In stock'}`;
      }
      
      const lowStock = items.filter(i => (i.quantity || 0) < 10);
      if (lowStock.length > 0) {
        return `⚠️ Low stock items:\n${lowStock.map(i => `  • ${i.name}: ${i.quantity} left`).join('\n')}`;
      }
      
      return `📊 All items in stock. Total ${items.length} items available.`;
    }
  },
  
  // Orders & Customers
  {
    name: 'orders',
    keywords: ['order', 'pending', 'customer', 'rider', 'delivery', 'track', 'status', 'kahan', 'kaun'],
    fetch: async (queryText) => {
      const ordersSnap = await getDocs(fsQuery(collection(db, 'orders'), orderBy('timestamp', 'desc'), limit(20)));
      const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      
      // Specific order check
      const orderIdMatch = queryText.match(/#?\d{3,}/);
      if (orderIdMatch) {
        const orderId = orderIdMatch[0].replace('#', '');
        const order = orders.find(o => o.id === orderId || o.id.slice(-6) === orderId);
        if (order) {
          return `📋 Order #${order.id}\n💰 Amount: Rs ${order.total}\n📦 Status: ${order.status}\n🚚 ${order.deliveryStatus || 'Preparing'}`;
        }
        return `❌ Order #${orderId} not found.`;
      }
      
      const pending = orders.filter(o => o.status !== 'PAID');
      return `⏳ Pending orders: ${pending.length}\n${pending.slice(0, 5).map(o => `  • #${o.id.slice(-6)}: Rs ${o.total} - ${o.status}`).join('\n')}`;
    }
  },
  
  // Performance & Analytics
  {
    name: 'performance',
    keywords: ['best', 'top', 'peak', 'average', 'trend', 'growth', 'compare', 'zyada', 'kam'],
    fetch: async (queryText) => {
      const ordersSnap = await getDocs(collection(db, 'orders'));
      const orders = ordersSnap.docs.map(doc => doc.data() as any);
      
      // Top selling item
      const itemCount: Record<string, number> = {};
      orders.forEach(order => {
        order.items?.forEach((item: any) => {
          itemCount[item.name] = (itemCount[item.name] || 0) + (item.quantity || 1);
        });
      });
      const topItems = Object.entries(itemCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
      
      // Peak hour
      const hourCount: Record<number, number> = {};
      orders.forEach(order => {
        const timestamp = order.timestamp;
        if (timestamp) {
          const date = new Date(timestamp);
          const hour = date.getHours();
          hourCount[hour] = (hourCount[hour] || 0) + 1;
        }
      });
      const peakHour = Object.entries(hourCount).sort((a: any, b: any) => b[1] - a[1])[0];
      
      if (queryText.includes('top') || queryText.includes('best')) {
        return `🏆 Top selling items:\n${topItems.map(([name, count], i) => `  ${i+1}. ${name}: ${count} units`).join('\n')}`;
      }
      
      if (queryText.includes('peak') || queryText.includes('busy')) {
        return `🔥 Peak hour: ${peakHour?.[0]}:00 - ${(parseInt(peakHour?.[0] as string)+1)%24}:00 with ${peakHour?.[1]} orders`;
      }
      
      return `📈 Performance:\n• Total orders: ${orders.length}\n• Top item: ${topItems[0]?.[0]} (${topItems[0]?.[1]} units)\n• Peak hour: ${peakHour?.[0]}:00-${(parseInt(peakHour?.[0] as string)+1)%24}:00`;
    }
  },
  
  // Business Hours & Settings
  {
    name: 'settings',
    keywords: ['time', 'hour', 'business day', 'shift', 'open', 'close', 'timing', 'schedule'],
    fetch: async (queryText) => {
      if (queryText.includes('business') || queryText.includes('hours')) {
        return `⏰ Business hours: 8AM to 4AM (next day)`;
      }
      
      if (queryText.includes('peak') || queryText.includes('busy')) {
        return `🔥 Peak hours: 8PM-11PM (65% of daily orders)\n💤 Slow hours: 2PM-5PM and 3AM-4AM`;
      }
      
      return `⏰ Current business timing: ${new Date().toLocaleTimeString()} | Day: ${new Date().toLocaleDateString()}`;
    }
  },
  
  // Profit & Expenses
  {
    name: 'finance',
    keywords: ['profit', 'loss', 'expense', 'cost', 'kharcha', 'munafa', 'net', 'margin'],
    fetch: async (queryText) => {
      const ordersSnap = await getDocs(collection(db, 'orders'));
      const expensesSnap = await getDocs(collection(db, 'expenses'));
      
      const orders = ordersSnap.docs.map(doc => doc.data());
      const expenses = expensesSnap.docs.map(doc => doc.data());
      
      const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const profit = revenue - totalExpenses;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      
      if (queryText.includes('profit')) {
        return `💰 Profit: Rs ${profit.toLocaleString()}\n📈 Margin: ${margin.toFixed(1)}%\n💸 Expenses: Rs ${totalExpenses.toLocaleString()}`;
      }
      
      if (queryText.includes('expense')) {
        return `💸 Total expenses: Rs ${totalExpenses.toLocaleString()}\n${expenses.slice(0, 5).map(e => `  • ${e.category}: Rs ${e.amount}`).join('\n')}`;
      }
      
      return `💰 Financial summary:\n• Revenue: Rs ${revenue.toLocaleString()}\n• Expenses: Rs ${totalExpenses.toLocaleString()}\n• Profit: Rs ${profit.toLocaleString()}`;
    }
  },
  
  // Technical Support
  {
    name: 'support',
    keywords: ['help', 'support', 'kaise', 'how to', 'kya karun', 'problem', 'error', 'crash', 'not working'],
    fetch: async (queryText) => {
      const commonIssues = [
        { pattern: /login|sign in|auth/i, response: "🔐 Login issue? Try:\n1. Check email/password\n2. Click 'Forgot Password'\n3. Clear browser cache\n4. Contact admin" },
        { pattern: /slow|loading|time/i, response: "🐌 Slow performance? Try:\n1. Refresh page\n2. Check internet\n3. Clear cache\n4. Reduce date range" },
        { pattern: /data|show|display|not showing/i, response: "📊 Data not showing? Try:\n1. Refresh page\n2. Check Firebase connection\n3. Add sample data\n4. Verify permissions" },
        { pattern: /crash|freeze|stuck/i, response: "🔄 App frozen? Try:\n1. Hard refresh (Ctrl+F5)\n2. Clear browser data\n3. Restart app\n4. Contact support" }
      ];
      
      for (const issue of commonIssues) {
        if (issue.pattern.test(queryText)) {
          return issue.response;
        }
      }
      
      return "🆘 Need help? Try:\n• 'login nahi ho raha'\n• 'data show nahi ho raha'\n• 'app slow hai'\n• 'error aa raha hai'\n\nOr describe your problem in detail.";
    }
  }
];

// ============================================
// 3. MAIN FUNCTION — Answer ANY Question
// ============================================

export async function getAnyInformation(userQuery: string): Promise<string | null> {
  const queryLower = userQuery.toLowerCase();
  
  // Find matching knowledge source
  for (const source of knowledgeSources) {
    const matched = source.keywords.some(keyword => queryLower.includes(keyword));
    if (matched) {
      try {
        const answer = await source.fetch(userQuery);
        return answer;
      } catch (error) {
        console.error(`Error fetching from ${source.name}:`, error);
        return `❌ Could not fetch ${source.name} information. Please try again.`;
      }
    }
  }
  
  // No match found — use Gemini
  return null; // Will fallback to Gemini API
}

// ============================================
// 4. QUICK ANSWERS — Common Questions
// ============================================

export const quickAnswers: Record<string, string> = {
  'time': `⏰ Current time: ${new Date().toLocaleTimeString()}`,
  'date': `📅 Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
  'business day': '📆 Business day: 8AM to 4AM (next day)',
  'support': '📞 Customer support: support@burgersport.com',
  'version': '📱 App version: 2.0.0 | Latest update: May 2026'
};
