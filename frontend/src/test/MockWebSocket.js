// Faux WebSocket : le test décide quand la connexion s'ouvre, reçoit un message ou se coupe
export default class MockWebSocket {
  static OPEN = 1;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.sent = [];
    MockWebSocket.instances.push(this);
  }

  send(data) {
    this.sent.push(data);
  }

  close(code = 1000) {
    this.readyState = 3; // CLOSED
    this.onclose?.({ code });
  }

  // --- Aides réservées aux tests ---
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(data) {
    this.onmessage?.({ data: typeof data === "string" ? data : JSON.stringify(data) });
  }

  simulateServerClose(code) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}