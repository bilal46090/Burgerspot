
import { GoogleGenAI } from "@google/genai";
import { MENU, CATEGORIES } from "../constants";

let quotaCoolOffUntil = 0;

export async function getSmartSuggestions(currentCart: any[]) {
  if (currentCart.length === 0) return "Add some items to get smart suggestions!";

  if (Date.now() < quotaCoolOffUntil) {
    return "Would you like to try our special Loaded Fries today?";
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return "Check out our special deals today!";
  }

  // Initialize inside the function to ensure we use the latest injected API key
  const ai = new GoogleGenAI({ apiKey });
  
  const cartSummary = currentCart.map(item => `${item.qty}x ${item.name}`).join(", ");
  
  try {
    let lastError: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `The customer has these items in their cart: ${cartSummary}. 
          Looking at our menu categories: ${CATEGORIES.join(", ")}, 
          suggest 1-2 items that would complement their order perfectly as an upsell. 
          Keep it very short (max 12 words) and persuasive. 
          Menu references: ${MENU.map(m => m.name).join(", ")}.`
        });

        return response.text;
      } catch (err: any) {
        lastError = err;
        console.warn(`Gemini Suggestion attempt ${attempt + 1} failed:`, err);
        
        // Handle specific platform errors
        const errStr = JSON.stringify(err);
        if (errStr.includes('RESOURCE_EXHAUSTED')) break;
        if (errStr.includes('PERMISSION_DENIED')) {
          console.error("Gemini API Permission Denied. Check API key context.");
          break;
        }
        if (errStr.includes('500') || errStr.includes('Rpc failed')) {
          if (attempt === 1) break; // Don't retry more than once for 500
        }

        if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
      }
    }
    throw lastError;
  } catch (error: any) {
    // Graceful fallback for API errors (like 429 quota, 500 RPC, or 403 Permission)
    const errString = JSON.stringify(error);
    
    // Log as warning if it's a known transient or handled error
    if (errString.includes('500') || errString.includes('Rpc failed') || errString.includes('RESOURCE_EXHAUSTED')) {
      console.warn("Gemini Suggestion (Transient/Quota):", errString);
    } else {
      console.error("Gemini Suggestion Error (Caught):", error);
    }
    
    const isQuotaError = 
      error?.status === 429 || 
      error?.code === 429 ||
      errString.includes('429') || 
      errString.includes('RESOURCE_EXHAUSTED');

    if (isQuotaError) {
      quotaCoolOffUntil = Date.now() + 5 * 60 * 1000; // 5 minute cool-off
      return "Main thora busy hoon, magar apka order zabardast hai! Try our Loaded Fries?";
    }

    if (errString.includes('PERMISSION_DENIED') || errString.includes('403')) {
      return "Special Chef's Choice: Add our signature Fries for a complete meal?";
    }

    return "Would you like to try our special Loaded Fries today?";
  }
}
