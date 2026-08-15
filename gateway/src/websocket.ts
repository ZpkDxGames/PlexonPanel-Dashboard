import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { TextDecoder } from "node:util";

const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_FRAME_BYTES = 1_048_576;
const utf8 = new TextDecoder("utf-8", { fatal: true });

export interface WebSocketHandlers {
  onText: (text: string) => Promise<void> | void;
  onClose?: () => Promise<void> | void;
  onError?: (error: Error) => void;
}

export function acceptWebSocket(
  request: IncomingMessage,
  socket: Socket,
  handlers: WebSocketHandlers,
  selectedProtocol?: string,
): WebSocketPeer {
  const clientKey = request.headers["sec-websocket-key"];
  if (typeof clientKey !== "string" || request.headers["sec-websocket-version"] !== "13") {
    throw new Error("Invalid WebSocket upgrade headers");
  }
  const accept = createHash("sha1").update(clientKey + WEBSOCKET_GUID).digest("base64");
  const headers = [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
  ];
  if (selectedProtocol) headers.push(`Sec-WebSocket-Protocol: ${selectedProtocol}`);
  socket.write(`${headers.join("\r\n")}\r\n\r\n`);
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 30_000);
  return new WebSocketPeer(socket, handlers);
}

export class WebSocketPeer {
  private buffer = Buffer.alloc(0);
  private fragments: Buffer[] = [];
  private fragmentedSize = 0;
  private fragmentedOpcode: number | null = null;
  private closed = false;
  private handlerChain = Promise.resolve();

  constructor(
    private readonly socket: Socket,
    private readonly handlers: WebSocketHandlers,
  ) {
    socket.on("data", (chunk: Buffer) => this.consume(chunk));
    socket.on("error", (error: Error) => handlers.onError?.(error));
    socket.on("close", () => {
      if (this.closed) return;
      this.closed = true;
      void handlers.onClose?.();
    });
  }

  get isClosed(): boolean {
    return this.closed || this.socket.destroyed;
  }

  sendJson(value: unknown): void {
    this.sendText(JSON.stringify(value));
  }

  sendText(value: string): void {
    if (this.isClosed) return;
    const payload = Buffer.from(value, "utf8");
    if (payload.length > MAX_FRAME_BYTES) throw new Error("Outbound WebSocket message is too large");
    this.socket.write(encodeFrame(0x1, payload));
  }

  ping(): void {
    if (!this.isClosed) this.socket.write(encodeFrame(0x9, Buffer.alloc(0)));
  }

  close(code = 1000, reason = "Connection closed"): void {
    if (this.isClosed) return;
    this.closed = true;
    const reasonBytes = Buffer.from(reason, "utf8").subarray(0, 123);
    const payload = Buffer.alloc(2 + reasonBytes.length);
    payload.writeUInt16BE(code, 0);
    reasonBytes.copy(payload, 2);
    this.socket.end(encodeFrame(0x8, payload));
    void this.handlers.onClose?.();
  }

  private consume(chunk: Buffer): void {
    if (this.isClosed) return;
    this.buffer = Buffer.concat([this.buffer, chunk]);
    try {
      while (this.readFrame()) {
        // Continue until the buffered data no longer contains a full frame.
      }
    } catch (error) {
      this.handlers.onError?.(error instanceof Error ? error : new Error("WebSocket protocol error"));
      this.close(1002, "Invalid WebSocket frame");
    }
  }

  private readFrame(): boolean {
    if (this.buffer.length < 2) return false;
    const first = this.buffer[0]!;
    const second = this.buffer[1]!;
    const finalFrame = (first & 0x80) !== 0;
    const rsv = first & 0x70;
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let offset = 2;
    if (rsv !== 0 || !masked) throw new Error("Unsupported WebSocket frame flags");
    if (length === 126) {
      if (this.buffer.length < 4) return false;
      length = this.buffer.readUInt16BE(2);
      offset = 4;
    } else if (length === 127) {
      if (this.buffer.length < 10) return false;
      const wideLength = this.buffer.readBigUInt64BE(2);
      if (wideLength > BigInt(MAX_FRAME_BYTES)) throw new Error("WebSocket frame is too large");
      length = Number(wideLength);
      offset = 10;
    }
    if (length > MAX_FRAME_BYTES) throw new Error("WebSocket frame is too large");
    if (this.buffer.length < offset + 4 + length) return false;
    const mask = this.buffer.subarray(offset, offset + 4);
    const payload = Buffer.from(this.buffer.subarray(offset + 4, offset + 4 + length));
    this.buffer = this.buffer.subarray(offset + 4 + length);
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] = payload[index]! ^ mask[index % 4]!;
    }
    this.handleFrame(opcode, finalFrame, payload);
    return true;
  }

  private handleFrame(opcode: number, finalFrame: boolean, payload: Buffer): void {
    const control = opcode >= 0x8;
    if (control && (!finalFrame || payload.length > 125)) throw new Error("Invalid WebSocket control frame");
    if (opcode === 0x8) {
      const code = payload.length >= 2 ? payload.readUInt16BE(0) : 1000;
      this.close(code, "Peer closed connection");
      return;
    }
    if (opcode === 0x9) {
      this.socket.write(encodeFrame(0xA, payload));
      return;
    }
    if (opcode === 0xA) return;
    if (opcode === 0x2) {
      this.close(1003, "Binary messages are not supported");
      return;
    }
    if (opcode === 0x1) {
      if (this.fragmentedOpcode !== null) throw new Error("Unexpected text frame during fragmentation");
      if (finalFrame) {
        this.dispatchText(payload);
      } else {
        this.fragmentedOpcode = opcode;
        this.fragments = [payload];
        this.fragmentedSize = payload.length;
      }
      return;
    }
    if (opcode === 0x0) {
      if (this.fragmentedOpcode !== 0x1) throw new Error("Unexpected continuation frame");
      this.fragmentedSize += payload.length;
      if (this.fragmentedSize > MAX_FRAME_BYTES) throw new Error("Fragmented message is too large");
      this.fragments.push(payload);
      if (finalFrame) {
        const complete = Buffer.concat(this.fragments, this.fragmentedSize);
        this.fragmentedOpcode = null;
        this.fragments = [];
        this.fragmentedSize = 0;
        this.dispatchText(complete);
      }
      return;
    }
    throw new Error("Unsupported WebSocket opcode");
  }

  private dispatchText(payload: Buffer): void {
    let text: string;
    try {
      text = utf8.decode(payload);
    } catch {
      this.close(1007, "Invalid UTF-8 message");
      return;
    }
    this.handlerChain = this.handlerChain
      .then(() => this.handlers.onText(text))
      .catch((error: unknown) => {
        this.handlers.onError?.(error instanceof Error ? error : new Error("WebSocket handler failed"));
        this.close(1008, "Message rejected");
      });
  }
}

function encodeFrame(opcode: number, payload: Buffer): Buffer {
  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([0x80 | opcode, payload.length]), payload]);
  }
  if (payload.length <= 0xffff) {
    const header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x80 | opcode;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(payload.length), 2);
  return Buffer.concat([header, payload]);
}
