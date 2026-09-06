import { describe, expect, it } from "vitest";
import { isImageFile, isPreviewableInBrowser, openFileLabel } from "@/lib/file-open";

describe("isPreviewableInBrowser", () => {
  it("is true for a .pdf path, case-insensitively", () => {
    expect(isPreviewableInBrowser("brochure.pdf")).toBe(true);
    expect(isPreviewableInBrowser("BROCHURE.PDF")).toBe(true);
  });

  it("is true for a .pdf URL with a query string or fragment", () => {
    expect(isPreviewableInBrowser("https://x.supabase.co/f.pdf?token=abc")).toBe(true);
    expect(isPreviewableInBrowser("https://x.supabase.co/f.pdf#page=2")).toBe(true);
  });

  it("is false for non-PDF files and empty input", () => {
    expect(isPreviewableInBrowser("contract.docx")).toBe(false);
    expect(isPreviewableInBrowser("archive.zip")).toBe(false);
    expect(isPreviewableInBrowser(null)).toBe(false);
    expect(isPreviewableInBrowser(undefined)).toBe(false);
  });
});

describe("openFileLabel", () => {
  it("says plain 'Megnyitás' for a previewable PDF", () => {
    expect(openFileLabel("invoice.pdf")).toBe("Megnyitás");
  });

  it("warns a download is needed for anything else", () => {
    expect(openFileLabel("invoice.docx")).toBe("Megnyitás (letöltés szükséges)");
  });
});

describe("isImageFile", () => {
  it("recognizes common image extensions, case-insensitively and with a query string", () => {
    for (const ext of ["png", "JPG", "jpeg", "gif", "webp", "svg", "avif"]) {
      expect(isImageFile(`photo.${ext}`)).toBe(true);
    }
    expect(isImageFile("https://x.supabase.co/photo.png?v=2")).toBe(true);
  });

  it("is false for non-image files and empty input", () => {
    expect(isImageFile("document.pdf")).toBe(false);
    expect(isImageFile(null)).toBe(false);
  });
});
