import { normalizeBankCode, type SalaryBankAccount } from "./bank-account";

export type PaystackBankRow = {
  name: string;
  code: string;
  slug?: string;
};

const STOP = new Set(["plc", "limited", "ltd", "of", "the", "and", "mfb", "microfinance"]);

/** Short names staff type, pointed at the words in Paystack's official bank name. */
const SHORT_NAME: Record<string, string> = {
  fcmb: "first city monument",
  gtb: "guaranty trust",
  gtbank: "guaranty trust",
  gt: "guaranty trust",
  uba: "united bank for africa",
  fbn: "first bank",
  firstbank: "first bank",
  zenith: "zenith",
  access: "access",
  kuda: "kuda",
  opay: "opay",
  palmpay: "palmpay",
  moniepoint: "moniepoint",
  wema: "wema",
  sterling: "sterling",
  stanbic: "stanbic",
  fidelity: "fidelity",
  ecobank: "ecobank",
  eco: "ecobank",
  keystone: "keystone",
  polaris: "polaris",
  providus: "providus",
  globus: "globus",
  vfd: "vfd",
  union: "union bank",
};

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

/** Match a saved bank name (FCMB, GTBank, Access Bank) to a Paystack bank code. */
export function matchPaystackBankCode(banks: PaystackBankRow[], bankName: string): string | null {
  const query = compact(bankName);
  if (!query) return null;

  const asCode = normalizeBankCode(bankName);
  if (asCode.ok && banks.some((bank) => bank.code === asCode.bankCode)) return asCode.bankCode;

  const exact = banks.find((bank) => compact(bank.name) === query || compact(bank.slug || "") === query.replace(/ /g, "-"));
  if (exact) return exact.code;

  const short = SHORT_NAME[query.replace(/ /g, "")];
  if (short) {
    const hit = findByNeedle(banks, short);
    if (hit) return hit.code;
  }

  const letters = query.replace(/ /g, "");
  if (letters.length >= 3 && letters.length <= 6) {
    const byAcronym = banks.filter((bank) => acronym(bank.name) === letters || acronym(`${bank.name} bank`) === letters);
    if (byAcronym.length === 1) return byAcronym[0].code;
  }

  if (query.length >= 4) {
    const hit = findByNeedle(banks, query);
    if (hit) return hit.code;
  }

  return null;
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
  let changed = holder !== account.accountHolderName;

  if (!bankCode) {
    const matched = matchPaystackBankCode(banks, account.bankName);
    if (!matched) {
      return { ok: false, error: `Paystack has no bank named "${account.bankName}".` };
    }
    bankCode = matched;
    changed = true;
  }

  if (!account.receivePayments) changed = true;

  return {
    ok: true,
    changed,
    account: {
      ...account,
      accountHolderName: holder,
      bankCode,
      receivePayments: true,
    },
  };
}
