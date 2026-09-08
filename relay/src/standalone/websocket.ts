import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

const MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_FRAME_BYTES = 131_072;
const MAX_BUFFER_BYTES = 1_048_576;

export interface UpgradeOptions {
  protocol?: string;
  maxMessageBytes?: number;
}

export class NodeWebSocket {
  private buffer = Buffer.alloc(0);
  private fragments: Buffer[] = [];
  private fragmentedBytes = 0;
  private fragmentOpcode = 0;
  private closed = false;
  private closeEmitted = false;
  private messageHandler: (text: string) => void = () => {};
  private closeHandler: (code: number, reason: string) => void = () => {};
  private errorHandler: (error: Error) => void = () => {};
  private pongHandler: () => void = () => {};
  readonly openedAt = Date.now();

  private constructor(
    private readonly socket: Duplex,
    private readonly maxMessageBytes: number,
  ) {
    socket.on("data", (chunk: Buffer) => this.receive(chunk));
    socket.on("error", (error: Error) => this.fail(error));
    socket.on("end", () => this.emitClose(1006, "Socket ended"));
    socket.on("close", () => this.emitClose(1006, "Socket closed"));
  }

  static accept(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    options: UpgradeOptions = {},
  ): NodeWebSocket {
    const key = header(request, "sec-websocket-key");
    const version = header(request, "sec-websocket-version");
    if (!key || version !== "13" || !/^[A-Za-z0-9+/]{22}==$/.test(key))
      throw new Error("Invalid WebSocket upgrade request");
    const accept = createHash("sha1").update(key + MAGIC).digest("base64");
    const headers = [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
    ];
    if (options.protocol) headers.push(`Sec-WebSocket-Protocol: ${options.protocol}`);
    socket.write(`${headers.join("\r\n")}\r\n\r\n`);
    const peer = new NodeWebSocket(
      socket,
      Math.min(options.maxMessageBytes ?? MAX_FRAME_BYTES, MAX_FRAME_BYTES),
    );
    if (head.length) peer.receive(head);
    return peer;
  }

  onMessage(handler: (text: string) => void): this {
    this.messageHandler = handler;
    return this;
  }

  onClose(handler: (code: number, reason: string) => void): this {
    this.closeHandler = handler;
    return this;
  }

  onError(handler: (error: Error) => void): this {
    this.errorHandler = handler;
    return this;
  }

  onPong(handler: () => void): this {
    this.pongHandler = handler;
    return this;
  }

  isOpen(): boolean {
    return !this.closed && !this.socket.destroyed;
  }

  send(text: string): boolean {
    if (!this.isOpen()) return false;
    const payload = Buffer.from(text, "utf8");
    if (payload.length > this.maxMessageBytes) return false;
    return this.writeFrame(0x1, payload);
  }

  ping(payload = Buffer.alloc(0)): boolean {
    if (payload.length > 125 || !this.isOpen()) return false;
    return this.writeFrame(0x9, payload);
  }

  close(code = 1000, reason = ""): void {
    if (this.closed) return;
    this.closed = true;
    const reasonBytes = Buffer.from(reason, "utf8").subarray(0, 123);
    const payload = Buffer.allocUnsafe(2 + reasonBytes.length);
    payload.writeUInt16BE(validCloseCode(code) ? code : 1000, 0);
    reasonBytes.copy(payload, 2);
    try {
      this.writeFrame(0x8, payload, true);
      this.socket.end();
    } catch {
      this.socket.destroy();
    }
    this.emitClose(code, reason);
  }

  terminate(reason = "Transport terminated"): void {
    if (this.closed) return;
    this.closed = true;
    this.socket.destroy();
    this.emitClose(1006, reason);
  }

  private receive(chunk: Buffer): void {
    if (this.closed || !chunk.length) return;
    if (this.buffer.length + chunk.length > MAX_BUFFER_BYTES) {
      this.close(1009, "WebSocket buffer limit exceeded");
      return;
    }
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : Buffer.from(chunk);
    try {
      while (this.parseFrame()) {}
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error("WebSocket protocol error"));
      this.close(1002, "WebSocket protocol error");
    }
  }

  private parseFrame(): boolean {
    if (this.buffer.length < 2) return false;
    const first = this.buffer[0]!;
    const second = this.buffer[1]!;
    const fin = (first & 0x80) !== 0;
    const rsv = first & 0x70;
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    if (rsv || !masked) throw new Error("Unsupported WebSocket frame flags");

    let length = second & 0x7f;
    let offset = 2;
    if (length === 126) {
      if (this.buffer.length < 4) return false;
      length = this.buffer.readUInt16BE(2);
      offset = 4;
    } else if (length === 127) {
      if (this.buffer.length < 10) return false;
      const high = this.buffer.readUInt32BE(2);
      const low = this.buffer.readUInt32BE(6);
      if (high !== 0 || low > this.maxMessageBytes) throw new Error("WebSocket frame too large");
      length = low;
      offset = 10;
    }
    if (length > this.maxMessageBytes) throw new Error("WebSocket frame too large");
    if (this.buffer.length < offset + 4 + length) return false;

    const mask = this.buffer.subarray(offset, offset + 4);
    offset += 4;
    const payload = Buffer.from(this.buffer.subarray(offset, offset + length));
    this.buffer = this.buffer.subarray(offset + length);
    for (let index = 0; index < payload.length; index += 1)
      payload[index] = payload[index]! ^ mask[index % 4]!;

    if (opcode >= 0x8) {
      if (!fin || length > 125) throw new Error("Invalid control frame");
      this.control(opcode, payload);
      return true;
    }
    if (opcode !== 0x0 && opcode !== 0x1) {
      this.close(1003, "Binary WebSocket messages are not supported");
      return false;
    }
    if (opcode === 0x1) {
      if (this.fragmentOpcode) throw new Error("Unexpected text frame during fragmentation");
      if (fin) this.emitText(payload);
      else {
        this.fragmentOpcode = opcode;
        this.fragments = [payload];
        this.fragmentedBytes = payload.length;
      }
      return true;
    }
    if (!this.fragmentOpcode) throw new Error("Unexpected continuation frame");
    this.fragmentedBytes += payload.length;
    if (this.fragmentedBytes > this.maxMessageBytes) throw new Error("Fragmented message too large");
    this.fragments.push(payload);
    if (fin) {
      const complete = Buffer.concat(this.fragments, this.fragmentedBytes);
      this.fragments = [];
      this.fragmentedBytes = 0;
      this.fragmentOpcode = 0;
      this.emitText(complete);
    }
    return true;
  }

  private control(opcode: number, payload: Buffer): void {
    if (opcode === 0x8) {
      let code = 1000;
      let reason = "";
      if (payload.length === 1) throw new Error("Invalid close payload");
      if (payload.length >= 2) {
        code = payload.readUInt16BE(0);
        reason = payload.subarray(2).toString("utf8");
      }
      if (!this.closed) {
        this.closed = true;
        this.writeFrame(0x8, payload, true);
        this.socket.end();
      }
      this.emitClose(code, reason);
      return;
    }
    if (opcode === 0x9) {
      this.writeFrame(0xA, payload);
      return;
    }
    if (opcode === 0xA) this.pongHandler();
  }

  private emitText(payload: Buffer): void {
    const text = payload.toString("utf8");
    if (!Buffer.from(text, "utf8").equals(payload)) throw new Error("Invalid UTF-8 WebSocket text");
    this.messageHandler(text);
  }

  private writeFrame(opcode: number, payload: Buffer, allowClosed = false): boolean {
    if ((!allowClosed && !this.isOpen()) || this.socket.destroyed) return false;
    let header: Buffer;
    if (payload.length < 126) {
      header = Buffer.from([0x80 | opcode, payload.length]);
    } else if (payload.length <= 0xffff) {
      header = Buffer.allocUnsafe(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(payload.length, 2);
    } else {
      header = Buffer.allocUnsafe(10);
      header[0] = 0x80 | opcode;
      header[1] = 127;
      header.writeUInt32BE(0, 2);
      header.writeUInt32BE(payload.length, 6);
    }
    return this.socket.write(Buffer.concat([header, payload]));
  }

  private fail(error: Error): void {
    try {
      this.errorHandler(error);
    } catch {}
  }

  private emitClose(code: number, reason: string): void {
    if (this.closeEmitted) return;
    this.closeEmitted = true;
    try {
      this.closeHandler(code, reason);
    } catch {}
  }
}

export function header(request: IncomingMessage, name: string): string {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value.join(",") : (value ?? "");
}

export function websocketProtocols(request: IncomingMessage): string[] {
  return header(request, "sec-websocket-protocol")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function validCloseCode(code: number): boolean {
  return code === 1000 || (code >= 3000 && code <= 4999);
}
