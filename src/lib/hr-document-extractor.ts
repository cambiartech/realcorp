import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { HrDocumentCategory, type HrFormType } from "@/generated/prisma";

export type ExtractedHrDocument = {
  category: HrDocumentCategory;
  formType: HrFormType | null;
  employeeName: string;
  employeeEmail: string;
  employeeNumber: string;
  confidence: number;
  payload: Record<string, string>;
};

const BIODATA_KEYS = [
  "fullName",
  "gender",
  "dateOfBirth",
  "maritalStatus",
  "nationality",
  "phoneMobile",
  "workEmail",
  "addressStreet",
  "addressCity",
  "addressState",
  "addressCountry",
  "position",
  "department",
  "dateOfJoining",
  "reportingToLabel",
  "employmentType",
  "workSchedule",
  "paygroupName",
  "grossMonthly",
  "payeeTaxMonthly",
  "educationLevel",
  "educationInstitution",
  "educationQualification",
  "educationYear",
  "taxId",
  "rsaPin",
  "pensionAdministrator",
  "nhfMembershipNumber",
  "emergencyName",
  "emergencyRelationship",
  "emergencyPhone",
  "emergencyEmail",
  "nextOfKinName",
  "nextOfKinRelationship",
  "nextOfKinPhone",
  "nextOfKinEmail",
  "nextOfKinStreet",
  "nextOfKinCity",
  "nextOfKinState",
  "nextOfKinOccupation",
] as const;

const FORM_KEYS: Record<"BIODATA" | "BANK_FORM" | "GUARANTOR" | "HEALTH", readonly string[]> = {
  BIODATA: BIODATA_KEYS,
  BANK_FORM: [
    "accountHolderName",
    "bankName",
    "bankAddress",
    "bankCity",
    "bankState",
    "bankCountry",
    "accountType",
    "accountNumber",
    "receivePayments",
  ],
  GUARANTOR: [
    "employeeFullName",
    "employeeJobTitle",
    "employeeDepartment",
    "employeeAddress",
    "employeePhone",
    "guarantorFullName",
    "guarantorRelationship",
    "guarantorAddress",
    "guarantorPhone",
    "guarantorEmail",
    "guarantorOccupation",
    "guarantorEmployerName",
    "guarantorEmployerAddress",
    "knownYears",
    "declarationAccepted",
  ],
  HEALTH: [
    "hasMedicalConditions",
    "medicalDetails",
    "emergencyMedicalName",
    "emergencyMedicalRelationship",
    "emergencyMedicalPhone",
    "hasCertifications",
    "certificationsList",
    "trainingWilling",
    "declarationAccepted",
  ],
};

const AUTO_KEYS = [...new Set(Object.values(FORM_KEYS).flat())];

export function formTypeForDocumentCategory(category: HrDocumentCategory): HrFormType | null {
  if (
    category === "BIODATA" ||
    category === "EMERGENCY_CONTACT" ||
    category === "NEXT_OF_KIN" ||
    category === "EDUCATION" ||
    category === "OFFER_LETTER" ||
    category === "JOB_DESCRIPTION" ||
    category === "CONTRACT" ||
    category === "PAYSLIP"
  ) {
    return "BIODATA";
  }
  if (category === "BANK_FORM") return "BANK_FORM";
  if (category === "GUARANTOR") return "GUARANTOR";
  if (category === "HEALTH_RECORD") return "HEALTH";
  return null;
}

function extension(fileName: string): string {
  return fileName.toLowerCase().split(".").pop() || "";
}

async function documentParts(
  fileUrl: string,
  fileName: string,
  fileBase64?: string,
  suppliedMimeType?: string,
) {
  let bytes: Buffer;
  let responseMimeType = suppliedMimeType;
  if (fileBase64) {
    bytes = Buffer.from(fileBase64, "base64");
  } else {
    const response = await fetch(fileUrl, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error("The uploaded file could not be read.");
    bytes = Buffer.from(await response.arrayBuffer());
    responseMimeType = response.headers.get("content-type") || undefined;
  }
  if (bytes.length > 15 * 1024 * 1024) throw new Error("AI extraction supports files up to 15 MB.");

  const ext = extension(fileName);
  if (ext === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const lines: string[] = [];
    workbook.eachSheet((sheet) => {
      lines.push(`SHEET: ${sheet.name}`);
      sheet.eachRow((row) => {
        const values = Array.isArray(row.values) ? row.values.slice(1) : Object.values(row.values);
        lines.push(values.map((value) => String(value ?? "")).join(" | "));
      });
    });
    return [{ text: `SPREADSHEET CONTENT:\n${lines.join("\n").slice(0, 150_000)}` }];
  }
  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer: bytes });
    return [{ text: `WORD DOCUMENT CONTENT:\n${result.value.slice(0, 150_000)}` }];
  }
  if (ext === "doc" || ext === "xls") {
    throw new Error("Legacy .doc/.xls files must be saved as .docx/.xlsx before AI extraction.");
  }

  const mimeByExt: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
  };
  const mimeType = mimeByExt[ext] || responseMimeType || "application/pdf";
  return [{ inline_data: { mime_type: mimeType, data: bytes.toString("base64") } }];
}

const GEMINI_TIMEOUT_MS = 22_000;
const GEMINI_MODELS = [
  process.env.GEMINI_MODEL?.trim(),
  "gemini-1.5-flash",
  "gemini-2.5-flash",
  "gemini-3.5-flash-lite",
].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);

export class GeminiRateLimitError extends Error {
  constructor() {
    super("Gemini is rate-limited right now. Try Prefill with AI in a few minutes.");
    this.name = "GeminiRateLimitError";
  }
}

function isThinkingModel(model: string) {
  return /gemini-([23]\.|2\.5)/.test(model);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateGeminiJson(apiKey: string, parts: unknown[]) {
  let lastError: Error | null = null;
  for (const model of GEMINI_MODELS) {
    const thinkingPasses = isThinkingModel(model) ? [true, false] : [false];
    for (const includeThinkingOff of thinkingPasses) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: {
                responseMimeType: "application/json",
                ...(includeThinkingOff ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
              },
            }),
          },
        );
        if (response.status === 429 || response.status === 503) {
          const retryAfter = Number(response.headers.get("retry-after"));
          const waitMs =
            Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 12_000) : 8_000;
          await sleep(waitMs);
          const retry = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
              signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
              body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: { responseMimeType: "application/json" },
              }),
            },
          );
          if (retry.status === 429 || retry.status === 503 || !retry.ok) {
            throw new GeminiRateLimitError();
          }
          return (await retry.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
          };
        }
        if (response.status === 404) {
          const failure = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
          lastError = new Error(failure?.error?.message || `Model ${model} was not found.`);
          break;
        }
        if (response.status === 400 && includeThinkingOff) {
          continue;
        }
        if (!response.ok) {
          const failure = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
          const detail = failure?.error?.message?.replace(/\s+/g, " ").trim();
          console.error("AI document extraction provider error.", { model, status: response.status, detail });
          lastError = new Error("AI document processing failed. Please try again.");
          break;
        }
        return (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
        };
      } catch (error) {
        if (error instanceof GeminiRateLimitError) throw error;
        if (error instanceof Error && error.name === "AbortError") {
          lastError = new Error("AI document processing timed out.");
          break;
        }
        lastError = error instanceof Error ? error : new Error("AI document processing failed.");
        break;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  console.error("AI document extraction exhausted models.", { lastError: lastError?.message });
  throw lastError || new Error("AI document processing failed. Please try again.");
}

function cleanJson(text: string): unknown {
  const withoutFence = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  return JSON.parse(withoutFence);
}

function safeString(value: unknown): string {
  if (typeof value === "string") return value.trim().slice(0, 2000);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export async function extractHrDocument(input: {
  fileUrl: string;
  fileName: string;
  category: HrDocumentCategory | "AUTO";
  fileBase64?: string;
  fileMimeType?: string;
}): Promise<ExtractedHrDocument> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("AI document processing is temporarily unavailable.");
  const requestedFormType = input.category === "AUTO" ? null : formTypeForDocumentCategory(input.category);
  const keys = input.category === "AUTO" ? AUTO_KEYS : requestedFormType ? FORM_KEYS[requestedFormType] : [];
  const parts = await documentParts(input.fileUrl, input.fileName, input.fileBase64, input.fileMimeType);
  const prompt = [
    "You classify and extract employee onboarding documents for an HR reviewer.",
    "Never invent a value. Use an empty string when a field is absent or illegible.",
    "Dates must be YYYY-MM-DD. yes/no fields must be exactly yes or no.",
    "Monetary values must contain digits and an optional decimal point only, without currency symbols or commas.",
    `Choose documentCategory from: ${Object.values(HrDocumentCategory).join(", ")}.`,
    "Use BIODATA for a comprehensive onboarding form. Use the most specific category for focused documents.",
    "taxId is the tax identification number (TIN). rsaPin is the pension RSA PIN (often starts with PEN).",
    "pensionAdministrator is the PFA name. nhfMembershipNumber is the National Housing Fund number.",
    "Return one JSON object only, with this exact shape:",
    JSON.stringify({
      documentCategory: input.category === "AUTO" ? "BIODATA" : input.category,
      employeeName: "",
      employeeEmail: "",
      employeeNumber: "",
      confidence: 0,
      payload: Object.fromEntries(keys.map((key) => [key, ""])),
    }),
    `Requested category: ${input.category}.`,
    "employeeName identifies whose file this is; for guarantor/bank documents use the employee/account holder, not the contact or guarantor.",
    "confidence is a number from 0 to 1 representing overall extraction certainty.",
  ].join("\n");

  const body = await generateGeminiJson(apiKey, [{ text: prompt }, ...parts]);
  const text = body.candidates?.[0]?.content?.parts?.find((part) => part.text && !part.thought)?.text;
  if (!text) throw new Error("AI extraction returned no readable fields.");
  const raw = cleanJson(text) as Record<string, unknown>;
  const detectedCategory = safeString(raw.documentCategory) as HrDocumentCategory;
  const category =
    input.category === "AUTO" && Object.values(HrDocumentCategory).includes(detectedCategory)
      ? detectedCategory
      : input.category === "AUTO"
        ? HrDocumentCategory.OTHER
        : input.category;
  const formType = formTypeForDocumentCategory(category);
  const selectedKeys = formType ? FORM_KEYS[formType] : [];
  const rawPayload =
    raw.payload && typeof raw.payload === "object" ? (raw.payload as Record<string, unknown>) : {};
  const payload = Object.fromEntries(selectedKeys.map((key) => [key, safeString(rawPayload[key])]));

  if (formType === "BIODATA" && !payload.fullName) payload.fullName = safeString(raw.employeeName);
  if (formType === "BANK_FORM") {
    if (!payload.accountHolderName) payload.accountHolderName = safeString(raw.employeeName);
    payload.accountType = ["Checking", "Savings", "Other"].includes(payload.accountType)
      ? payload.accountType
      : "Other";
    payload.receivePayments = payload.receivePayments === "no" ? "no" : "yes";
  }
  if (formType === "GUARANTOR") {
    if (!payload.employeeFullName) payload.employeeFullName = safeString(raw.employeeName);
    payload.declarationAccepted = "yes";
  }
  if (formType === "HEALTH") {
    payload.hasMedicalConditions = payload.hasMedicalConditions === "yes" ? "yes" : "no";
    payload.hasCertifications = payload.hasCertifications === "yes" ? "yes" : "no";
    payload.trainingWilling = payload.trainingWilling === "yes" ? "yes" : "no";
    payload.declarationAccepted = "yes";
  }

  return {
    category,
    formType,
    employeeName: safeString(raw.employeeName) || payload.fullName || payload.employeeFullName || "",
    employeeEmail: safeString(raw.employeeEmail) || payload.workEmail || "",
    employeeNumber: safeString(raw.employeeNumber),
    confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0)),
    payload,
  };
}
