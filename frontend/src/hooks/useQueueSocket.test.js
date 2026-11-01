import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MockWebSocket from "../test/MockWebSocket.js";
import useQueueSocket from "./useQueueSocket.js";

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket); // remplace le vrai WebSocket
  vi.useFakeTimers();                         // on contrôle le temps (ping, reconnexion)
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useQueueSocket", () => {
  it("ne se connecte pas sans jeton", () => {
    const { result } = renderHook(() => useQueueSocket(1, null));
    expect(MockWebSocket.instances).toHaveLength(0);
    expect(result.current.status).toBe("idle");
  });

  it("se connecte, reçoit un message JSON et ignore pong", () => {
    const { result } = renderHook(() => useQueueSocket(1, "abc"));
    const socket = MockWebSocket.instances[0];
    expect(socket.url).toContain("/ws/queues/1?token=abc");

    act(() => socket.simulateOpen());
    expect(result.current.status).toBe("open");

    act(() => socket.simulateMessage({ event: "snapshot", queue: { waiting_count: 2 } }));
    expect(result.current.message.event).toBe("snapshot");

    act(() => socket.simulateMessage("pong"));
    expect(result.current.message.event).toBe("snapshot"); // inchangé
  });

  it("envoie ping toutes les 25 secondes", () => {
    renderHook(() => useQueueSocket(1, "abc"));
    const socket = MockWebSocket.instances[0];
    act(() => socket.simulateOpen());
    act(() => vi.advanceTimersByTime(50_000));
    expect(socket.sent).toEqual(["ping", "ping"]);
  });

  it("se reconnecte après une coupure, avec un délai croissant", () => {
    const { result } = renderHook(() => useQueueSocket(1, "abc"));
    act(() => MockWebSocket.instances[0].simulateServerClose(1006));
    expect(result.current.status).toBe("reconnecting");

    act(() => vi.advanceTimersByTime(1000)); // 1re tentative après 1 s
    expect(MockWebSocket.instances).toHaveLength(2);

    act(() => MockWebSocket.instances[1].simulateServerClose(1006));
    act(() => vi.advanceTimersByTime(1500)); // 2e tentative après 2 s : pas encore
    expect(MockWebSocket.instances).toHaveLength(2);
    act(() => vi.advanceTimersByTime(500));
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it("ne se reconnecte pas si le jeton est refusé (4401)", () => {
    const { result } = renderHook(() => useQueueSocket(1, "expire"));
    act(() => MockWebSocket.instances[0].simulateServerClose(4401));
    expect(result.current.status).toBe("unauthorized");
    act(() => vi.advanceTimersByTime(60_000));
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("ferme la connexion et ne se reconnecte plus quand le composant disparaît", () => {
    const { unmount } = renderHook(() => useQueueSocket(1, "abc"));
    const socket = MockWebSocket.instances[0];
    act(() => socket.simulateOpen());
    unmount();
    expect(socket.readyState).toBe(3);
    act(() => vi.advanceTimersByTime(60_000));
    expect(MockWebSocket.instances).toHaveLength(1);
  });
});