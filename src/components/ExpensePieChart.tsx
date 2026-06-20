"use client";

import { useState, useMemo } from "react";
import { Expense, Participant, CURRENCY_META } from "@/types/trip";
import { useCurrency } from "@/contexts/CurrencyContext";
import { convertToBase, formatBase } from "@/lib/currency";
import Avatar from "@/components/Avatar";

// Member hex colors
const MEMBER_HEX: Record<string, string> = {
  alice:  "#8b5cf6", bob:   "#0ea5e9", carol:  "#f43f5e", david: "#14b8a6",
  emma:   "#d946ef", frank: "#f59e0b", grace:  "#84cc16", henry: "#06b6d4",
  iris:   "#f97316", james: "#ec4899",
};

interface ExpensePieChartProps {
  expenses: Expense[];
  participants: Participant[];
}

function polarToXY(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function donutArc(cx: number, cy: number, OR: number, IR: number, s: number, e: number): string {
  const end = Math.min(e, s + 359.99);
  const [ox1, oy1] = polarToXY(cx, cy, OR, s);
  const [ox2, oy2] = polarToXY(cx, cy, OR, end);
  const [ix1, iy1] = polarToXY(cx, cy, IR, end);
  const [ix2, iy2] = polarToXY(cx, cy, IR, s);
  const lg = end - s > 180 ? 1 : 0;
  return `M ${ox1.toFixed(2)} ${oy1.toFixed(2)} A ${OR} ${OR} 0 ${lg} 1 ${ox2.toFixed(2)} ${oy2.toFixed(2)} L ${ix1.toFixed(2)} ${iy1.toFixed(2)} A ${IR} ${IR} 0 ${lg} 0 ${ix2.toFixed(2)} ${iy2.toFixed(2)} Z`;
}

export default function ExpensePieChart({ expenses, participants }: ExpensePieChartProps) {
  const { baseCurrency, rates } = useCurrency();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Member totals in base currency (cross-currency comparable)
  const memberTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const p of participants) totals[p.id] = 0;
    for (const exp of expenses) {
      for (const split of exp.splits) {
        totals[split.participantId] =
          (totals[split.participantId] ?? 0) + convertToBase(split.amount, exp.currency, rates);
      }
    }
    return totals;
  }, [expenses, participants, rates]);

  const grandTotal = Object.values(memberTotals).reduce((s, v) => s + v, 0);

  const segments = useMemo(() => {
    return participants
      .filter((p) => memberTotals[p.id] > 0)
      .reduce((acc, p) => {
        const amount = memberTotals[p.id];
        const pct = amount / grandTotal;
        const start = acc.length > 0 ? acc[acc.length - 1].end : 0;
        const end = start + pct * 360;
        acc.push({ id: p.id, name: p.name, amount, pct, start, end });
        return acc;
      }, [] as { id: string, name: string, amount: number, pct: number, start: number, end: number }[]);
  }, [participants, memberTotals, grandTotal]);

  const CX = 110, CY = 110, OR = 100, IR = 60;
  const cur = CURRENCY_META[baseCurrency];

  if (grandTotal === 0) return (
    <div className="border-2 border-stone-400 bg-[#fdfbf7] p-6 text-center dark:border-[#54463d] dark:bg-[#28211d]">
      <p className="font-mono text-sm text-stone-500 dark:text-stone-400">No expense data to chart yet.</p>
    </div>
  );

  const hovSeg = segments.find((s) => s.id === hoveredId);

  return (
    <div className="overflow-hidden border-2 border-stone-400 bg-[#fdfbf7] dark:border-[#54463d] dark:bg-[#28211d]">
      <div className="border-b-2 border-stone-400 bg-[#f5eed7] px-4 py-3 dark:border-[#54463d] dark:bg-[#362d28]">
        <h3 className="font-pixel text-[10px] uppercase text-stone-800 dark:text-[#fdfbf7]">Trip Expense Distribution</h3>
        <p className="font-mono text-[10px] text-stone-600 dark:text-stone-400 mt-1">
          All currencies converted to {cur.flag} {baseCurrency} — who's carrying the most?
        </p>
      </div>

      <div className="flex flex-col items-center gap-6 p-5 sm:flex-row sm:items-start">
        {/* Donut */}
        <div className="shrink-0">
          <svg width={220} height={220} viewBox="0 0 220 220">
            {segments.map((seg) => {
              const color = MEMBER_HEX[seg.id] ?? "#8b5cf6";
              const isH   = hoveredId === seg.id;
              return (
                <path
                  key={seg.id}
                  d={donutArc(CX, CY, OR, IR, seg.start, seg.end)}
                  fill={color}
                  opacity={hoveredId && !isH ? 0.35 : 1}
                  style={{ transformOrigin: `${CX}px ${CY}px`, transform: isH ? "scale(1.04)" : "scale(1)", transition: "transform .2s, opacity .2s", cursor: "pointer" }}
                  onMouseEnter={() => setHoveredId(seg.id)}
                  onMouseLeave={() => setHoveredId(null)}
                />
              );
            })}
            <text x={CX} y={CY - 8} textAnchor="middle" fontSize="11" fontFamily="monospace" fontWeight="600" fill={hovSeg ? (MEMBER_HEX[hovSeg.id] ?? "#8b5cf6") : "#4a7c59"}>
              {hovSeg ? hovSeg.name : `${cur.flag} ${baseCurrency}`}
            </text>
            <text x={CX} y={CY + 10} textAnchor="middle" fontSize="13" fontFamily="monospace" fontWeight="800" fill={hovSeg ? (MEMBER_HEX[hovSeg.id] ?? "#8b5cf6") : "#4a7c59"}>
              {hovSeg ? `${(hovSeg.pct * 100).toFixed(1)}%` : formatBase(grandTotal, baseCurrency)}
            </text>
            <text x={CX} y={CY + 26} textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#78716c">
              {hovSeg ? formatBase(hovSeg.amount, baseCurrency) : "total"}
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex-1 w-full space-y-1.5 mt-2">
          {segments
            .slice().sort((a, b) => b.amount - a.amount)
            .map((seg, rank) => {
              const color = MEMBER_HEX[seg.id] ?? "#8b5cf6";
              const p     = participants.find((x) => x.id === seg.id);
              const isH   = hoveredId === seg.id;
              return (
                <div
                  key={seg.id}
                  className={`flex items-center gap-2 border-2 px-3 py-2 cursor-pointer transition-all ${isH ? "border-stone-800 bg-[#f5eed7] shadow-[2px_2px_0_#292524] dark:border-[#54463d] dark:bg-[#362d28] dark:shadow-[2px_2px_0_#1e1815]" : "border-transparent hover:border-stone-400 hover:bg-[#f5eed7] dark:hover:border-stone-600 dark:hover:bg-[#28211d]"}`}
                  onMouseEnter={() => setHoveredId(seg.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <span className="w-4 text-center font-mono text-[10px] font-bold text-stone-500 dark:text-stone-500">{rank + 1}</span>
                  <div className="h-2.5 w-2.5 shrink-0 border border-stone-800 dark:border-stone-900" style={{ backgroundColor: color }} />
                  {p && <Avatar name={p.name} colorClass={p.color} size="xs" tooltip={false} />}
                  <span className="flex-1 font-mono text-xs font-semibold text-stone-800 dark:text-[#fdfbf7]">{seg.name}</span>
                  <div className="h-1.5 w-16 overflow-hidden border border-stone-400 bg-stone-200 dark:border-stone-700 dark:bg-[#1e1815]">
                    <div className="h-full" style={{ width: `${seg.pct * 100}%`, backgroundColor: color, transition: "width .4s" }} />
                  </div>
                  <span className="w-10 text-right font-mono text-[11px] font-bold tabular-nums" style={{ color }}>{(seg.pct * 100).toFixed(1)}%</span>
                  <span className="w-22 text-right font-mono text-[11px] tabular-nums text-stone-600 dark:text-stone-400">{formatBase(seg.amount, baseCurrency)}</span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
