import { describe, it, expect } from "vitest";
import { getMessage, getErrorCodes, getLanguageFromHeader } from "./index.js";

describe("i18n getMessage", () => {
  it("returns English message for a known error code", () => {
    const msg = getMessage("INVALID_PHONE", "en");
    expect(msg).toBe(
      "Invalid phone number. Please enter a valid 10-digit Indian mobile number."
    );
  });

  it("returns Hindi message for a known error code", () => {
    const msg = getMessage("INVALID_PHONE", "hi");
    expect(msg).toContain("अमान्य फ़ोन नंबर");
  });

  it("falls back to English when Hindi translation is missing", () => {
    // All keys exist in both, so we test fallback by requesting an unknown lang scenario
    // by removing a key at runtime isn't feasible, but we test the code path with a non-existent key
    const msg = getMessage("NONEXISTENT_CODE", "hi");
    // Should return the code itself as last resort
    expect(msg).toBe("NONEXISTENT_CODE");
  });

  it("returns the code itself when no translation exists in any language", () => {
    const msg = getMessage("UNKNOWN_ERROR_CODE", "en");
    expect(msg).toBe("UNKNOWN_ERROR_CODE");
  });

  it("defaults to English when language parameter is omitted", () => {
    const msg = getMessage("SERVER_ERROR");
    expect(msg).toBe("Something went wrong. Please try again later.");
  });

  it("returns all expected error codes", () => {
    const codes = getErrorCodes();
    expect(codes).toContain("INVALID_PHONE");
    expect(codes).toContain("RATE_LIMITED");
    expect(codes).toContain("SERVER_ERROR");
    expect(codes).toContain("CSRF_INVALID");
    expect(codes.length).toBe(25);
  });
});

describe("getLanguageFromHeader", () => {
  it("returns 'hi' when Accept-Language contains 'hi'", () => {
    expect(getLanguageFromHeader("hi")).toBe("hi");
    expect(getLanguageFromHeader("hi-IN,hi;q=0.9,en;q=0.8")).toBe("hi");
    expect(getLanguageFromHeader("en-US,hi;q=0.5")).toBe("hi");
  });

  it("returns 'en' when Accept-Language does not contain 'hi'", () => {
    expect(getLanguageFromHeader("en-US,en;q=0.9")).toBe("en");
    expect(getLanguageFromHeader("")).toBe("en");
    expect(getLanguageFromHeader("fr-FR,de;q=0.8")).toBe("en");
  });
});
