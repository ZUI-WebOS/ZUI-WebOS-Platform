// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../apps/tv-store/src/client/App.js";
import { mockTvStoreCatalog } from "../../apps/tv-store/src/mock.js";
import * as client from "../../apps/tv-store/src/client/api-client.js";

describe("TV Store UI", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(client, "loadCatalog").mockResolvedValue(mockTvStoreCatalog);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders generic catalog cards, update, trust and staging states", async () => {
    render(<App />);
    expect(await screen.findAllByText("ZUI IPTV Player")).toHaveLength(1);
    expect(screen.getAllByText("ZUI YouTube for webOS")).toHaveLength(2);
    expect(screen.getByText("Update available")).toBeTruthy();
    expect(screen.getAllByText("STAGING").length).toBeGreaterThan(0);
    expect(screen.getByText("✓ Verified")).toBeTruthy();
    expect(screen.getByText("No compatible release")).toBeTruthy();
    expect(screen.getByText("DEMO CATALOG")).toBeTruthy();
  });

  it("distinguishes live mode without showing the demo marker", async () => {
    vi.mocked(client.loadCatalog).mockResolvedValueOnce({
      ...mockTvStoreCatalog,
      mode: "LIVE",
    });
    render(<App />);
    expect(await screen.findByText("LIVE")).toBeTruthy();
    expect(screen.queryByText("DEMO CATALOG")).toBeNull();
  });

  it("opens product detail, preserves exact trust semantics, and returns with Back", async () => {
    render(<App />);
    const card = await screen.findByRole("button", {
      name: /View details: ZUI IPTV Player/u,
    });
    card.focus();
    fireEvent.click(card);
    expect(screen.getByText("Release trust")).toBeTruthy();
    expect(
      screen.getByText("Repository verified · REPOSITORY_PINNED_HASH"),
    ).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /View details: ZUI IPTV Player/u }),
      ).toBe(document.activeElement),
    );
  });

  it("supports deterministic arrow navigation and an always-visible focus target", async () => {
    render(<App />);
    const first = await screen.findByRole("button", {
      name: /ZUI IPTV Player/u,
    });
    await waitFor(() => expect(first).toBe(document.activeElement));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: /ZUI Store/u })).toBe(
      document.activeElement,
    );
  });

  it("switches all product status and detail labels to Turkish", async () => {
    render(<App />);
    await screen.findAllByText("Available apps");
    fireEvent.click(screen.getByRole("button", { name: "Türkçe" }));
    expect(screen.getAllByText("Kullanılabilir uygulamalar")).toHaveLength(2);
    expect(screen.getByText("Güncelleme mevcut")).toBeTruthy();
    expect(screen.getByText("Uyumlu sürüm yok")).toBeTruthy();
  });

  it("shows a safe retry state for offline or malformed responses", async () => {
    vi.mocked(client.loadCatalog).mockRejectedValueOnce(
      new Error("C:\\private\\stack"),
    );
    render(<App />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("catalog is taking a break");
    expect(alert.textContent).not.toContain("private");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("recovers from an unavailable live service only after explicit Retry", async () => {
    vi.mocked(client.loadCatalog)
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce({ ...mockTvStoreCatalog, mode: "LIVE" });
    render(<App />);
    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(screen.queryByText("DEMO CATALOG")).toBeNull();
    fireEvent.click(retry);
    expect(await screen.findByText("LIVE")).toBeTruthy();
    expect(screen.queryByText("DEMO CATALOG")).toBeNull();
  });

  it("renders catalog strings as text rather than executable HTML", async () => {
    vi.mocked(client.loadCatalog).mockResolvedValueOnce({
      ...mockTvStoreCatalog,
      products: [
        {
          ...mockTvStoreCatalog.products[0]!,
          displayName: "<img src=x onerror=alert(1)>",
        },
      ],
    });
    render(<App />);
    expect(
      await screen.findByText("<img src=x onerror=alert(1)>"),
    ).toBeTruthy();
    expect(document.querySelector(".product-card img")).toBeNull();
  });
});
