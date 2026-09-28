import { normalizeBankCode, type SalaryBankAccount } from "./bank-account";

export type PaystackBankRow = {
  name: string;
  code: string;
  slug?: string;
};

const STOP = new Set(["plc", "limited", "ltd", "of", "the", "and", "mfb", "microfinance"]);

/**
 * Names staff actually type, with the CBN code Paystack accepts.
 * Used even when the live bank list is paged and the long name is not in the first page.
 */
const KNOWN_BANKS: Array<{ code: string; name: string; aliases: string[] }> = [
  { code: "044", name: "Access Bank", aliases: ["access", "access bank", "diamond bank"] },
  { code: "050", name: "Ecobank Nigeria", aliases: ["ecobank", "eco", "eco bank"] },
  { code: "070", name: "Fidelity Bank", aliases: ["fidelity", "fidelity bank"] },
  { code: "011", name: "First Bank of Nigeria", aliases: ["fbn", "firstbank", "first bank", "first bank of nigeria"] },
  { code: "214", name: "First City Monument Bank", aliases: ["fcmb", "first city monument", "first city monument bank"] },
  {
    code: "058",
    name: "Guaranty Trust Bank",
    aliases: ["gtb", "gtbank", "gtco", "gt bank", "gt", "guaranty trust", "guaranty trust bank", "guaranty trust holding"],
  },
  { code: "030", name: "Heritage Bank", aliases: ["heritage", "heritage bank"] },
  { code: "301", name: "Jaiz Bank", aliases: ["jaiz", "jaiz bank"] },
  { code: "082", name: "Keystone Bank", aliases: ["keystone", "keystone bank"] },
  { code: "502", name: "Kuda Bank", aliases: ["kuda", "kuda bank"] },
  { code: "50515", name: "Moniepoint Microfinance Bank", aliases: ["moniepoint", "moniepoint mfb"] },
  { code: "999992", name: "OPay", aliases: ["opay", "o pay"] },
  { code: "999991", name: "PalmPay", aliases: ["palmpay", "palm pay"] },
  { code: "076", name: "Polaris Bank", aliases: ["polaris", "polaris bank", "skye bank"] },
  { code: "101", name: "Providus Bank", aliases: ["providus", "providus bank"] },
  { code: "221", name: "Stanbic IBTC Bank", aliases: ["stanbic", "stanbic ibtc", "ibtc"] },
  { code: "232", name: "Sterling Bank", aliases: ["sterling", "sterling bank"] },
  { code: "032", name: "Union Bank of Nigeria", aliases: ["union", "union bank", "union bank of nigeria"] },
  { code: "033", name: "United Bank For Africa", aliases: ["uba", "united bank for africa"] },
  { code: "215", name: "Unity Bank", aliases: ["unity", "unity bank"] },
  { code: "566", name: "VFD Microfinance Bank", aliases: ["vfd", "vfd mfb"] },
  { code: "035", name: "Wema Bank", aliases: ["wema", "wema bank", "alat"] },
  { code: "057", name: "Zenith Bank", aliases: ["zenith", "zenith bank"] },
];

function compact(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function words(value: string) {
  return compact(value)
    .split(" ")
    .filter((word) => word && !STOP.has(word));
}

function acronym(value: string) {
  return words(value)
    .map((word) => word[0])
    .join("");
}

function findByNeedle(banks: PaystackBankRow[], needle: string) {
  const hits = banks.filter((bank) => compact(bank.name).includes(needle) || compact(bank.slug || "").includes(needle));
  if (hits.length === 1) return hits[0];
  const starts = hits.filter((bank) => compact(bank.name).startsWith(needle));
  return starts.length === 1 ? starts[0] : null;
}

function knownBank(query: string) {
  const key = query.replace(/ /g, "");
  return KNOWN_BANKS.find((bank) => bank.aliases.some((alias) => alias.replace(/ /g, "") === key));
}

export type MatchedBank = { code: string; name: string };

/** Match a saved bank name (FCMB, GTCO, Access Bank) to a Paystack bank. */
export function matchPaystackBank(banks: PaystackBankRow[], bankName: string): MatchedBank | null {
  const query = compact(bankName);
  if (!query) return null;

  const known = knownBank(query);
  if (known) {
    const listed = banks.find((bank) => bank.code === known.code);
    return { code: known.code, name: listed?.name || known.name };
  }

  const asCode = normalizeBankCode(bankName);
  if (asCode.ok) {
    const listed = banks.find((bank) => bank.code === asCode.bankCode);
    if (listed) return { code: listed.code, name: listed.name };
  }

  const exact = banks.find(
    (bank) => compact(bank.name) === query || compact(bank.slug || "") === query.replace(/ /g, "-"),
  );
  if (exact) return { code: exact.code, name: exact.name };

  const letters = query.replace(/ /g, "");
  if (letters.length >= 3 && letters.length <= 6) {
    const byAcronym = banks.filter(
      (bank) => acronym(bank.name) === letters || acronym(`${bank.name} bank`) === letters,
    );
    if (byAcronym.length === 1) return { code: byAcronym[0].code, name: byAcronym[0].name };
  }

  if (query.length >= 4) {
    const hit = findByNeedle(banks, query);
    if (hit) return { code: hit.code, name: hit.name };
  }

  return null;
}

/** @deprecated use matchPaystackBank */
export function matchPaystackBankCode(banks: PaystackBankRow[], bankName: string): string | null {
  return matchPaystackBank(banks, bankName)?.code ?? null;
}

/**
 * Fill a missing Paystack bank code from the name already on the person.
 * A saved account is a salary account, so receive-payments is turned on.
 */
export function completeSalaryBank(
  account: SalaryBankAccount,
  banks: PaystackBankRow[],
  holderFallback: string,
): { ok: true; account: SalaryBankAccount; changed: boolean } | { ok: false; error: string } {
  const holder = account.accountHolderName || holderFallback.trim();
  let bankCode = account.bankCode;
  let bankName = account.bankName;
  let changed = holder !== account.accountHolderName;

  if (!bankCode) {
    const matched = matchPaystackBank(banks, account.bankName);
    if (!matched) {
      return { ok: false, error: `Paystack has no bank named "${account.bankName}".` };
    }
    bankCode = matched.code;
    bankName = matched.name;
    changed = true;
  }

  if (!account.receivePayments) changed = true;
  if (bankName !== account.bankName) changed = true;

  return {
    ok: true,
    changed,
    account: {
      ...account,
      accountHolderName: holder,
      bankName,
      bankCode,
      receivePayments: true,
    },
  };
}
