# TGBD CRM — Tour Guidance Sales & CRM System

A complete sales and customer relationship management system built for **Tour Guidance BD**. It manages customers, bookings, invoices, money receipts, vendor disbursements, operational expenses, employee sales attribution, and comprehensive profit reporting with a live Supabase backend.

---

## 🌟 Key Features

- **Executive Dashboard**: Real-time sales, expenses, and net profit with a seasonal target progress gauge and customer birthday greetings panel.
- **Customer Management**: Full 22-field customer directory with live lifetime metrics (Total Bookings, Sales, Paid, Due, Profit).
- **Invoice & Booking Engine**: Line-item builder with catalog lookup, travel date tracking, bank profile selector, and cascaded delete.
- **Due Invoices**: Dedicated ledger with 1-click **"Collect Due"** action pre-filling customer, invoice, and balance.
- **Today's Journey**: Departure tracker with *Today*, *Tomorrow*, and *Upcoming* filters, search, and printable passenger vouchers.
- **Money Receipts**: Sequential numbering (`MR-000001`), payment history, and printable receipt.
- **Vendor Payments**: Vendor master directory, individual payment records, and combined Full Vendor Payment Sheet.
- **Expense Tracking**: Grouped default category auto-seeding, custom categories, debit vouchers, and full statement.
- **Reports & Analytics**: Daily/Monthly Sales & Profit, Daily/Monthly Expenses, Profit & Margin Audit, Customer Lifetime Value, and Agent-scoped "My Sales".
- **Print System**: Isolated white letterhead print layout (hidden iframe + download fallback) with company logo, bank details, and signature.
- **Access Control**: Role-based access (`Admin`, `CustomerService`, `Agent`) with Supabase Auth and 20-min inactivity auto-logout.

---

## 🛠 Tech Stack

- **Frontend**: React 18, Vite, React Router v6
- **Styling**: Vanilla CSS (Custom Dark Navy `#0A0F1C` + Gold `#C9A24B` design system)
- **Backend & Auth**: Supabase (`@supabase/supabase-js`)
- **Typography**: Space Grotesk, Inter, JetBrains Mono

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/tourguidancebd/CRM.git
cd CRM
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for production
```bash
npm run build
```
