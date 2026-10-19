/** CFLOCAL2 candidate. A declared capability is not physical acceptance evidence. */
export type Scene = 'home' | 'departing' | 'away' | 'returning';
export type Action = 'idle' | 'walk' | 'pet' | 'feed' | 'water' | 'bath' | 'play' | 'sleep';
export type Weather = 'clear' | 'rain' | 'snow';
/** Display only; already computed by the original phone game. Not meet.stage. */
export type GrowthStage = 'kitten' | 'young' | 'adult';
export type BodyShape = 'standard' | 'slim' | 'round';
export interface PetAppearance {
  growthStage: GrowthStage; // Phone normalizes the legacy baby alias to kitten.
  outfit: string; // Existing outfit ID, [A-Za-z0-9_-], 1..64 chars.
  bodyShape?: BodyShape; // Defaults to standard; no new body/weight algorithm.
}
export interface SceneSnapshot {
  /** petId comes from offline-scene-map.read()->identities.resolve(), never local cat-1. */
  requestId: string; petId: string; revision: number;
  scene: Scene; action: Action; weather: Weather;
  pet: { name: string; breed: string; food: number; mood: number; clean: number; energy: number; health: number; coins: number } &
    (PetAppearance | {growthStage?: never; outfit?: never; bodyShape?: never});
  epochMs?: number; utcOffsetMinutes?: number; // -Date.getTimezoneOffset(), -840..840
}
export interface DeviceEvent {
  source: 'native_device'; protocol: 'CFLOCAL2'; deviceId: string;
  eventId: string; counter: number; petId: string; occurredAtMs: number | null;
  kind: 'care' | 'gift'; action?: Action;
  peerId?: string; peerCounter?: number; giftId?: 'flower'; quantity?: 1;
  // Gift is a real received and persisted receipt; peerComplete is separate.
  peerComplete?: boolean;
}
export interface DurableReceipt {
  eventId: string; status: 'applied' | 'duplicate' | 'quarantined';
  persisted: true; saveDigest: string;
}
export interface ScenePort {
  pushScene(snapshot: SceneSnapshot): Promise<{ status: 'device_persisted'; revision: number; duplicate: boolean }>;
  /** Replays the durable command unchanged; then Host must push a current snapshot for fresh clock. */
  retryPending(command: { origin: 'explicit_user_action' }): Promise<object>;
  getPending(): object | null;
}
export interface EventPort {
  readNext(): Promise<DeviceEvent | null>;
  acknowledge(receipt: DurableReceipt): Promise<{ status: 'device_persisted'; eventId: string }>;
}
export interface LocalV2Ports {
  control: {
    readonly protocolFamily: 'cflocal2';
    initialize(): Promise<void>; getState(): object;
    subscribe(listener: (state: any) => void): () => void;
    selectTransport(mode: 'legacy' | 'cflocal2', command: {origin: 'explicit_user_action'}): Promise<void>;
    requestPermissions(command: {origin: 'explicit_user_action'}): Promise<{granted: boolean}>;
    scan(command: {origin: 'explicit_user_action'; durationMs: number}): Promise<object[]>;
    connect(device: object, command: {origin: 'explicit_user_action'}): Promise<object>;
    readDeviceState(): Promise<object>; disconnect(): Promise<void>; dispose(): Promise<void>;
  };
  scenes: ScenePort; events: EventPort;
}
// Host registers independently through CatOfflineHost.attachLocalV2Ports(ports).
// No auto scan/connect/permissions. Host may push latest real committed view after
// an explicit successful connection. Original HTML remains the game/save writer.
// On uncertain mutation, adapter retains the exact command until read/retry resolves.
// Host must not ACK before its original game+social save and dedup record are durable.
