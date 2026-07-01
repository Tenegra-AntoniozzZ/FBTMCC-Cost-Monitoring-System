
export const SERVER_IP = import.meta.env.VITE_SERVER_IP || 'localhost';

export const API_URL = `http://${SERVER_IP}:3001/api`;

export const INITIAL_PROJECTS = [
  
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