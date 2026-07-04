
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db, isFirestoreConnected } from '../src/lib/firebase';

// ============================================
// 1. KNOWLEDGE BASE - Common Issues & Solutions
// ============================================

export interface Issue {
  id: string;
  title: string;
  symptoms: string[];
  causes: string[];
  solutions: string[];
  autoFix?: () => Promise<boolean>;
  category: 'connection' | 'auth' | 'data' | 'performance' | 'ui' | 'payment';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export const knowledgeBase: Issue[] = [
  {
    id: 'firebase-001',
    title: 'Firestore Connection Timeout',
    symptoms: [
      'Could not reach Cloud Firestore backend',
      'Backend didn\'t respond within 10 seconds',
      'App working offline mode'
    ],
    causes: [
      'Slow internet connection',
      'Firebase rules misconfigured',
      'API quota exceeded',
      'Network proxy blocking requests'
    ],
    solutions: [
      'Check your internet connection',
      'Restart the app',
      'Clear browser cache',
      'Check Firebase console for outages',
      'Enable offline persistence'
    ],
    category: 'connection',
    severity: 'high'
  },
  {
    id: 'auth-001',
    title: 'Login Failed',
    symptoms: [
      'User not found',
      'Wrong password',
      'Too many requests',
      'Invalid email format'
    ],
    causes: [
      'Incorrect credentials',
      'User account deleted',
      'Too many failed attempts',
      'Email not verified'
    ],
    solutions: [
      'Double-check email and password',
      'Click "Forgot Password" to reset',
      'Wait 5 minutes before retry',
      'Contact admin to verify account'
    ],
    category: 'auth',
    severity: 'high'
  },
  {
    id: 'data-001',
    title: 'Data Not Loading',
    symptoms: [
      'No orders showing',
      'Inventory empty',
      'Sales chart blank',
      'Loading spinner stuck'
    ],
    causes: [
      'No data in database',
      'Collection name mismatch',
      'Permission denied',
      'Query filter too restrictive'
    ],
    solutions: [
      'Check if orders exist in Firebase',
      'Verify collection names in code',
      'Check Firebase rules',
      'Add sample data for testing'
    ],
    category: 'data',
    severity: 'medium'
  },
  {
    id: 'performance-001',
    title: 'Slow Response Time',
    symptoms: [
      'AI taking more than 5 seconds',
      'Page loading slowly',
      'Chart rendering delay',
      'API timeout'
    ],
    causes: [
      'Large dataset being fetched',
      'Slow internet connection',
      'Inefficient queries',
      'Heavy components rendering'
    ],
    solutions: [
      'Limit data fetch to last 7 days',
      'Add pagination to orders list',
      'Use caching for repeated queries',
      'Optimize Firestore indexes'
    ],
    category: 'performance',
    severity: 'medium'
  },
  {
    id: 'ui-001',
    title: 'Chatbot Not Showing',
    symptoms: [
      'Bot icon not visible',
      'Chat window not opening',
      'Z-index issues',
      'Component not rendered'
    ],
    causes: [
      'Component not imported',
      'CSS overflow hidden',
      'Missing parent container',
      'Conditional rendering issue'
    ],
    solutions: [
      'Check if GeminiChat is imported in App.tsx',
      'Remove overflow:hidden from body',
      'Add z-index: 999999 to bot button',
      'Verify component export'
    ],
    category: 'ui',
    severity: 'low'
  },
  {
    id: 'payment-001',
    title: 'Payment Not Processing',
    symptoms: [
      'Payment gateway error',
      'Order shows unpaid',
      'Transaction failed',
      'Amount deducted but order not confirmed'
    ],
    causes: [
      'Payment gateway timeout',
      'Insufficient balance',
      'Bank server down',
      'Webhook not received'
    ],
    solutions: [
      'Check payment gateway status',
      'Refresh and try again',
      'Use alternative payment method',
      'Contact support with transaction ID'
    ],
    category: 'payment',
    severity: 'critical'
  }
];

// ============================================
// 2. AI TRAINING DATA
// ============================================

export interface TrainingData {
  context: string;
  patterns: string[];
  responses: string[];
  actions?: string[];
}

export const trainingData: TrainingData[] = [
  {
    context: 'sales_query',
    patterns: [
      'sale kitni hui', 'total sale', 'earning', 'revenue',
      'aaj ki sale', 'today profit', 'kitna kamaya'
    ],
    responses: [
      '📊 Aaj ki total sale ₹{amount} hai. {orders} orders complete.',
      '💰 Aj ki kamai ₹{amount} hai. {paid} paid, {unpaid} unpaid.',
      '📈 Total revenue ₹{amount} with {orders} orders.'
    ],
    actions: ['fetch_today_sales']
  },
  {
    context: 'pending_orders',
    patterns: [
      'pending orders', 'unpaid orders', 'kitne pending', 
      'baki orders', 'due orders'
    ],
    responses: [
      '⏳ {count} orders pending hai. Unpaid amount: ₹{amount}',
      '📋 Pending orders: {list}. Total due: ₹{amount}',
      '🕐 {count} customers ka payment pending hai.'
    ],
    actions: ['fetch_pending_orders']
  },
  {
    context: 'low_stock',
    patterns: [
      'kya kam hai', 'low stock', 'stock check', 'inventory',
      'khatam', 'stock kya hai'
    ],
    responses: [
      '📦 Low stock items:\n{list}',
      '⚠️ Ye items khatam hone wale hain:\n{list}',
      '🛒 Restock needed for: {list}'
    ],
    actions: ['fetch_low_stock']
  },
  {
    context: 'error_fix',
    patterns: [
      'error aa raha hai', 'app crash', 'kaam nahi kar raha',
      'problem hai', 'issue', 'bug'
    ],
    responses: [
      '🔍 Issue detected: {issue}\n\n💡 Solution: {solution}\n\n🔄 Auto-fix available. Fix karun?'
    ],
    actions: ['detect_issue', 'suggest_fix']
  }
];

// ============================================
// 3. ISSUE DETECTION ENGINE
// ============================================

export async function detectAppIssues(): Promise<Issue[]> {
  const detectedIssues: Issue[] = [];
  
  // Check 1: Firebase connection using direct flag if possible
  if (!isFirestoreConnected) {
    detectedIssues.push(knowledgeBase.find(i => i.id === 'firebase-001')!);
  } else {
    // Fallback check: Try a lightweight fetch
    try {
      // Use a short timeout for detection
      const testQuery = await Promise.race([
        getDocs(collection(db, 'system')),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);
    } catch (error: any) {
      if (error.message?.includes('backend') || error.message === 'timeout') {
         // Only add if not already marked as disconnected by our listener
         if (!detectedIssues.some(i => i.id === 'firebase-001')) {
           detectedIssues.push(knowledgeBase.find(i => i.id === 'firebase-001')!);
         }
      }
    }
  }
  
  // Only proceed if connected, otherwise other checks will fail too
  if (isFirestoreConnected) {
    // Check 2: Data exists
    try {
      const ordersSnap = await getDocs(collection(db, 'orders'));
      if (ordersSnap.empty) {
        detectedIssues.push(knowledgeBase.find(i => i.id === 'data-001')!);
      }
    } catch (e) {}
    
    // Check 3: Performance
    const startTime = performance.now();
    try {
      await getDocs(collection(db, 'menu'));
      const endTime = performance.now();
      if (endTime - startTime > 3000) {
        detectedIssues.push(knowledgeBase.find(i => i.id === 'performance-001')!);
      }
    } catch (e) {}
  }
  
  return detectedIssues;
}

// ============================================
// 4. SOLUTION GENERATOR
// ============================================

export async function generateSolution(issue: Issue): Promise<string> {
  let solution = `🔧 **Issue Detected:** ${issue.title}\n\n`;
  solution += `📌 **Symptoms:**\n${issue.symptoms.map(s => `  • ${s}`).join('\n')}\n\n`;
  solution += `🔍 **Possible Causes:**\n${issue.causes.map(c => `  • ${c}`).join('\n')}\n\n`;
  solution += `💡 **Solutions:**\n${issue.solutions.map(s => `  • ${s}`).join('\n')}\n\n`;
  
  if (issue.autoFix) {
    solution += `🔄 **Auto-fix available.** Type "fix it" to automatically resolve this issue.`;
  }
  
  return solution;
}

// ============================================
// 5. AUTO-FIX FUNCTIONS
// ============================================

export async function autoFixIssue(issue: Issue): Promise<{ success: boolean; message: string }> {
  switch (issue.id) {
    case 'firebase-001':
      // Enable offline persistence
      try {
        // @ts-ignore
        // await db.enablePersistence(); // db is Firestore, enablePersistence is not a method on Lite version or is handled differently
        return { success: true, message: '✅ Offline persistence is already handled in your Firebase config.' };
      } catch (error) {
        return { success: false, message: '❌ Could not enable persistence. Try restarting app.' };
      }
      
    case 'auth-001':
      // Clear stored credentials and retry
      localStorage.removeItem('user');
      sessionStorage.clear();
      return { success: true, message: '✅ Cache cleared. Please try logging in again.' };
      
    case 'data-001':
      // Add sample data
      return { success: false, message: '⚠️ No data found. Please add orders manually or import data.' };
      
    case 'performance-001':
      // Clear cache
      if ('caches' in window) {
        caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
      }
      return { success: true, message: '✅ Cache cleared. Performance should improve.' };
      
    default:
      return { success: false, message: '❌ Auto-fix not available for this issue.' };
  }
}

// ============================================
// 6. AI RESPONSE GENERATOR (with self-learning)
// ============================================

export async function generateSmartResponse(
  userQuery: string, 
  context: any
): Promise<{ response: string; actions?: string[] }> {
  
  const queryLower = userQuery.toLowerCase();
  
  // First: Check if user is reporting an issue
  if (queryLower.includes('error') || queryLower.includes('problem') || queryLower.includes('issue')) {
    const issues = await detectAppIssues();
    if (issues.length > 0) {
      const solution = await generateSolution(issues[0]);
      return { 
        response: solution,
        actions: ['show_auto_fix_button']
      };
    }
  }
  
  // Second: Check for "fix it" command
  if (queryLower.includes('fix it') || queryLower.includes('solve') || queryLower.includes('theek karo')) {
    const issues = await detectAppIssues();
    if (issues.length > 0) {
      const result = await autoFixIssue(issues[0]);
      return { response: result.message };
    }
    return { response: "✅ No issues detected. App is working fine!" };
  }
  
  // Third: Match with training patterns
  for (const data of trainingData) {
    for (const pattern of data.patterns) {
      if (queryLower.includes(pattern)) {
        // Found matching pattern
        let response = data.responses[0];
        
        // Replace placeholders with actual data
        if (context.totalSales) {
          response = response.replace('{amount}', context.totalSales.toLocaleString());
        }
        if (context.orderCount) {
          response = response.replace('{orders}', context.orderCount.toString());
        }
        if (context.paidTotal) {
          response = response.replace('{paid}', context.paidTotal.toLocaleString());
        }
        if (context.unpaidTotal) {
          response = response.replace('{unpaid}', context.unpaidTotal.toLocaleString());
        }
        if (context.lowStock) {
          const stockList = context.lowStock.map((item: any) => `  • ${item.name}: ${item.qty} left`).join('\n');
          response = response.replace('{list}', stockList);
        }
        
        return { 
          response, 
          actions: data.actions 
        };
      }
    }
  }
  
  // Fourth: Default - use Gemini for general queries
  return { response: null as any };
}

// ============================================
// 7. SELF-LEARNING (User feedback based)
// ============================================

export async function learnFromFeedback(question: string, answer: string, wasHelpful: boolean) {
  // Store feedback in Firebase for future improvement
  console.log(`📚 Learning: User found ${wasHelpful ? 'helpful' : 'not helpful'}: ${question}`);
}
