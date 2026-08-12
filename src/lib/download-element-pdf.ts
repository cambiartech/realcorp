"use client";

import { PDFDocument, rgb } from "pdf-lib";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 24;

function safeFilename(value: string) {
  const cleaned = value
    .trim()
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return `${cleaned || "realcorp-document"}.pdf`;
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not render this document."));
        return;
      }
      blob.arrayBuffer().then(resolve, reject);
    }, "image/png");
  });
}

export async function downloadElementAsPdf(element: HTMLElement, filename: string) {
  await document.fonts?.ready;
  const { default: html2canvas } = await import("html2canvas-pro");
  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: Math.min(window.devicePixelRatio || 1, 2),
    useCORS: true,
    logging: false,
    width: element.scrollWidth,
    height: element.scrollHeight,
    windowWidth: Math.max(element.scrollWidth, 1024),
    onclone: (clonedDocument) => {
      clonedDocument.querySelectorAll<HTMLElement>("[data-pdf-exclude='true']").forEach((node) => node.remove());
    },
  });

  const pdf = await PDFDocument.create();
  pdf.setCreator("Realcorp");
  pdf.setProducer("Realcorp");
  pdf.setCreationDate(new Date());

  const contentWidth = A4_WIDTH - PAGE_MARGIN * 2;
  const contentHeight = A4_HEIGHT - PAGE_MARGIN * 2;
  const sourcePageHeight = Math.max(1, Math.floor((contentHeight * canvas.width) / contentWidth));

  for (let sourceY = 0; sourceY < canvas.height; sourceY += sourcePageHeight) {
    const sliceHeight = Math.min(sourcePageHeight, canvas.height - sourceY);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;
    const context = pageCanvas.getContext("2d");
    if (!context) throw new Error("Could not prepare this PDF.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    context.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

    const image = await pdf.embedPng(await canvasToPngBytes(pageCanvas));
    const drawHeight = (sliceHeight * contentWidth) / canvas.width;
    const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
    page.drawRectangle({ x: 0, y: 0, width: A4_WIDTH, height: A4_HEIGHT, color: rgb(1, 1, 1) });
    page.drawImage(image, {
      x: PAGE_MARGIN,
      y: A4_HEIGHT - PAGE_MARGIN - drawHeight,
      width: contentWidth,
      height: drawHeight,
    });
  }

  const bytes = await pdf.save();
  const blob = new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename(filename);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
