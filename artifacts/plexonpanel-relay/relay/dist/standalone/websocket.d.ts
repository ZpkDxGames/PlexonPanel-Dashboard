import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
export interface UpgradeOptions {
    protocol?: string;
    maxMessageBytes?: number;
}
export declare class NodeWebSocket {
    private readonly socket;
    private readonly maxMessageBytes;
    private buffer;
    private fragments;
    private fragmentedBytes;
    private fragmentOpcode;
    private closed;
    private closeEmitted;
    private messageHandler;
    private closeHandler;
    private errorHandler;
    private pongHandler;
    readonly openedAt: number;
    private constructor();
    static accept(request: IncomingMessage, socket: Duplex, head: Buffer, options?: UpgradeOptions): NodeWebSocket;
    onMessage(handler: (text: string) => void): this;
    onClose(handler: (code: number, reason: string) => void): this;
    onError(handler: (error: Error) => void): this;
    onPong(handler: () => void): this;
    isOpen(): boolean;
    send(text: string): boolean;
    ping(payload?: Buffer<ArrayBuffer>): boolean;
    close(code?: number, reason?: string): void;
    terminate(reason?: string): void;
    private receive;
    private parseFrame;
    private control;
    private emitText;
    private writeFrame;
    private fail;
    private emitClose;
}
export declare function header(request: IncomingMessage, name: string): string;
export declare function websocketProtocols(request: IncomingMessage): string[];
