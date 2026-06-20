# TripSync — Collaborative Trip Planner & Expense Splitter

> A premium Next.js + Tailwind CSS web application for planning group trips and splitting expenses fairly, day-by-day.

---

## 📸 Project Vision

TripSync lets a group of friends co-build a travel itinerary, assign activities to each day, log expenses, and see — at a glance — who paid what and who owes whom. The UI is built around a **daily timeline** that merges itinerary planning with expense tracking in a single, scannable view.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Fonts | Google Fonts – Inter |
| State | React `useState` (local, client-side) |
| Data | Mock data (Step 1) → Database in future steps |

---

## 🗂️ Project Structure

```
src/
├── app/
│   ├── globals.css             # Global styles, dark theme, scrollbar, animations
│   ├── layout.tsx              # Root layout with Inter font & SEO metadata
│   ├── page.tsx                # Home → redirects to demo trip
│   └── trip/
│       └── [id]/
│           └── page.tsx        # 🌟 Trip Detail Page (main feature)
│
├── components/
│   ├── TripHeader.tsx          # Hero header: title, dates, stats, participants
│   ├── DayCard.tsx             # Collapsible day section with date & total cost
│   ├── ActivityRow.tsx         # Single activity in the timeline (emoji, time, notes)
│   ├── ExpensePanel.tsx        # Inline expense breakdown: paid-by + split table
│   ├── ExpenseSummary.tsx      # Sidebar: per-person net balance + progress bars
│   ├── FilterBar.tsx           # Category filter pills (flight, food, etc.)
│   └── Avatar.tsx              # Participant avatar with initials & tooltip
│
├── data/
│   └── mockTrip.ts             # Full 3-day "Trip to China" demo dataset
│
├── lib/
│   └── utils.ts                # Formatters (currency, date), category metadata
│
└── types/
    └── trip.ts                 # TypeScript interfaces: Trip, DayPlan, ActivityItem, Expense, …
```

---

## 🧩 Component Architecture

### `TripHeader`
Renders the hero card at the top of the Trip Detail page.
- Trip title, destination chip, date range
- Stat cards: total expenses, activity count, traveler count
- Participant avatars with color-coded badges

### `DayCard`
A collapsible section for one travel day.
- Click header to expand/collapse all activities in that day
- Shows daily total expense and activity count in the header
- Wraps a vertical list of `ActivityRow` components

### `ActivityRow`
The core timeline row for a single activity.
- Emoji icon node + vertical connector line
- Time badge (purple monospace), category pill, "Has Expense" badge
- Description, location (📍), transportation note (🚌 purple chip)
- Expandable **expense details** toggle → renders `ExpensePanel`

### `ExpensePanel`
Inline expense breakdown that appears inside an `ActivityRow`.
- Shows expense label + total amount
- "Paid By" with avatar + name
- Per-person split: amount + **Paid ✓** (green) / **Owes** (red) badge

### `ExpenseSummary` *(Sidebar)*
Sticky sidebar showing the overall financial summary.
- Per person: total paid, total owes, net balance (+/−)
- Color-coded progress bar per participant
- Grand total at the bottom

### `FilterBar`
Category filter pills above the timeline.
- Filters: All, ✈️ Flight, 🏨 Hotel, 🍜 Food, 🏯 Sightseeing, 🚌 Transport, 🛍️ Shopping
- Shows activity count per category
- Active state highlighted in violet

### `Avatar`
Reusable avatar component.
- Renders initials inside a colored circle
- Size variants: `sm`, `md`, `lg`
- Hover tooltip showing full name

---

## 🎨 Design System

| Token | Value |
|---|---|
| Background | `#0a0a14` (deep navy) |
| Primary accent | Violet `#7c3aed` |
| Secondary accent | Sky blue |
| Success / Paid | Emerald `#34d399` |
| Danger / Owes | Rose `#fb7185` |
| Glassmorphism | `bg-white/[0.03-0.05]` + `backdrop-blur` |
| Border | `border-white/10` |
| Body font | Inter (Google Fonts) |

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to the demo Trip Detail page.

---

## 📍 Demo Data

The mock trip **"Trip to China"** spans 3 days with:
- **3 participants**: Alice (violet), Bob (sky), Carol (rose)
- **14 activities** across flights, hotels, sightseeing, transport, and food
- **12 expenses** with individual splits, showing paid/owes states

---

## 🗺️ Roadmap (Future Steps)

| Step | Feature |
|---|---|
| Step 2 | Backend API (Supabase / Prisma) — persist trips & expenses |
| Step 3 | Auth — Google OAuth, invite collaborators |
| Step 4 | Real-time collaboration (WebSockets / Supabase Realtime) |
| Step 5 | Settlement calculator — who pays whom to settle all debts |
| Step 6 | Mobile PWA — offline-first with service workers |
| Step 7 | Multi-currency support with live exchange rates |
| Step 8 | Export to PDF / share link |

---

## 📄 License

MIT © 2024 TripSync
