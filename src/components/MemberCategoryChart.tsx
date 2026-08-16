"use client";

import { useMemo, useState } from "react";
import { Expense, ExpenseCategory, EXPENSE_CATEGORY_META, Participant } from "@/types/trip";
import { useCurrency } from "@/contexts/CurrencyContext";
import { convertToBase, formatBase, getConvertedAmountTHB } from "@/lib/currency";
import { resolvePayerId } from "@/lib/settlement";

// Category hex colors for the SVG segments (Cozy Theme)
const CATEGORY_HEX: Record<ExpenseCategory, string> = {
  accommodation: "#c2410c", // orange-700
  transportation: "#4a7c59", // custom green
  food:           "#b45309", // amber-700
  entrance:       "#0f766e", // teal-700
  shopping:       "#be185d", // pink-700
};

interface MemberCategoryChartProps {
  memberId: string;
  memberName: string;
  expenses: Expense[];
  participants: Participant[];
  customCategories?: { id: string; label: string; emoji: string; color?: string }[];
}

// ── SVG donut helpers ──────────────────────────────────────────────────────

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

export default function MemberCategoryChart({ memberId, memberName, expenses, participants, customCategories = [] }: MemberCategoryChartProps) {
  const { baseCurrency, rates } = useCurrency();
  const [hovered, setHovered] = useState<ExpenseCategory | null>(null);

  // Compute category totals for this member (in base currency)
  const categoryTotals = useMemo(() => {
    const totals: Partial<Record<string, number>> = {};
    for (const exp of expenses) {
      const cat = exp?.category?.trim() || "other";
      const actualPaidById = resolvePayerId(exp, participants);
      
      if (exp?.isExcluded) {
        if (actualPaidById === memberId) {
          const base = getConvertedAmountTHB(exp);
          totals[cat] = (totals[cat] ?? 0) + base;
        }
        continue;
      }
      const split = (exp?.splits || []).find((s) => s.participantId === memberId);
      if (!split) continue;
      
      const isLegacy = exp?.foreignAmount === undefined && exp?.currency !== baseCurrency;
      const base = isLegacy ? convertToBase(Number(split.amount) || 0, exp?.currency || baseCurrency, rates) : Number(split.amount);
      
      totals[cat] = (totals[cat] ?? 0) + base;
    }
    return totals;
  }, [expenses, memberId, rates, baseCurrency]);

  const grandTotal: number = Object.values(categoryTotals).reduce<number>((s, v) => (s ?? 0) + (v ?? 0), 0);

  // Build segments
  const segments = useMemo(() => {
    let angle = 0;
    const allPresentCats = Array.from(new Set(expenses.filter(e => {
      const actualPaidById = resolvePayerId(e, participants);
      if (e?.isExcluded) return actualPaidById === memberId;
      const split = (e?.splits || []).find((s) => s.participantId === memberId);
      return actualPaidById === memberId || !!split;
    }).map(e => e?.category?.trim() || "other")));
    return allPresentCats
      .filter((cat) => (categoryTotals[cat] ?? 0) > 0)
      .map((cat) => {
        const amount = categoryTotals[cat] ?? 0;
        const pct    = amount / grandTotal;
        const seg    = { cat, amount, pct, start: angle, end: angle + pct * 360 };
        angle += pct * 360;
        return seg;
      });
  }, [categoryTotals, grandTotal, expenses, memberId]);

  if (grandTotal === 0) return null;

  const CX = 90, CY = 90, OR = 82, IR = 50;
  const hoveredSeg = segments.find((s) => s.cat === hovered);

  return (
    <div className="mb-5 overflow-hidden border-2 border-stone-400 bg-[#fdfbf7] dark:border-[#54463d] dark:bg-[#28211d]">
      <div className="border-b-2 border-stone-400 bg-[#f5eed7] px-4 py-2.5 dark:border-[#54463d] dark:bg-[#362d28]">
        <span className="font-pixel text-[9px] uppercase tracking-wider text-stone-800 dark:text-[#fdfbf7]">
          📊 {memberName}&apos;s Expense Breakdown by Category
        </span>
        <span className="ml-2 font-mono text-[10px] text-stone-500 dark:text-stone-400">in {baseCurrency}</span>
      </div>

      <div className="flex flex-col items-center gap-4 p-4 sm:flex-row sm:items-start">
        {/* SVG Donut */}
        <div className="shrink-0">
          <svg width={180} height={180} viewBox="0 0 180 180">
            {segments.map((seg) => {
              const color = CATEGORY_HEX[seg.cat as ExpenseCategory] || "#78716c";
              const isH   = hovered === seg.cat;
              return (
                <path
                  key={seg.cat}
                  d={donutArc(CX, CY, OR, IR, seg.start, seg.end)}
                  fill={color}
                  opacity={hovered && !isH ? 0.35 : 1}
                  style={{
                    transformOrigin: `${CX}px ${CY}px`,
                    transform: isH ? "scale(1.05)" : "scale(1)",
                    transition: "transform .2s, opacity .2s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={() => setHovered(seg.cat)}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })}
            {/* Center label */}
            <text x={CX} y={CY - 7} textAnchor="middle" fontSize="10" fontFamily="monospace" fontWeight="600" fill={hoveredSeg ? (CATEGORY_HEX[hoveredSeg.cat as ExpenseCategory] || "#78716c") : "#4a7c59"}>
              {hoveredSeg ? (EXPENSE_CATEGORY_META[hoveredSeg.cat as ExpenseCategory]?.label || customCategories.find(c=>c.id===hoveredSeg.cat)?.label || hoveredSeg.cat) : memberName}
            </text>
            <text x={CX} y={CY + 9} textAnchor="middle" fontSize="12" fontFamily="monospace" fontWeight="800" fill={hoveredSeg ? (CATEGORY_HEX[hoveredSeg.cat as ExpenseCategory] || "#78716c") : "#4a7c59"}>
              {hoveredSeg ? `${(Number(hoveredSeg.pct) || 0 * 100).toFixed(1)}%` : formatBase(grandTotal, baseCurrency)}
            </text>
            {hoveredSeg && (
              <text x={CX} y={CY + 24} textAnchor="middle" fontSize="8.5" fontFamily="monospace" fill="#78716c">
                {formatBase(Number(hoveredSeg.amount) || 0, baseCurrency)}
              </text>
            )}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex-1 w-full space-y-1.5">
          {segments
            .slice()
            .sort((a, b) => b.amount - a.amount)
            .map((seg) => {
              const customCat = customCategories.find(c => c.id === seg.cat);
              const m     = EXPENSE_CATEGORY_META[seg.cat as ExpenseCategory] || { label: customCat?.label || seg.cat, emoji: customCat?.emoji || "✨" };
              const color = CATEGORY_HEX[seg.cat as ExpenseCategory] || "#78716c";
              const isH   = hovered === seg.cat;
              return (
                <div
                  key={seg.cat}
                  className={`flex items-center gap-2 border-2 px-3 py-2 transition-all cursor-pointer ${isH ? "border-stone-800 bg-[#f5eed7] shadow-[2px_2px_0_#292524] dark:border-[#54463d] dark:bg-[#362d28] dark:shadow-[2px_2px_0_#1e1815]" : "border-transparent hover:border-stone-400 hover:bg-[#f5eed7] dark:hover:border-stone-600 dark:hover:bg-[#28211d]"}`}
                  onMouseEnter={() => setHovered(seg.cat as ExpenseCategory)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="h-2.5 w-2.5 shrink-0 border border-stone-800 dark:border-stone-900" style={{ backgroundColor: color }} />
                  <span className="flex-1 font-mono text-xs font-semibold text-stone-800 dark:text-[#fdfbf7] truncate max-w-[100px]">
                    {m.emoji} {m.label}
                  </span>
                  <div className="flex items-baseline gap-2 shrink-0">
                    <span className="font-mono text-[10px] text-stone-500 dark:text-stone-400">{(Number(seg.pct) * 100 || 0).toFixed(1)}%</span>
                    <span className="font-mono text-xs font-black text-stone-900 tabular-nums dark:text-[#fdfbf7]">
                      {formatBase(seg.amount, baseCurrency)}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
