import { GoogleGenAI } from "@google/genai";
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../src/lib/firebase';
import { getAnyInformation, quickAnswers } from './UniversalKnowledge';
import { getTodaySales, getLowStockItems, getPendingOrders } from './database';

// Cache for repeated questions (60 seconds TTL)
interface CacheEntry {
  answer: string;
  timestamp: number;
  hits: number;
}

const answerCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60000; // 60 seconds

let quotaCoolOffUntil = 0;

// Smart context - summary data
let cachedContext: any = null;
let lastContextFetch = 0;
const CONTEXT_CACHE_TTL = 30000; // 30 seconds

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

async function getSmartContext() {
  const now = Date.now();
  const nowDate = new Date();
  const todayBizDate = getBusinessDate(nowDate);
  
  const yesterdayDate = new Date(nowDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayBizDate = getBusinessDate(yesterdayDate);
  
  if (cachedContext && (now - lastContextFetch) < CONTEXT_CACHE_TTL) {
    return cachedContext;
  }
  
  try {
    // Increase limit to 300 for better historical perspective
    // Removed orderBy to avoid index requirement errors; we'll sort in memory
    const [ordersSnap, inventorySnap, posSnap, suppliersSnap] = await Promise.all([
      getDocs(query(collection(db, 'orders'), limit(300))).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'inventory')).catch(() => ({ docs: [] })),
      getDocs(query(collection(db, 'purchase_orders'), limit(50))).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'suppliers')).catch(() => ({ docs: [] }))
    ]);
    
    let allOrders = (ordersSnap as any).docs?.map((doc:any) => ({ id: doc.id, ...doc.data() })) || [];
    let orders = allOrders.filter((o: any) => o.status !== 'VOIDED');
    const inventory = (inventorySnap as any).docs?.map((doc:any) => ({ id: doc.id, ...doc.data() })) || [];
    const purchaseOrders = (posSnap as any).docs?.map((doc:any) => ({ id: doc.id, ...doc.data() })) || [];
    const suppliers = (suppliersSnap as any).docs?.map((doc:any) => ({ id: doc.id, ...doc.data() })) || [];
    
    // Sort in memory to be safe
    orders = orders.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
    
    // Sort orders by business date for historical context
    const ordersByDate: Record<string, any[]> = {};
    orders.forEach(o => {
      const date = o.businessDate || "Unknown";
      if (!ordersByDate[date]) ordersByDate[date] = [];
      ordersByDate[date].push(o);
    });

    const todayOrders = ordersByDate[todayBizDate] || [];
    const yesterdayOrders = ordersByDate[yesterdayBizDate] || [];

    const todayStats = {
      total: todayOrders.reduce((s, o) => s + (o.total || 0), 0),
      count: todayOrders.length,
      paid: todayOrders.filter(o => o.status === 'PAID').reduce((s, o) => s + (o.total || 0), 0),
      unpaid: todayOrders.filter(o => o.status === 'UNPAID').reduce((s, o) => s + (o.total || 0), 0),
      udhaar: todayOrders.filter(o => o.status === 'UDHAAR').reduce((s, o) => s + (o.total || 0), 0),
    };

    const yesterdayStats = {
      total: yesterdayOrders.reduce((s, o) => s + (o.total || 0), 0),
      count: yesterdayOrders.length
    };

    const sortedDates = Object.keys(ordersByDate).sort((a, b) => b.localeCompare(a));

    const dailySummaries = sortedDates.slice(0, 10).map(date => {
      const dayOrders = ordersByDate[date];
      const total = dayOrders.reduce((s, o) => s + (o.total || 0), 0);
      let label = date;
      if (date === todayBizDate) label = "TODAY (" + date + ")";
      if (date === yesterdayBizDate) label = "YESTERDAY (" + date + ")";
      return `${label}: Rs ${total} (${dayOrders.length} orders)`;
    });

    // Calculate aggregates
    const totalSales = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const paidTotal = orders.filter(o => o.status === 'PAID' || o.status === 'paid').reduce((sum, o) => sum + (o.total || 0), 0);
    const unpaidTotal = orders.filter(o => o.status === 'UNPAID' || o.status === 'unpaid').reduce((sum, o) => sum + (o.total || 0), 0);
    const udhaarTotal = orders.filter(o => o.status === 'UDHAAR').reduce((sum, o) => sum + (o.total || 0), 0);
    
    // Count items sold
    const itemCount: Record<string, number> = {};
    orders.forEach(order => {
      order.items?.forEach((item: any) => {
        const name = item.name;
        itemCount[name] = (itemCount[name] || 0) + (item.quantity || 1);
      });
    });
    
    const totalItemsSold = Object.values(itemCount).reduce((sum, count) => sum + count, 0);
    
    const topItems = Object.entries(itemCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
    
    // Low stock items
    const lowStock = inventory
      .filter(item => (item.stock || 0) < (item.minStock || 5))
      .map(item => ({ name: item.name, qty: item.stock }));
    
    cachedContext = {
      totalSales,
      totalItemsSold,
      paidTotal,
      unpaidTotal,
      udhaarTotal,
      orderCount: orders.length,
      todayStats,
      yesterdayStats,
      todayBizDate,
      topItems,
      lowStock,
      dailySummaries,
      pendingOrders: orders.filter(o => o.status === 'UNPAID' || o.status === 'unpaid' || o.status === 'PENDING').length,
      udhaarOrders: orders.filter(o => o.status === 'UDHAAR').length,
      purchaseOrders: purchaseOrders.map(p => ({ no: p.poNumber, vendor: p.supplierName, total: p.total, status: p.status, payment: p.paymentStatus })),
      suppliers: suppliers.map(s => ({ name: s.name, due: s.totalDue })),
      lastUpdated: new Date().toLocaleString(),
      currentTime: new Date().toLocaleString(),
      topDebtors: Object.entries(
        orders.filter(o => o.status === 'UDHAAR')
          .reduce((acc: Record<string, number>, o: any) => {
            const name = o.customer?.name || "Guest";
            acc[name] = (acc[name] || 0) + (o.total || 0);
            return acc;
          }, {})
      ).sort((a: [string, any], b: [string, any]) => b[1] - a[1]).slice(0, 5).map(([name, balance]) => `${name}: Rs ${balance}`)
    };
    
    lastContextFetch = now;
    return cachedContext;
    
  } catch (error) {
    console.error('Context fetch error:', error);
    return cachedContext || { totalSales: 0, orderCount: 0, topItems: [], lowStock: [], dailySummaries: [] };
  }
}

function getFastPrompt(query: string, context: any): string {
  let template = `You are Bursport AI Manager (Restaurant Analysis Assistant). 
Current Time: ${context.currentTime}. Today's Business date: ${context.todayBizDate}.

IMPORTANT: ALWAYS use the statistical data provided below to answer questions about total sales, order counts, or historical performance. If the user asks about "aaj" (today) or "kal" (yesterday), look at the TODAY and YESTERDAY sections below.

TODAY (${context.todayBizDate}) Statistics:
- Total Sale: Rs ${context.todayStats.total}
- Order Count: ${context.todayStats.count}
- Items Sold: ${context.todayStats.count > 0 ? context.totalItemsSold : 0} (Estimate)
- Paid Amount: Rs ${context.todayStats.paid}
- Unpaid (General): Rs ${context.todayStats.unpaid}
- Udhaar (Market Credit): Rs ${context.todayStats.udhaar}

Market Insights:
- Market Udhaar (Total Outstanding): Rs ${context.udhaarTotal}
- Total Udhaar Orders: ${context.udhaarOrders}
- Top Debtors: ${context.topDebtors.join(', ') || 'None'}

YESTERDAY Statistics:
- Total Sale: Rs ${context.yesterdayStats.total}
- Order Count: ${context.yesterdayStats.count}

Historical Summary (Last 10 days):
${context.dailySummaries.join('\n')}

Procurement & Suppliers:
- Purchase Orders: ${context.purchaseOrders.length} active/recent
- Total Suppliers: ${context.suppliers.length}
- Low Stock Items: ${context.lowStock.map((i:any) => `${i.name} (${i.qty} left)`).join(', ')}

Catalog Insights:
- Best Selling Items: ${context.topItems.slice(0, 5).map((i:any) => `${i.name} sold ${i.count} times`).join(', ')}
- Total orders in memory: ${context.orderCount}

Respond in friendly Hinglish. Be concise and direct.
User Query: ${query}
Assistant Answer:`;
  
  return template;
}

export async function askGeminiFast(queryText: string, history?: {role: string, content: string}[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return "Bursport AI is currently offline. Please check your API configuration.";
  }

  const ai = new GoogleGenAI({ apiKey });

  if (Date.now() < quotaCoolOffUntil) {
    return "Bursport AI ki daily limit (quota) khatam ho gayi hai. Please manually report check karein ya thori der baad try karein. Shukriya!";
  }

  const cacheKey = `${queryText}-${(history || []).length}`;
  const cached = answerCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    cached.hits++;
    return cached.answer;
  }
  
  try {
    const context = await getSmartContext();
    const prompt = getFastPrompt(queryText, context);
    
    const formattedHistory = (history || []).map(h => ({
      role: h.role === 'ai' ? 'model' : 'user',
      parts: [{ text: h.content }]
    }));

    let lastError: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            ...formattedHistory,
            { role: 'user', parts: [{ text: prompt }] }
          ],
          config: {
            temperature: 0.3,
            topK: 20,
            topP: 0.8,
          }
        });
        
        const answer = response.text || "Maaf kijiye, response generate nahi ho paya.";
        
        answerCache.set(cacheKey, {
          answer,
          timestamp: Date.now(),
          hits: 1
        });
        
        return answer;
      } catch (err: any) {
        lastError = err;
        console.warn(`Gemini attempt ${attempt + 1} failed:`, err);
        // If it's a quota error, don't retry, just break
        if (JSON.stringify(err).includes('RESOURCE_EXHAUSTED')) break;
        // Wait a bit before retry
        if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
      }
    }
    throw lastError;
  } catch (error: any) {
    const errString = JSON.stringify(error);
    
    // Log as warning if it's a known transient or handled error
    if (errString.includes('500') || errString.includes('Rpc failed') || errString.includes('RESOURCE_EXHAUSTED')) {
      console.warn("Gemini Manager (Transient/Quota):", errString);
    } else {
      console.error('Gemini error:', error);
    }
    
    // Robust 429/Quota Check
    const isQuotaError = 
      error?.status === 429 || 
      error?.code === 429 ||
      error?.message?.includes('429') || 
      error?.message?.includes('RESOURCE_EXHAUSTED') ||
      errString.includes('RESOURCE_EXHAUSTED') ||
      errString.includes('quota');

    if (isQuotaError) {
      quotaCoolOffUntil = Date.now() + 5 * 60 * 1000; // 5 minute cool-off
      return "Bursport AI ki daily limit (quota) khatam ho gayi hai. Aaj bohot orders aaye hain lagta hai! Kal dobara try karein ya manually reports check karein. Shukriya!";
    }
    
    return "Maaf kijiye, abhi network ya server issue ki wajah se response nahi mil saka. Ek baar phir try karein.";
  }
}

export async function preFetchCommonQueries() {
  // Disabled to save API quota
  return;
}

export function clearCache() {
  answerCache.clear();
  cachedContext = null;
  lastContextFetch = 0;
}

export async function askAnything(queryText: string, history?: {role: string, content: string}[]): Promise<string> {
  // Step 1: Check quick answers
  for (const [key, answer] of Object.entries(quickAnswers)) {
    if (queryText.toLowerCase().includes(key)) {
      return answer;
    }
  }
  
  // Step 2: Try universal knowledge sources
  const knowledgeAnswer = await getAnyInformation(queryText);
  if (knowledgeAnswer) {
    return knowledgeAnswer;
  }
  
  // Step 3: Fallback to Gemini Fast logic
  return askGeminiFast(queryText, history);
}
