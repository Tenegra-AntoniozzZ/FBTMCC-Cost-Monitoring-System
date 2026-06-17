// src/utils/constants.js
export const SERVER_IP = '192.168.2.124'; // Palitan ng inyong IPv4 address
export const API_URL = `http://${SERVER_IP}:3001/api`;

export const INITIAL_PROJECTS = [
  { id: '1', project_code: 'RF-105', project_name: 'Unitop Dasma', contract_cost: 800000, profit_percentage: 0.15 },
  { id: '2', project_code: 'W-308', project_name: 'Amazing Place QC', contract_cost: 1600000, profit_percentage: 0.20 },
  { id: '3', project_code: 'RF-126', project_name: 'WM Tanauan', contract_cost: 990000, profit_percentage: 0.15 },
  { id: '4', project_code: 'ADMIN', project_name: 'Shop/Admin 2026', contract_cost: 0, profit_percentage: 0 },
];

export const EXPENSE_CATEGORIES = [
  'Materials/Purchases', 'Labor /SUBCONTRACTOR', 'Gas & Oil', 'Office Supplies', 
  'Tools & Equipment', 'Office Furniture', 'Shop Supplies', 'Food/Meals', 
  'Transpo/Travel', 'Repair & Maint.', 'Parking', 'Toll Fee', 'Handling Fee', 
  'Communication', 'Miscellaneous / Sending Fee / Schematic', 'Light & Power', 
  'Water', 'Rental/Hotel Accom.', 'Representation', 'Salaries & Wages', 
  'Cash Advance/Payroll', 'Cash Advance/Project', 'Permit/Licenses', 
  'Insurance Expense/CONST', 'Insurance Expenses/CAR', 'SOP/Retainer Fee', 
  'Incentives Fee', 'Service Fee', 'Entrance'
];