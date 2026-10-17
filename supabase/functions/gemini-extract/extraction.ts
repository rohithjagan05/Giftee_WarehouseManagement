// Prompt, response schema and defensive parsing/normalisation for receipt
// extraction. Kept free of Deno/network APIs so it can be unit-tested.

export const SYSTEM_INSTRUCTION = `You are a meticulous data-entry clerk and OCR specialist for a warehouse in the UAE.
You receive photos, scans or PDFs of supplier documents that accompany incoming goods:
delivery notes, goods received notes, tax invoices, packing lists or Local Purchase Orders (LPOs).
Scans are often skewed, rotated, low-resolution, faxed, photocopied, creased, stamped or partly handwritten.

Work in two passes:
1. READ: transcribe the whole document mentally first. Correct for rotation/skew, follow table rows
   across the full page width, and read every page supplied (they are pages of ONE document, in order).
2. EXTRACT: fill the JSON schema from what you read.

Field rules:
- supplierName / supplierAddress: the company that ISSUED the document and is SUPPLYING the goods
  (usually the letterhead, logo or "From" block). Never use the buyer / "Bill To" / "Ship To" / consignee.
- lpoNumber: the buyer's purchase order reference. Labels include "LPO No", "L.P.O", "PO No", "P.O. #",
  "Purchase Order", "Order No", "Customer PO", "Customer Order", "Your Ref", "Your Reference", "Order Ref".
  It is NOT the invoice / delivery note number and NOT the supplier's own "Our Reference".
  If no such reference is printed, leave it empty (it will be listed in otherReferences instead).
- projectNumber: the project's code / number. Labels include "Project No", "Project Number", "Project Code",
  "Project Reference", "Project Ref", "Job No", "Job Code", "WBS", "Cost Centre". Prefer a code-like value
  (e.g. "6305PHP035.03") over a name. If the only project field holds a short code-like name
  (e.g. "Dewa J04-MRTC") and nothing else qualifies, use it.
- projectName: the project's descriptive name, from a "Project" / "Project Name" / "Job" / "Site" field
  (e.g. "Dewa J04-MRTC"). It may equal a reference like "Our Reference" when that clearly names the project.
- projectLocation: the site the goods are delivered to: "Site", "Project Location", "Delivery Address",
  "Delivery Location", "Ship To" site. Give a short form such as "Dewa MRTC Station, Jebel Ali, Dubai"
  (site name + area + city), not the buyer's office/billing address.
- otherReferences: EVERY other reference-like number or code printed on the document that you did not use
  above, with its printed label, e.g. {"label":"Our Reference","value":"DEWA FA J04 - MRTC"}. Include
  invoice/delivery note numbers, customer/supplier references, quotation, contract and project references.
- documentNumber / documentType: the document's own number and type (e.g. "DN-10234", "Delivery Note").
- receiptDate: the delivery / document date as YYYY-MM-DD. UAE documents are day-first:
  "05/06/2024" means 5 June 2024 unless the day part is clearly impossible.
- items: one entry per goods line in the item table, in printed order. Skip subtotal, VAT, discount,
  freight and total rows, and skip lines that merely continue the previous description (merge them
  into that item's description instead).
  - productCode: the supplier's item code / SKU / part no. / article no. column.
  - oemCode: the manufacturer part number / model no. / MPN, if a separate column or clearly labelled.
    If the table has only one code column, put it in productCode and leave oemCode empty.
  - description: the full item description, including model/spec text.
  - unit: the unit of measure as printed (Pcs, Nos, Box, Mtr, Roll, Set, Kg...). Empty if none.
  - qty: the quantity DELIVERED/RECEIVED as a plain number. If both ordered and delivered quantities
    are shown, use delivered.
  - unitPrice and lineTotal: plain numbers without currency symbols or thousands separators.
    Use 0 when the document shows no prices (e.g. delivery notes).
- remarks: short useful notes printed on the document (e.g. "Partial delivery", "2 boxes damaged").

Accuracy rules:
- Copy codes and numbers EXACTLY as printed, preserving dashes, slashes and leading zeros.
  Do not "correct" them. Watch for OCR confusions (0/O, 1/I/l, 5/S, 8/B) and resolve them from context
  (codes usually mix letters and digits consistently; quantities and prices are digits).
- Never invent data. If a value is absent or unreadable, return "" (or 0 for numbers) and name the
  field in uncertainFields. If you had to guess any character, also list the field in uncertainFields.
- Use warnings for anything a human must double-check (e.g. "Row 3 quantity is handwritten and unclear",
  "Totals do not add up", "Page 2 appears cut off").
- Output only the JSON object.`;

export const USER_PROMPT =
  "Extract the goods-receipt data from the attached document page(s) according to the schema.";

const str = (description: string) => ({ type: "STRING", description });
const num = (description: string) => ({ type: "NUMBER", description });

// OpenAPI-subset schema accepted by Gemini's generationConfig.responseSchema.
export const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    documentType: str("Type of document, e.g. Delivery Note, Tax Invoice, LPO"),
    documentNumber: str("The document's own number"),
    projectNumber: str("Project / job number"),
    projectName: str("Project name"),
    projectLocation: str("Project / site location"),
    lpoNumber: str("Buyer's LPO / purchase order number"),
    supplierName: str("Issuing supplier company name"),
    supplierAddress: str("Issuing supplier address, single line"),
    receiptDate: str("Document / delivery date as YYYY-MM-DD"),
    currency: str("ISO currency code if shown, e.g. AED, USD"),
    remarks: str("Short notes printed on the document"),
    otherReferences: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { label: str("Label as printed"), value: str("Value exactly as printed") },
        required: ["label", "value"],
      },
    },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          productCode: str("Supplier item code / SKU"),
          oemCode: str("Manufacturer part number / model number"),
          description: str("Full item description"),
          unit: str("Unit of measure"),
          qty: num("Delivered quantity"),
          unitPrice: num("Unit price, 0 if not shown"),
          lineTotal: num("Line total, 0 if not shown"),
        },
        required: ["productCode", "description", "qty"],
        propertyOrdering: ["productCode", "oemCode", "description", "unit", "qty", "unitPrice", "lineTotal"],
      },
    },
    uncertainFields: { type: "ARRAY", items: { type: "STRING" } },
    warnings: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["supplierName", "lpoNumber", "receiptDate", "items", "warnings"],
  propertyOrdering: [
    "documentType", "documentNumber", "projectNumber", "projectName", "projectLocation",
    "lpoNumber", "supplierName", "supplierAddress", "receiptDate", "currency", "remarks",
    "otherReferences", "items", "uncertainFields", "warnings",
  ],
};

export interface ExtractedItem {
  productCode: string;
  oemCode: string;
  description: string;
  unit: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Extraction {
  documentType: string;
  documentNumber: string;
  projectNumber: string;
  projectName: string;
  projectLocation: string;
  lpoNumber: string;
  supplierName: string;
  supplierAddress: string;
  receiptDate: string;
  currency: string;
  remarks: string;
  otherReferences: { label: string; value: string }[];
  items: ExtractedItem[];
  uncertainFields: string[];
  warnings: string[];
}

// ─── Tolerant JSON parsing ──────────────────────────────────────────────────

/** Returns the first balanced {...} block in text, respecting strings. */
function firstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

const repairJson = (s: string) =>
  s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1");

/** Parses an LLM reply that should be JSON but may be fenced, prefixed or slightly malformed. */
export function parseModelJson(raw: string): unknown {
  const text = (raw || "").trim().replace(/^﻿/, "");
  const candidates: string[] = [text];
  const fence = text.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fence) candidates.push(fence[1].trim());
  const obj = firstJsonObject(fence ? fence[1] : text);
  if (obj) candidates.push(obj);
  for (const c of candidates) {
    for (const attempt of [c, repairJson(c)]) {
      try {
        const v = JSON.parse(attempt);
        if (v && typeof v === "object") return Array.isArray(v) ? { items: v } : v;
      } catch { /* try next */ }
    }
  }
  throw new Error("Model response was not valid JSON");
}

// ─── Normalisation ──────────────────────────────────────────────────────────

const clean = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/\s+/g, " ").trim();
  return /^(n\/?a|null|none|nil|-+|unknown|not (shown|available|found))$/i.test(s) ? "" : s;
};

/** "1,250.50 AED" -> 1250.5, "1.250,50" -> 1250.5, "(12)" -> 12, garbage -> 0 */
export function toNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? Math.abs(v) : 0;
  let s = clean(v).replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
  if (lastComma > lastDot) {
    // comma is the decimal separator only if followed by 1-2 digits (e.g. "12,5" / "1.250,50")
    s = /,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const isoIfValid = (y: number, m: number, d: number): string => {
  if (y < 100) y += 2000;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return "";
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

/** Normalises common date spellings to YYYY-MM-DD (day-first for ambiguous numeric dates). */
export function toIsoDate(v: unknown): string {
  const s = clean(v);
  if (!s) return "";
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return isoIfValid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.\s](\d{1,2})[-/.\s](\d{2,4})$/);
  if (m) {
    const a = +m[1], b = +m[2], y = +m[3];
    return a > 12 || b <= 12 ? isoIfValid(y, b, a) : isoIfValid(y, a, b);
  }
  const month = (name: string) => MONTHS[name.slice(0, 3).toLowerCase()] || 0;
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[-/.\s]+([A-Za-z]{3,9})[-/.,\s]+(\d{2,4})$/);
  if (m && month(m[2])) return isoIfValid(+m[3], month(m[2]), +m[1]);
  m = s.match(/^([A-Za-z]{3,9})[-/.\s]+(\d{1,2})(?:st|nd|rd|th)?[-/.,\s]+(\d{2,4})$/);
  if (m && month(m[1])) return isoIfValid(+m[3], month(m[1]), +m[2]);
  return "";
}

const round = (n: number, dp = 4) => Math.round(n * 10 ** dp) / 10 ** dp;

const SUMMARY_ROW = /^(sub\s*-?\s*total|total|grand total|vat|tax|discount|freight|delivery charges?|net amount|amount)\b/i;

/** Coerces arbitrary parsed JSON into a clean Extraction and adds sanity-check warnings. */
export function normalizeExtraction(input: unknown): Extraction {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const warnings = Array.isArray(o.warnings) ? o.warnings.map(clean).filter(Boolean) : [];
  const uncertainFields = Array.isArray(o.uncertainFields) ? o.uncertainFields.map(clean).filter(Boolean) : [];

  const rawDate = clean(o.receiptDate);
  const receiptDate = toIsoDate(rawDate);
  if (rawDate && !receiptDate) warnings.push(`Could not interpret the date "${rawDate}" — please enter it manually.`);

  const rawItems = Array.isArray(o.items) ? o.items : [];
  const items: ExtractedItem[] = [];
  rawItems.forEach((ri, idx) => {
    const r = (ri && typeof ri === "object" ? ri : {}) as Record<string, unknown>;
    const it: ExtractedItem = {
      productCode: clean(r.productCode),
      oemCode: clean(r.oemCode),
      description: clean(r.description),
      unit: clean(r.unit),
      qty: toNumber(r.qty),
      unitPrice: toNumber(r.unitPrice),
      lineTotal: toNumber(r.lineTotal),
    };
    if (!it.productCode && !it.oemCode && !it.description) return;
    if (!it.productCode && SUMMARY_ROW.test(it.description)) return;
    const row = idx + 1;
    if (!it.productCode && it.oemCode) {
      it.productCode = it.oemCode;
      warnings.push(`Row ${row}: no product code printed — OEM code "${it.oemCode}" used as product code.`);
    } else if (!it.productCode) {
      warnings.push(`Row ${row}: product code missing — this line will not be saved until you add one.`);
    }
    if (!it.qty) warnings.push(`Row ${row}: quantity missing or unreadable.`);
    if (!it.unitPrice && it.lineTotal && it.qty) {
      it.unitPrice = round(it.lineTotal / it.qty);
    } else if (it.unitPrice && it.lineTotal && it.qty) {
      const expected = it.unitPrice * it.qty;
      if (Math.abs(expected - it.lineTotal) > Math.max(0.05, it.lineTotal * 0.01)) {
        warnings.push(`Row ${row}: qty × unit price (${round(expected, 2)}) does not match line total (${it.lineTotal}).`);
      }
    }
    items.push(it);
  });

  return {
    documentType: clean(o.documentType),
    documentNumber: clean(o.documentNumber),
    projectNumber: clean(o.projectNumber),
    projectName: clean(o.projectName),
    projectLocation: clean(o.projectLocation),
    lpoNumber: clean(o.lpoNumber),
    supplierName: clean(o.supplierName),
    supplierAddress: clean(o.supplierAddress),
    receiptDate,
    currency: clean(o.currency).toUpperCase(),
    remarks: clean(o.remarks),
    otherReferences: (Array.isArray(o.otherReferences) ? o.otherReferences : [])
      .map((r) => {
        const ref = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
        return { label: clean(ref.label), value: clean(ref.value) };
      })
      .filter((r) => r.value)
      .filter((r, i, all) => all.findIndex((x) => x.value === r.value) === i)
      .slice(0, 12),
    items,
    uncertainFields: [...new Set(uncertainFields)],
    warnings: [...new Set(warnings)],
  };
}

/** Pulls the answer text out of a Gemini generateContent response, skipping "thought" parts. */
export function responseText(resp: any): { text: string; finishReason: string; blockReason: string } {
  const cand = resp?.candidates?.[0];
  const parts: any[] = cand?.content?.parts || [];
  const text = parts.filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text).join("");
  return { text, finishReason: cand?.finishReason || "", blockReason: resp?.promptFeedback?.blockReason || "" };
}
