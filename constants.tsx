
import React from 'react';
import { Product, Addon, InventoryItem } from './types';

export const INITIAL_INVENTORY: InventoryItem[] = [
  { id: 'i-1', name: 'Zinger Patty', unit: 'Pcs', stock: 50, minStock: 10, packetPrice: 2500, packetSize: 20, costPerUnit: 125 },
  { id: 'i-2', name: 'Burger Bun', unit: 'Pcs', stock: 100, minStock: 20, packetPrice: 240, packetSize: 12, costPerUnit: 20 },
  { id: 'i-3', name: 'Garlic Mayo', unit: 'G', stock: 5000, minStock: 1000, packetPrice: 4500, packetSize: 5000, costPerUnit: 0.9 },
  { id: 'i-4', name: 'Lettuce', unit: 'G', stock: 2000, minStock: 500, packetPrice: 300, packetSize: 1000, costPerUnit: 0.3 },
  { id: 'i-5', name: 'Chicken Piece', unit: 'Pcs', stock: 80, minStock: 15, packetPrice: 6000, packetSize: 50, costPerUnit: 120 },
  { id: 'i-6', name: 'Wrap Tortilla', unit: 'Pcs', stock: 60, minStock: 10, packetPrice: 1500, packetSize: 30, costPerUnit: 50 },
  { id: 'i-7', name: 'Fries (Raw)', unit: 'Kg', stock: 20, minStock: 5, packetPrice: 1500, packetSize: 10, costPerUnit: 150 },
  { id: 'i-8', name: 'Cheese Slice', unit: 'Pcs', stock: 50, minStock: 10, packetPrice: 1500, packetSize: 30, costPerUnit: 50 },
];

export const CATEGORIES = [
  "All",
  "Burgers",
  "Injected Broast",
  "Wraps",
  "Roast",
  "Deals",
  "Beverages",
  "Extras",
];

export const MENU: Product[] = [
  // Burgers
  { id: "1", name: "ZINGER REGULAR", price: 270, category: "Burgers", ingredients: [{ ingredientId: 'i-1', quantity: 1 }, { ingredientId: 'i-2', quantity: 1 }, { ingredientId: 'i-3', quantity: 15 }, { ingredientId: 'i-4', quantity: 10 }] },
  { id: "2", name: "CRISPY PATTY", price: 250, category: "Burgers", ingredients: [{ ingredientId: 'i-1', quantity: 1 }, { ingredientId: 'i-2', quantity: 1 }, { ingredientId: 'i-3', quantity: 15 }] },
  { id: "3", name: "FILLET", price: 350, category: "Burgers", ingredients: [{ ingredientId: 'i-1', quantity: 1 }, { ingredientId: 'i-2', quantity: 1 }, { ingredientId: 'i-3', quantity: 20 }, { ingredientId: 'i-4', quantity: 15 }] },
  { id: "4", name: "TIKKA PATTY", price: 300, category: "Burgers", ingredients: [{ ingredientId: 'i-1', quantity: 1 }, { ingredientId: 'i-2', quantity: 1 }] },
  { id: "5", name: "TOWER PATTY", price: 550, category: "Burgers", ingredients: [{ ingredientId: 'i-1', quantity: 2 }, { ingredientId: 'i-2', quantity: 1 }, { ingredientId: 'i-3', quantity: 25 }] },
  { id: "6", name: "ZINGER PRATHA", price: 450, category: "Burgers", ingredients: [{ ingredientId: 'i-1', quantity: 1 }, { ingredientId: 'i-6', quantity: 1 }] },
  { id: "7", name: "ZINGER SHAWARMA", price: 350, category: "Wraps", ingredients: [{ ingredientId: 'i-1', quantity: 1 }, { ingredientId: 'i-6', quantity: 1 }] },
  { id: "8", name: "SPECIAL SHAWARMA", price: 400, category: "Wraps", ingredients: [{ ingredientId: 'i-1', quantity: 1 }, { ingredientId: 'i-6', quantity: 1 }, { ingredientId: 'i-3', quantity: 10 }] },
  { id: "9", name: "KABAB PRATHA", price: 250, category: "Wraps", ingredients: [{ ingredientId: 'i-6', quantity: 1 }] },
  { id: "10", name: "THUNDER WRAP", price: 550, category: "Wraps", ingredients: [{ ingredientId: 'i-1', quantity: 2 }, { ingredientId: 'i-6', quantity: 1 }] },
  { id: "11", name: "SHAWARMA PLATER", price: 600, category: "Wraps", ingredients: [{ ingredientId: 'i-1', quantity: 2 }, { ingredientId: 'i-6', quantity: 2 }] },
  
  // Broast & Roast
  { id: "20", name: "QUARTER BROAST", price: 600, category: "Injected Broast", ingredients: [{ ingredientId: 'i-5', quantity: 1 }] },
  { id: "21", name: "FULL BROAST", price: 2100, category: "Injected Broast", ingredients: [{ ingredientId: 'i-5', quantity: 4 }] },
  { id: "22", name: "HALF BROAST", price: 1100, category: "Injected Broast", ingredients: [{ ingredientId: 'i-5', quantity: 2 }] }, // Added Half for completeness
  
  // Fries & Sides
  { id: "30", name: "PLAIN FRIES L", price: 350, category: "Extras", ingredients: [{ ingredientId: 'i-7', quantity: 0.2 }] },
  { id: "31", name: "MASALA FRIES", price: 300, category: "Extras", ingredients: [{ ingredientId: 'i-7', quantity: 0.15 }] },
  { id: "32", name: "PLAIN FRIES S", price: 250, category: "Extras", ingredients: [{ ingredientId: 'i-7', quantity: 0.1 }] },
  { id: "33", name: "MAYO GARLIC FRIES", price: 600, category: "Extras", ingredients: [{ ingredientId: 'i-7', quantity: 0.2 }, { ingredientId: 'i-3', quantity: 20 }] },
  { id: "34", name: "PIZZA FRIES REGULAR", price: 500, category: "Extras", ingredients: [{ ingredientId: 'i-7', quantity: 0.2 }] },
  { id: "35", name: "5-NUGGETS", price: 300, category: "Extras" },
  { id: "36", name: "10-NUGGETS", price: 550, category: "Extras" },
  { id: "37", name: "10-WINGS", price: 550, category: "Extras" },
  { id: "38", name: "GARLIC MAYO DIP", price: 80, category: "Extras", ingredients: [{ ingredientId: 'i-3', quantity: 30 }] },
  { id: "39", name: "BUN EXTRA", price: 40, category: "Extras", ingredients: [{ ingredientId: 'i-2', quantity: 1 }] },
  { id: "40", name: "CHICKEN EXTRA", price: 70, category: "Extras", ingredients: [{ ingredientId: 'i-5', quantity: 0.5 }] },
  { id: "41", name: "COLESLAW", price: 100, category: "Extras" },

  // Beverages
  { id: "50", name: "REGULAR 350ML", price: 80, category: "Beverages" },
  { id: "51", name: "HALF LITTER", price: 130, category: "Beverages" },
  { id: "52", name: "1.5 LITER", price: 230, category: "Beverages" },

  // Deals
  { id: "60", name: "DEAL 1", price: 999, category: "Deals" },
  { id: "61", name: "DEAL 2", price: 999, category: "Deals" },
  { id: "62", name: "DEAL 3", price: 1100, category: "Deals" },
  { id: "63", name: "DEAL 4", price: 1400, category: "Deals" },
  { id: "64", name: "DEAL 5", price: 1400, category: "Deals" },
];

export const ADDONS: Addon[] = [
  { id: 'cheese', name: 'Extra Cheese', price: 50, ingredients: [{ ingredientId: 'i-8', quantity: 1 }] },
  { id: 'sauce', name: 'Extra Sauce', price: 30, ingredients: [{ ingredientId: 'i-3', quantity: 20 }] },
  { id: 'patty', name: 'Extra Patty', price: 150, ingredients: [{ ingredientId: 'i-1', quantity: 1 }] },
];
