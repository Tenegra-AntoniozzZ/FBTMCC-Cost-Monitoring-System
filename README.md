FBTMCC Cost Monitoring & Disbursement System

A modern, Local Area Network (LAN)-based web application designed to replace the company's manual and error-prone Excel workflow. This system unifies the encoding of financial receipts (Disbursements) and provides real-time budget tracking for active construction projects (Cost Monitoring).

✨ Key Features

🔐 Role-Based Access Control (RBAC):

Encoder: Has full access to create, edit, and post Disbursement Vouchers.

Project Engineer: Read-only access focused on Project Progress Costing and remaining budget.

CEO / Admin: Read-only access for overall financial health and ledger viewing.

⚡ Smart Voucher Entry System:

Automatic computation of 2% EWT (Expanded Withholding Tax) for Labor/Subcontractor categories.

Target CIB variance checker to prevent unbalanced entries.

Real-time CV# duplication detection.

📊 Excel-Like Ledger View:

Familiar spreadsheet layout featuring over 30 expense categories.

Multi-select month filtering and dynamic CV# search capabilities.

📈 Real-Time Cost Monitoring Dashboard:

Instant calculation of Contract Cost, Budget Limit (Net of VAT), Total Expenses, and Remaining Pondo.

🔒 Secure Local Deployment:

100% offline capability. Hosted entirely on the company's local server (LAN) for maximum financial data security.

🛠️ Technology Stack

Frontend: React.js (via Vite)

Styling: Tailwind CSS

Backend API: Node.js with Express.js

Database: SQLite3 (Local file-based database)

📋 Prerequisites

Before setting up the project, ensure the host computer (Server PC) has the following installed:

Node.js (LTS Version) - Download from nodejs.org

Git - Download from git-scm.com

🚀 Installation & Setup Guide

This system requires two separate terminal windows running simultaneously on the Server PC: one for the Backend (Database) and one for the Frontend (UI).

1. Identify the Server IP Address

Open Command Prompt on the Server PC.

Type ipconfig and press Enter.

Locate the IPv4 Address (e.g., 192.168.1.50). Save this IP address.

2. Setup the Backend (Database & API)

Open a terminal and navigate to the backend folder:

cd costmon-backend


Install the necessary backend dependencies:

npm install


Start the backend server:

node server.js


Note: The console should display "Local Network API Server running on port 3001". Leave this terminal open.

3. Setup the Frontend (React Web App)

Open a new terminal window and navigate to the frontend folder:

cd costmon-frontend


Install the necessary frontend dependencies:

npm install


Configure the Network IP:
Open src/utils/constants.js in your code editor. Locate the SERVER_IP variable and change it to the IPv4 address you obtained in Step 1.

// src/utils/constants.js
export const SERVER_IP = '192.168.1.50'; // Replace with your actual Server IPv4 Address


Start the frontend development server and expose it to the local network:

npm run dev -- --host


🌐 Network Access for Users (Encoders/Managers)

Users do not need to install anything on their computers. To access the system:

Ensure the user's device is connected to the same Office Wi-Fi/LAN as the Server PC.

Open any web browser (Chrome, Edge, Safari).

Type the Server's IP address followed by the frontend port (default is usually 5173).

Example: http://192.168.1.50:5173

📁 Folder Structure Overview

FBTMCC COST MON/
├── costmon-backend/                 # Node.js Express API
│   ├── costmon_local.db             # Auto-generated SQLite Database file
│   ├── package.json
│   └── server.js                    # Core API and Database logic
│
└── costmon-frontend/                # React.js UI
    ├── src/
    │   ├── components/              # Reusable UI components and Screens
    │   ├── utils/
    │   │   └── constants.js         # Network config and static category arrays
    │   ├── App.jsx                  # Main application routing and layout
    │   └── index.css                # Tailwind imports and custom scrollbar CSS
    ├── tailwind.config.js
    └── package.json


🗄️ Database Management & Backups

Because the system uses SQLite, the entire database is contained within a single file: costmon_local.db located inside the costmon-backend folder.

To Backup: Simply copy the costmon_local.db file and paste it into a secure flash drive or cloud storage.

To View/Edit Raw Data: Download the free application DB Browser for SQLite. Open the .db file using this software to manually view, edit, or delete records. (Warning: Ensure the backend server is stopped before making manual database edits to prevent file corruption).
