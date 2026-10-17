/** Independent CFLOCAL3 candidate. Not deployed on the user's 038 badge. */
export interface EventBase {
  source: 'native_device'; protocol: 'CFLOCAL3';
  deviceId: string; eventId: string; counter: number;
  /** Immutable pet identity captured before explicit consent, not current UI cat. */
  petId: string; occurredAtMs: number | null;
}
export interface PeerCompleteEvent extends EventBase {
  v: 3; kind: 'peer_complete';
  /** ec1: + canonical sorted (device16 + ownCounterLE8) pair, 100 ASCII chars. */
  encounterId: string;
  peerId: string; peerPetId: string;
  localEncounterCounter: number; peerEncounterCounter: number;
  proofVersion: 1; method: 'button'; proof: 'mutual_durable_commit';
  bindingFingerprint: string; peerComplete: true; gift: false;
}
export interface CareEvent extends EventBase {
  kind: 'care'; action: 'pet' | 'feed' | 'water' | 'bath' | 'play' | 'sleep';
}
export interface GiftEvent extends EventBase {
  kind: 'gift'; peerId: string; peerCounter: number;
  giftId: 'flower'; quantity: 1; peerComplete: false;
}
export type DeviceEvent = PeerCompleteEvent | CareEvent | GiftEvent;
export interface DurableReceipt {
  eventId: string; status: 'applied' | 'duplicate' | 'quarantined';
  persisted: true; /** 64 lowercase hex SHA256 of the durable original result. */
  saveDigest: string;
}
export interface EventPort {
  readNext(): Promise<DeviceEvent | null>;
  acknowledge(receipt: DurableReceipt): Promise<{status: 'device_persisted'; eventId: string}>;
}
/** A simulation provider is intentionally incompatible with EventBase and has no ACK port. */
export interface SimulationEncounter {
  source: 'simulation_fixture'; simulation: true; scenarioId: string;
}
export interface UnavailableProductionEncounterPort {
  available: false; source: 'unavailable'; reason: string;
}
/** Native-authoritative checkpoint is mandatory; Web Storage alone is not durable success. */
export type DurableCheckpoint = (rawJournal: string) => Promise<{persisted: true; journalSha256: string}>;
export type DurableReceiptVerifier = (
  receipt: DurableReceipt,
  context: {operation: 'ack' | 'retry_ack'; deviceId: string; event: DeviceEvent | null; pending: object | null}
) => Promise<{verified: true; eventId: string; saveDigest: string}>;
// The verifier must read Native-authoritative event history and active save identity,
// including seed/encounter dedup results. It must not certify the pending journal itself.
// Missing history rejects both first ACK and exact unknown ACK retry; no receipt is invented.
// Production consumption must additionally validate negotiated CFLOCAL3 native generation,
// its own save identity, and atomically persist original result + encounter dedup + seed
// before ACK. A valid byte codec does not establish two-radio or physical-input acceptance.
