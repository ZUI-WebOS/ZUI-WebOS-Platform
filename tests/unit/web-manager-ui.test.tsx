// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../apps/web-portal/src/client/App.js";
import {
  mockCatalog,
  mockDashboard,
  mockFetchResult,
  mockPlan,
  mockReceipts,
} from "../../apps/web-portal/src/mock.js";

function response(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ ok: true, data }), {
      headers: { "Content-Type": "application/json" },
    }),
  );
}
describe("Web Manager UI", () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = "";
    vi.stubGlobal(
      "fetch",
      vi.fn((input: unknown, init?: RequestInit) => {
        const path = String(input);
        if (path.includes("dashboard")) return response(mockDashboard);
        if (path.includes("catalog/artifacts/fetch"))
          return response(mockFetchResult);
        if (path.includes("catalog/plans")) return response(mockPlan);
        if (path.includes("catalog") && init?.method !== "POST")
          return response(mockCatalog);
        if (path.includes("cache"))
          return response([
            {
              digest: "A".repeat(64),
              filename: "staging.ipk",
              productId: "zui-youtube-webos",
              release: "acceptance",
              trustDecision: "SIGNED_TRUSTED",
              signingKey: "B".repeat(64),
              verifiedAt: "2026-10-02T00:00:00.000Z",
            },
          ]);
        if (path.includes("receipts")) return response(mockReceipts);
        throw new Error(`unexpected ${path}`);
      }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  it("renders the dashboard and explicit mock state", async () => {
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "ZUI webOS Platform" }),
    ).toBeTruthy();
    expect(screen.getByText("MOCK MODE")).toBeTruthy();
    expect(screen.getByText(/1 online/u)).toBeTruthy();
  });
  it("shows offline device, application classification, and signed trust", async () => {
    render(<App />);
    await screen.findByText("MOCK MODE");
    fireEvent.click(screen.getByRole("button", { name: "Devices" }));
    expect(screen.getByText("bedroom")).toBeTruthy();
    expect(screen.getByText("Offline")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Applications" }));
    expect(screen.getAllByText("Production")).toHaveLength(2);
    expect(screen.getByText("Staging")).toBeTruthy();
    expect(screen.getByText("Update available")).toBeTruthy();
    expect(screen.getByText("Up to date")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Verified cache" }));
    expect(screen.getByText("SIGNED_TRUSTED")).toBeTruthy();
  });
  it("searches and filters normalized catalog detail", async () => {
    render(<App />);
    await screen.findByText("MOCK MODE");
    fireEvent.click(screen.getByRole("button", { name: "Catalog" }));
    expect(screen.getByText("ZUI IPTV Player")).toBeTruthy();
    expect(screen.getByText("ZUI YouTube for webOS")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search products or App IDs"), {
      target: { value: "youtube.leanback.v4" },
    });
    expect(screen.queryByText("ZUI IPTV Player")).toBeNull();
    expect(screen.getByText("zui-staging-0.8.4-acceptance")).toBeTruthy();
    expect(screen.getByText("REMOTE_AVAILABLE")).toBeTruthy();
    expect(screen.getByText("CACHED_VERIFIED")).toBeTruthy();
  });

  it("downloads/verifies and generates a read-only catalog plan", async () => {
    render(<App />);
    await screen.findByText("MOCK MODE");
    fireEvent.click(screen.getByRole("button", { name: "Catalog" }));
    fireEvent.click(screen.getByRole("button", { name: "Download & verify" }));
    await waitFor(() =>
      expect(screen.getByText("CACHED_VERIFIED")).toBeTruthy(),
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Generate plan" })[0]!,
    );
    await waitFor(() =>
      expect(screen.getByText("ALLOW_WITH_APPROVAL")).toBeTruthy(),
    );
    expect(
      screen.getByText(
        "Installation execution will be enabled in a later milestone.",
      ),
    ).toBeTruthy();
  });
  it("switches and persists the Turkish locale", async () => {
    render(<App />);
    await screen.findByText("MOCK MODE");
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByLabelText("Language"), {
      target: { value: "tr" },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Genel Bakış" })).toBeTruthy(),
    );
    expect(localStorage.getItem("zui-locale")).toBe("tr");
    fireEvent.click(screen.getByRole("button", { name: "Uygulamalar" }));
    expect(screen.getByText("Güncelleme mevcut")).toBeTruthy();
    expect(screen.getByText("Güncel")).toBeTruthy();
  });
  it("renders structured errors without raw stack traces", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              ok: false,
              error: {
                code: "DEVICE_UNREACHABLE",
                message: "TV cannot be reached.",
                action: "Check the network.",
              },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );
    render(<App />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("DEVICE_UNREACHABLE");
    expect(alert.textContent).not.toContain("at WebManager");
  });
});
