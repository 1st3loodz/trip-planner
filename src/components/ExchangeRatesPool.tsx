"use client";

import React, { useState } from "react";
import { Trip, Currency, ExchangeRecord, CURRENCY_META } from "@/types/trip";
import { useTrips } from "@/contexts/TripContext";
import { generateId } from "@/lib/utils";

interface ExchangeRatesPoolProps {
  trip: Trip;
}

export default function ExchangeRatesPool({ trip }: ExchangeRatesPoolProps) {
  const { updateTrip } = useTrips();
  const [open, setOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [formCur, setFormCur] = useState<Currency>("JPY");
  const [formRate, setFormRate] = useState("");
  const [formLabel, setFormLabel] = useState("");

  const records = trip.exchange_records || [];

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormRate("");
    setFormLabel("");
    setDeleteConfirmId(null);
  };

  const handleEditClick = (record: ExchangeRecord) => {
    setEditingId(record.id);
    setFormCur(record.currency as Currency);
    setFormRate(record.rate.toString());
    setFormLabel(record.label);
    setIsAdding(true);
    setDeleteConfirmId(null);
  };

  const handleSave = async () => {
    if (!formRate) return;
    const rateNum = parseFloat(formRate);
    if (isNaN(rateNum) || rateNum <= 0) return;

    if (editingId) {
      const updatedRecords = records.map(r => 
        r.id === editingId 
          ? { ...r, currency: formCur, rate: rateNum, label: formLabel || "Exchange" }
          : r
      );
      await updateTrip(trip.id, { exchange_records: updatedRecords });
    } else {
      const newRecord: ExchangeRecord = {
        id: generateId(),
        currency: formCur,
        rate: rateNum,
        label: formLabel || "Exchange",
        date: new Date().toISOString(),
      };
      await updateTrip(trip.id, {
        exchange_records: [...records, newRecord]
      });
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await updateTrip(trip.id, {
      exchange_records: records.filter(r => r.id !== id)
    });
    setDeleteConfirmId(null);
  };

  return (
    <div className="mb-5 border-2 border-stone-400 bg-[#fdfbf7] dark:border-[#54463d] dark:bg-[#28211d]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-100 dark:hover:bg-[#362d28]"
      >
        <span className="flex h-7 w-7 items-center justify-center border-2 border-stone-300 bg-[#f5eed7] font-pixel text-xs dark:border-[#54463d] dark:bg-[#1e1815]">
          💱
        </span>
        <div className="flex-1 min-w-0">
          <span className="font-pixel text-[9px] uppercase tracking-wider text-stone-800 dark:text-[#fdfbf7]">
            Trip Currency Exchange Pool
          </span>
          <span className="ml-2 font-mono text-[10px] text-stone-500 dark:text-stone-400">
            {records.length} saved rate{records.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span className={`font-mono text-xs text-stone-500 transition-transform duration-200 dark:text-stone-400 ${open ? "rotate-90" : ""}`}>▶</span>
      </button>

      {open && (
        <div className="border-t-2 border-stone-200 px-4 py-4 dark:border-[#54463d]">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-pixel text-[10px] uppercase text-stone-700 dark:text-stone-300">Logged Exchange Rates</h4>
            <button
              onClick={() => {
                if (isAdding) resetForm();
                else setIsAdding(true);
              }}
              className="bg-[#4a7c59] text-white px-3 py-1.5 font-pixel text-[8px] uppercase tracking-wider hover:bg-[#3b6647] transition-colors"
            >
              {isAdding ? "Cancel" : "+ เพิ่มเรทแลกเงิน"}
            </button>
          </div>

          {isAdding && (
            <div className="mb-4 bg-stone-100 dark:bg-[#1e1815] p-3 border-2 border-stone-300 dark:border-stone-600 grid grid-cols-1 gap-3 sm:grid-cols-4 items-end">
              <div>
                <label className="block font-pixel text-[8px] text-stone-500 mb-1">Currency</label>
                <select 
                  value={formCur} 
                  onChange={e => setFormCur(e.target.value as Currency)}
                  className="w-full font-mono text-xs p-2 border-2 border-stone-300 bg-white dark:bg-[#28211d] dark:border-stone-600 dark:text-white"
                >
                  {Object.keys(CURRENCY_META).filter(c => c !== 'THB').map(c => (
                    <option key={c} value={c}>{CURRENCY_META[c as Currency].flag} {c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-pixel text-[8px] text-stone-500 mb-1">Rate (THB / 1 unit)</label>
                <input 
                  type="number" step="any"
                  value={formRate} onChange={e => setFormRate(e.target.value)}
                  placeholder="e.g. 0.2091"
                  className="w-full font-mono text-xs p-2 border-2 border-stone-300 bg-white dark:bg-[#28211d] dark:border-stone-600 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-pixel text-[8px] text-stone-500 mb-1">Label</label>
                <input 
                  type="text"
                  value={formLabel} onChange={e => setFormLabel(e.target.value)}
                  placeholder="e.g. แลก Superrich รอบ 1"
                  className="w-full font-mono text-xs p-2 border-2 border-stone-300 bg-white dark:bg-[#28211d] dark:border-stone-600 dark:text-white"
                />
              </div>
              <button 
                onClick={handleSave}
                className="bg-stone-800 text-white font-pixel text-[9px] uppercase p-2 border-2 border-stone-800 hover:bg-stone-700 dark:bg-stone-200 dark:text-stone-900 dark:border-stone-200"
              >
                Save
              </button>
            </div>
          )}

          {records.length === 0 ? (
            <p className="text-center font-mono text-xs text-stone-400 py-4 italic">No exchange rates logged yet.</p>
          ) : (
            <div className="space-y-2">
              {records.map(record => (
                <div key={record.id} className="flex items-center justify-between bg-white dark:bg-[#362d28] border border-stone-300 dark:border-stone-600 p-3">
                  <div className="flex flex-col">
                    <span className="font-mono text-sm font-bold text-stone-800 dark:text-stone-200">
                      {CURRENCY_META[record.currency as Currency]?.flag} 1 {record.currency} = {record.rate} THB
                    </span>
                    <span className="font-pixel text-[8px] text-stone-500 mt-1 uppercase tracking-widest">{record.label}</span>
                  </div>

                  {deleteConfirmId === record.id ? (
                    <div className="flex flex-col items-end gap-2 bg-red-50 dark:bg-red-950 p-2 border border-red-200 dark:border-red-800 rounded">
                      <div className="text-right">
                        <h5 className="font-pixel text-[10px] text-red-700 dark:text-red-400">ยืนยันการลบเรทแลกเงิน</h5>
                        <p className="font-mono text-[9px] text-red-600 dark:text-red-300 mt-1">
                          คุณแน่ใจหรือไม่ว่าต้องการลบรายการเรทแลกเงินนี้? การดำเนินการนี้ไม่สามารถยกเลิกได้
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setDeleteConfirmId(null)} className="font-pixel text-[9px] px-2 py-1 bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-stone-200">
                          ยกเลิก (Cancel)
                        </button>
                        <button onClick={() => handleDelete(record.id)} className="font-pixel text-[9px] px-2 py-1 bg-red-600 text-white hover:bg-red-700">
                          ลบรายการ (Delete)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => handleEditClick(record)} className="text-stone-500 hover:text-stone-700 dark:text-stone-400 font-pixel text-[10px] px-2 py-1">
                        ✏️ Edit
                      </button>
                      <button onClick={() => setDeleteConfirmId(record.id)} className="text-red-500 hover:text-red-700 font-pixel text-[10px] px-2 py-1">
                        🗑️ Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
