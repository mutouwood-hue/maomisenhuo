/** Internal phone/adapter contract, 2026-10-15. No new wire opcodes assigned.
 * Existing legacy control may be implemented from the archived e7f1/BJ codec.
 * Future data/peer ports MUST remain absent until both endpoints are verified. */
export type Generation = number;
export type FrameSequence = number; // integer 1..65535, scoped to Generation
export type UInt64Decimal = string; // canonical decimal; never convert via JS Number
export type Capability = "legacyControl" | "snapshotSync" | "durableEvents" | "peerEncounter";
export type ErrorCode = "PERMISSION_REQUIRED" | "BLUETOOTH_OFF" | "BUSY" |
  "NOT_READY" | "UNSUPPORTED_PROTOCOL" | "UNVERIFIED_CAPABILITY" | "STALE_GENERATION" |
  "MALFORMED_FRAME" | "DEVICE_REJECTED" | "ACK_TIMEOUT_OUTCOME_UNKNOWN" |
  "LOCAL_STORAGE_FAILED" | "DEVICE_STORAGE_FAILED" | "CAT_MISMATCH";
export interface LocalError { code: ErrorCode; message: string; outcome: "no_change" | "unknown"; }
export interface ActualTransportEvidence {
  source: "native"; generation: Generation; deviceAddress: string;
  // Set only by actual successful GATT service/characteristic discovery and CCCD completion.
  serviceVerified: boolean; rxVerified: boolean; txVerified: boolean; subscribed: boolean;
}
export interface LegacyHello { version: 1; capabilities: 15; mac: string; }
export interface LegacyDeviceState {
  screen: number; step: number; phase: number;
  flags: { local: boolean; authenticated: boolean; tutorial: boolean; suspended: boolean };
  face: 0 | 1 | 2; battery: number | null;
  power: "unknown" | "normal" | "low"; usb: boolean | null; revision: number;
  // device UI revision is not the pet-save revision; authenticated has no cloud-account meaning.
}
export interface Capabilities {
  legacyControl: "verified" | "unverified";
  snapshotSync: "unavailable" | "verified";
  durableEvents: "unavailable" | "verified";
  peerEncounter: "unavailable" | "verified";
}
export type LinkState =
  | { stage: "disconnected" | "permission_required" | "bluetooth_off" | "scanning" }
  | { stage: "selecting"; devices: readonly DiscoveredDevice[] }
  | { stage: "connecting" | "discovering" | "subscribing"; deviceAddress: string; generation: Generation }
  | { stage: "handshaking"; evidence: ActualTransportEvidence }
  | { stage: "ready_local"; evidence: ActualTransportEvidence; hello: LegacyHello; device: LegacyDeviceState; capabilities: Capabilities }
  | { stage: "error"; error: LocalError; generation: Generation | null };
export interface DiscoveredDevice { address: string; name: string; rssi: number; source: "native_scan"; }
export interface UserCommand { requestId: string; generation: Generation; origin: "explicit_user_action"; }
export interface LegacyAck<T> {
  generation: Generation; sequence: FrameSequence; originalOpcode: 1 | 2 | 3 | 4 | 5;
  status: 0; gattWriteCompleted: true; data: T;
}
export interface LocalBadgeControlPort {
  readonly protocolFamily: "legacy-e7f1-bj20";
  initialize(): Promise<void>; // installs lifecycle listeners, no permissions/scan/connect side effects
  getState(): LinkState;
  subscribe(listener: (state: LinkState) => void): () => void;
  requestPermissions(command: { origin: "explicit_user_action" }): Promise<{ granted: boolean }>;
  scan(command: { origin: "explicit_user_action"; durationMs: number }): Promise<DiscoveredDevice[]>;
  connect(device: DiscoveredDevice, command: { origin: "explicit_user_action" }): Promise<LinkState>;
  readDeviceState(): Promise<LegacyAck<LegacyDeviceState>>;
  startLocal(command: UserCommand): Promise<LegacyAck<Uint8Array>>;
  setFace(face: 0 | 1 | 2, command: UserCommand): Promise<LegacyAck<Uint8Array>>;
  disconnect(): Promise<void>;
  dispose(): Promise<void>;
}

/** LOCAL DATA PORT PROPOSAL: not supported by the confirmed old control codec.
 * Implement only after old firmware review and negotiated capability. No fake fallback. */
export interface CommittedPetView {
  profileId: string; petId: string; revision: number; digest: string;
  stats: { food: number; mood: number; clean: number; energy: number; health: number };
  coins: number; // safe integer; canonical complete family save remains on phone
}
export interface DeviceEvent {
  source: "verified_device"; protocol: string; deviceId: string; petId: string;
  eventId: string; sequence: UInt64Decimal; kind: "pet";
  occurredAtMs: number | null; // null means no verified device clock
  receivedAtMs: number; // phone receive time is not device event time
}
export interface CommittedLocalResult {
  status: "applied" | "duplicate"; eventId: string; petId: string;
  localRevision: number; persisted: true; saveDigest: string;
}
export interface SemanticRejection { status: "rejected"; eventId: string; reason: string; quarantine: true; }
export interface LocalRulePort {
  applyDeviceEventOnce(event: DeviceEvent): Promise<CommittedLocalResult | SemanticRejection>;
  // A storage failure rejects the Promise; MUST NOT fabricate a terminal rejection/ACK.
  getCommittedPetView(): Promise<CommittedPetView>;
}
export interface LocalSnapshotPort {
  pushCommittedView(view: CommittedPetView): Promise<{ status: "device_persisted"; petId: string; revision: number; digest: string }>;
}
export interface LocalDeviceEventPort {
  subscribe(listener: (event: DeviceEvent) => void): () => void;
  acknowledge(receipt: CommittedLocalResult | SemanticRejection): Promise<{ eventId: string; deviceQueueReceiptPersisted: true }>;
}

/** Real peer proof is separate from the original NPC/BroadcastChannel demonstration. */
export interface PeerReceipt {
  source: "verified_native_peer" | "verified_qr_peer";
  encounterId: string; method: "rhythm" | "pattern" | "qr";
  selfPeerId: string; otherPeerId: string; selfNonce: string; peerNonce: string;
  localInputSatisfied: true; peerConfirmationReceived: true; persistedLocally: true;
  // Not a claim that both devices committed atomically or that a server verified identity.
}
export interface EncounterRulePort {
  commitOriginalRulesOnce(receipt: PeerReceipt): Promise<{
    encounterId: string; status: "applied" | "duplicate";
    persisted: true; originalGameAndSocialRevision: number;
  }>;
}
export interface LocalIntegrationPorts {
  control: LocalBadgeControlPort;
  // Initially absent; UI renders unavailable rather than pretend-verified ports.
  snapshots?: LocalSnapshotPort;
  events?: LocalDeviceEventPort;
  rules?: LocalRulePort;
  encounters?: EncounterRulePort;
}
