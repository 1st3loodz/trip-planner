import { Trip, Expense } from "@/types/trip";

export const PARTICIPANTS = [
  { id: "alice",  name: "Alice",  color: "bg-violet-500"  },
  { id: "bob",    name: "Bob",    color: "bg-sky-500"     },
  { id: "carol",  name: "Carol",  color: "bg-rose-500"    },
  { id: "david",  name: "David",  color: "bg-teal-500"    },
  { id: "emma",   name: "Emma",   color: "bg-fuchsia-500" },
  { id: "frank",  name: "Frank",  color: "bg-amber-500"   },
  { id: "grace",  name: "Grace",  color: "bg-lime-500"    },
  { id: "henry",  name: "Henry",  color: "bg-cyan-500"    },
  { id: "iris",   name: "Iris",   color: "bg-orange-500"  },
  { id: "james",  name: "James",  color: "bg-pink-500"    },
];

const ALL = PARTICIPANTS.map((p) => p.id);
const ev = (n: number) => PARTICIPANTS.filter((_, i) => i < n).map((p) => p.id);

export const SEED_EXPENSES: Expense[] = [
  {
    id: "e1",
    description: "Hotel check-in — The Orchid Hotel (7 nights)",
    amount: 9800, currency: "CNY", category: "accommodation", paidById: "alice",
    date: "2024-10-01",
    splits: ALL.map((id) => ({ participantId: id, amount: 980 })),
    createdAt: "2024-10-01T17:00:00Z",
  },
  {
    id: "e2",
    description: "Airport Express Train — PEK to Dongzhimen",
    amount: 3500, currency: "CNY", category: "transportation", paidById: "bob",
    date: "2024-10-01",
    splits: ALL.map((id) => ({ participantId: id, amount: 350 })),
    createdAt: "2024-10-01T15:00:00Z",
  },
  {
    id: "e3",
    description: "Welcome Dinner — Siji Minfu Roast Duck",
    amount: 2400, currency: "CNY", category: "food", paidById: "carol",
    date: "2024-10-01",
    splits: ev(6).map((id) => ({ participantId: id, amount: 400 })),
    createdAt: "2024-10-01T19:30:00Z",
  },
  {
    id: "e4",
    description: "Forbidden City Tickets (all 10)",
    amount: 600, currency: "CNY", category: "entrance", paidById: "david",
    date: "2024-10-02",
    splits: ALL.map((id) => ({ participantId: id, amount: 60 })),
    createdAt: "2024-10-02T10:30:00Z",
  },
  {
    id: "e5",
    description: "Great Wall Cable Car + Toboggan (group of 6)",
    amount: 1020, currency: "CNY", category: "entrance", paidById: "emma",
    date: "2024-10-03",
    splits: ev(6).map((id) => ({ participantId: id, amount: 170 })),
    createdAt: "2024-10-03T09:00:00Z",
  },
  {
    id: "e6",
    description: "Lunch at Mutianyu village",
    amount: 2700, currency: "CNY", category: "food", paidById: "frank",
    date: "2024-10-03",
    splits: ALL.map((id) => ({ participantId: id, amount: 270 })),
    createdAt: "2024-10-03T13:00:00Z",
  },
  {
    id: "e7",
    description: "Wangfujing Night Market (street food run)",
    amount: 8500, currency: "THB", category: "food", paidById: "grace",
    date: "2024-10-02",
    splits: [
      { participantId: "grace", amount: 2125 },
      { participantId: "henry", amount: 2125 },
      { participantId: "iris",  amount: 2125 },
      { participantId: "james", amount: 2125 },
    ],
    createdAt: "2024-10-02T19:00:00Z",
  },
  {
    id: "e8",
    description: "Silk Road souvenir shopping — Silk Market",
    amount: 15000, currency: "THB", category: "shopping", paidById: "henry",
    date: "2024-10-04",
    splits: [
      { participantId: "alice", amount: 3000 },
      { participantId: "emma",  amount: 3000 },
      { participantId: "grace", amount: 3000 },
      { participantId: "henry", amount: 3000 },
      { participantId: "iris",  amount: 3000 },
    ],
    createdAt: "2024-10-04T14:00:00Z",
  },
  {
    id: "e9",
    description: "Haidilao Hot Pot — splurge night",
    amount: 28000, currency: "JPY", category: "food", paidById: "iris",
    date: "2024-10-03",
    splits: ALL.map((id) => ({ participantId: id, amount: 2800 })),
    createdAt: "2024-10-03T19:30:00Z",
  },
  {
    id: "e10",
    description: "Bullet train BJS → SHA (all 10 seats)",
    amount: 850, currency: "USD", category: "transportation", paidById: "james",
    date: "2024-10-05",
    splits: ALL.map((id) => ({ participantId: id, amount: 85 })),
    createdAt: "2024-10-05T07:00:00Z",
  },
];

export const MOCK_TRIP: Trip = {
  id: "trip-china-2024",
  title: "Trip to China",
  destination: "Beijing & Shanghai, China",
  startDate: "2024-10-01",
  endDate: "2024-10-08",
  status: "next",
  participants: PARTICIPANTS,
  expenses: SEED_EXPENSES,
  days: [
    {
      dayNumber: 1, date: "2024-10-01", label: "Arrival Day",
      activities: [
        { id: "a1", time: "08:30", title: "Depart — Suvarnabhumi Airport", description: "Check in at Counter G, Terminal 2. Arrive 2 hrs early.", transportationNote: "Flight TG614 · BKK → PEK", category: "flight" },
        { id: "a2", time: "14:45", title: "Arrive — Beijing Capital Airport (PEK)", description: "Clear immigration & collect bags at Carousel 8. Meet at Exit 3.", transportationNote: "Airport Express → Dongzhimen Station", category: "transport" },
        { id: "a3", time: "17:00", title: "Check in — The Orchid Hotel", description: "Deluxe doubles + single rooms · Hutong district. Keys at reception.", location: "65 Baochao Hutong, Gulou East St, Beijing", category: "hotel" },
        { id: "a4", time: "19:30", title: "Welcome Dinner — Siji Minfu Roast Duck", description: "Legendary Peking Duck. Reservation for 10 under 'Alice'.", location: "32 Dengshikou St, Dongcheng District", category: "food" },
      ],
    },
    {
      dayNumber: 2, date: "2024-10-02", label: "The Imperial City",
      activities: [
        { id: "a5", time: "07:00", title: "Breakfast at Hotel", description: "Buffet included — try the congee and char siu.", category: "food" },
        { id: "a6", time: "09:00", title: "Tiananmen Square", description: "Morning visit before crowds arrive. Flag-raising ceremony at dawn.", location: "Tiananmen Square, Dongcheng, Beijing", transportationNote: "Walk from hotel (~15 min)", category: "sightseeing" },
        { id: "a7", time: "10:30", title: "Forbidden City (Palace Museum)", description: "Pre-booked tickets via WeChat. Allow 3–4 hrs. Audio guide recommended.", location: "4 Jingshan Front St, Dongcheng, Beijing", transportationNote: "Walk from Tiananmen (~3 min)", category: "sightseeing" },
        { id: "a8", time: "14:30", title: "Lunch — Lost Heaven on the Bund", description: "Yunnan cuisine · rooftop terrace with Forbidden City views.", location: "Near Wangfujing, Dongcheng", category: "food" },
        { id: "a9", time: "16:00", title: "Jingshan Park & Drum Tower", description: "Panoramic views of the Forbidden City from Coal Hill.", location: "Jingshan Front St, Xicheng, Beijing", transportationNote: "Walk from Forbidden City (~5 min)", category: "sightseeing" },
        { id: "a10", time: "19:00", title: "Night Market — Wangfujing Snack Street", description: "Street food extravaganza. Try scorpion skewers if you dare!", transportationNote: "Subway Line 1 → Wangfujing Station", category: "food" },
      ],
    },
    {
      dayNumber: 3, date: "2024-10-03", label: "Great Wall Day",
      activities: [
        { id: "a11", time: "06:30", title: "Early Departure to Mutianyu", description: "Pack snacks & water. Dress in layers — cooler at altitude.", transportationNote: "Private van (pre-arranged) · ~2 hrs", category: "transport" },
        { id: "a12", time: "09:00", title: "The Great Wall — Mutianyu Section", description: "Cable car up, toboggan ride down. Approx. 2–3 hrs hiking on the wall.", location: "Mutianyu, Huairou, Beijing", category: "sightseeing" },
        { id: "a13", time: "13:00", title: "Lunch at Mutianyu Village", description: "Local restaurant near the base station.", category: "food" },
        { id: "a14", time: "15:30", title: "Return to Beijing", description: "Rest & freshen up at hotel. Free time until dinner.", transportationNote: "Same private van · ~2 hrs", category: "transport" },
        { id: "a15", time: "19:30", title: "Dinner — Haidilao Hot Pot", description: "Splurge night! Famous for table-side service and hand-pulled noodle show.", location: "Haidilao, Wangfujing branch", category: "food" },
      ],
    },
    {
      dayNumber: 4, date: "2024-10-04", label: "Shopping & Hutongs",
      activities: [
        { id: "a16", time: "10:00", title: "Silk Market — Xiushui Street", description: "Bargain hunting for silk scarves, clothing & souvenirs. Bring cash!", location: "Xiushui East St, Chaoyang, Beijing", transportationNote: "Subway Line 1 → Yonganli Station", category: "shopping" },
        { id: "a17", time: "14:00", title: "Hutong Rickshaw Tour", description: "90-minute guided rickshaw tour through Beijing's historic alleys.", location: "Shichahai Hutong, Xicheng District", transportationNote: "Taxi from Silk Market (~20 min)", category: "sightseeing" },
        { id: "a18", time: "18:00", title: "Rooftop Bar — NUO Hotel", description: "Sundowner cocktails with a panoramic Beijing skyline view.", location: "NUO Hotel, Chaoyang District", category: "free" },
      ],
    },
    {
      dayNumber: 5, date: "2024-10-05", label: "Beijing → Shanghai",
      activities: [
        { id: "a19", time: "07:00", title: "Check out & Head to Beijing South Station", description: "Luggage storage at hotel until 12:00. Check-out by 11:00.", transportationNote: "Subway Line 4 → Beijing South Station", category: "transport" },
        { id: "a20", time: "09:00", title: "Bullet Train G11 — Beijing South → Shanghai Hongqiao", description: "4.5 hrs · Standard class. Grab breakfast at the station.", transportationNote: "CRH High-Speed Rail · 300 km/h", category: "flight" },
        { id: "a21", time: "13:30", title: "Arrive Shanghai Hongqiao", description: "Transfer to hotel. Explore The Bund in the afternoon.", transportationNote: "Metro Line 2 → People's Square", category: "transport" },
      ],
    },
  ],
};
