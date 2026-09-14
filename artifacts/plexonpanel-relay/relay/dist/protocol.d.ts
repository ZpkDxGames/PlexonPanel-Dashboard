export declare const MAX_ENVELOPE_BYTES = 131072;
export interface ProtocolEnvelope {
    protocolVersion: number;
    type: string;
    messageId: string;
    serverId: string;
    timestamp: string;
    body: string;
    signature: string;
}
export interface DecodedEnvelope {
    envelope: ProtocolEnvelope;
    body: Record<string, unknown>;
}
export declare function decodeEnvelope(text: string): DecodedEnvelope;
export declare function assertFreshEnvelope(envelope: ProtocolEnvelope, now?: number): void;
export declare function importAgentPublicKey(publicKeyBase64: string): Promise<CryptoKey>;
export declare function verifyEnvelope(envelope: ProtocolEnvelope, publicKey: CryptoKey): Promise<boolean>;
export declare function verifyChallengeProof(nonce: string, proof: unknown, publicKey: CryptoKey): Promise<boolean>;
export declare function signEnvelope(type: string, serverId: string, body: Record<string, unknown>, privateKeyBase64: string): Promise<string>;
export declare function publicKeyFingerprint(publicKeyBase64: string): Promise<string>;
export declare function fromBase64(value: string): Uint8Array<ArrayBuffer>;
export declare function fromBase64Url(value: string): Uint8Array<ArrayBuffer>;
export declare function toBase64Url(value: Uint8Array<ArrayBufferLike>): string;
