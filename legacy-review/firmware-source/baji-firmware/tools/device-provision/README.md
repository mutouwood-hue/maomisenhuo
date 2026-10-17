# One-time local device provisioning helper

**Not production firmware. No flashing command is supplied. Lead alone controls the device.**

## Build (isolated)

In an ESP-IDF **5.5.5** activated PowerShell, from this directory:

```powershell
idf.py -B build -DIDF_TARGET=esp32s3 build
python provision.py --dry-run
```

Do not run `idf.py flash`, `erase-flash`, or copy helper bootloader/partition/otadata artifacts. The partition table here exists only to link the app with NVS at `0x9000`, length `0x8000`, and an application at `0x20000`. Lead must check the device's current partition table and boot selection. **Refuse NEW, PENDING_VERIFY, invalid/aborted or unknown OTA state: only the currently selected VALID slot permits helper replacement.** Preserve and compare otadata before helper boot and after restoration; selection/state must remain unchanged, otherwise do not assume restoring app bytes restores boot behavior. Replace **only that selected VALID app slot** with the helper if independently approved. Preserve latest production app, ELF, table, otadata and full NVS backups. Restore production immediately after the one attempt. Do not treat this as signed OTA or rollback acceptance.

## Operator gates

1. Independent security review and actual isolated ESP compilation must pass. Host dry-run is **not** NVS, USB, or hardware acceptance.
2. Stop other serial clients/app writers; take a **fresh** NVS backup before replacement. Backups may contain credentials: private ACL, never attach/upload/log.
3. Independently verify physical USB device and its BLE hardware MAC. Protocol MAC/nonce/CRC are identification/corruption checks, **not cryptographic device authentication**. A malicious local USB endpoint could impersonate them.
4. Secret manager/operator generates a unique CSPRNG 32-byte key into a protected local binary file, never argv/environment/source/flash image literals. Configure backend with the same key privately for the verified MAC. The client rejects all-zero values but cannot prove entropy.
5. Boot helper; allow ROM output to stop, open its native ESP32-S3 USB Serial/JTAG port without reset within 60 seconds. No UART bridge fallback, no BLE provision endpoint.
6. Explicit operator invocation (placeholders, not real credentials):

```powershell
python provision.py --port '<operator-selected-port>' --expect-mac '<verified-BLE-MAC>' --key-file '<private-32-byte-binary-file>' --confirm-local-provision
```

7. Exactly one attempt per boot. Existing key of any blob length or incompatible type is refused. `NVS_INIT_FAILED` has **no erase fallback**. On set/commit/readback or transport uncertainty do not generate a different key or blindly retry: inspect persistence privately using this same intended key and preserve backups. NVS set itself may have persisted even if commit reports failure.
8. Restore independently hashed production app, confirm provision capability then execute genuine challenge/physical-confirm/session flow. Read back production app bytes and compare SHA256 to saved image. Securely handle/delete local secret files under the operator's policy; Python wiping does not guarantee forensic removal of all interpreter/OS/USB driver copies.

## Wire format

Exactly 64 bytes, little-endian CRC32 (IEEE/zlib) over bytes 0..59 at 60..63.

| Offset | Field |
|---|---|
| 0..7 | ASCII `BJPROV1!` |
| 8 | type: 1 HELLO, 2 READY, 3 SET, 4 RESULT |
| 9 | status; zero on requests |
| 10 | payload length: SET=32, all others=0 |
| 11 | reserved zero |
| 12..17 | verified BLE MAC; zero on HELLO |
| 18..25 | device fresh nonce8; zero on HELLO |
| 26..57 | SET key32; otherwise zero |
| 58..59 | reserved zero |
| 60..63 | CRC32 |

READY issued only after NVS initialization, namespace open, and absent-key check. SET must bind READY MAC and nonce. Device rechecks absence immediately before `nvs_set_blob`, then commits and constant-time compares readback. Secret buffers are wiped before RESULT. RX reads use direct S3 USB FIFO to avoid retained ISR driver-ring copies; the helper itself does not call console/driver installation. This does not guarantee absence of ROM output or SDK secondary-console traffic: the built configuration enables secondary USB Serial/JTAG. After RESULT it only drains/wipes input forever, with no second write operation.

## Bounded READY synchronization and secret-free probe

Both modes use `read_ready_reply` before any key-file access: at most 8 seconds and 4096 received bytes, with an application pending buffer no larger than 64 bytes. The host does not reset the input buffer or reset the device. Prefix noise and invalid candidates are discarded without logging their contents; each accepted candidate must pass the existing full frame/CRC/fields/expected-MAC validation, and READY requires status zero and a nonzero nonce. Every fully valid RESULT is terminal: nonzero status refuses the attempt and premature OK is rejected. CRC/MAC/nonce remain physical-link correlation, not cryptographic authentication.

Only after validated READY may ordinary mode open the key file and send SET once. Probe mode never opens a key file or sends SET. RESULT after SET is still a strict single frame with MAC/nonce/CRC checks: no scanning, no HELLO/SET retries. `may_have_written` is set before the SET write call, including short writes or exceptions. New scan logs use neutral integer fields `ready_scan_bytes`, `ready_scan_noise`, and `ready_scan_candidates`; older probe log field names and historical outcomes remain unchanged.

This ordinary-READY change is source-only, with synthetic regression pending fresh independent review and Lead verification before any device deployment. Synthetic success is not physical USB or provisioning acceptance.

The host emits only fixed stages/reasons, traceId, `may_have_written`, `probe_ready`, and nonce/MAC/CRC-validated `confirmed_result`. SET uncertainty is set before write; a close failure never discards a confirmed RESULT. A confirmed OK followed by a close error still exits 3, but must not be interpreted as 'not written' or used to justify retry. It does not log keys, frames, nonce, external exception text or stack traces.

```powershell
python provision.py --port '<operator-selected-port>' --expect-mac '<verified-BLE-MAC>' --probe-only --confirm-local-provision
```

Probe mode rejects `--key-file`, sends HELLO only and never SET. A valid READY proves only this attempt's protocol/NVS initialization/absent-key query path. Namespace metadata can still change: fresh private backup and VALID-slot gate remain mandatory, followed by production restoration/full readback and table/otadata/NVS comparison. There is no automatic retry. The 60-second window begins in helper app_main; after timeout the helper drains forever. Coordinate helper boot and host OPEN, recording elapsed time, rather than reusing an expired helper boot.

## Known limitations / pending acceptance

- Helper compiled on ESP-IDF5.5.5 and the scoped security fixes were independently reviewed. The physical attempt pwsh-346 returned unknown host exit3; private post-attempt persistence was byte-identical with no Written device_key. Production full readback/boot/BLE restoration passed. Host diagnostics have independent synthetic regression and scoped review, but no successful physical provisioning or binding evidence; see [acceptance matrix](<../../docs/m2-acceptance-matrix.md>). CRC is not encryption/authentication; use only an operator-controlled physical USB link.
- RF is disabled. Per ESP-IDF `esp_random.h`, `esp_fill_random` does not promise true random entropy without the documented additional entropy source. The nonce is only attempt correlation, not authentication/replay protection against a malicious link; no device key is generated from it. The unique key must originate from the operator's OS CSPRNG. No RF, ADC entropy setup or eFuse change is enabled incidentally.
- Native USB FIFO polling is IDF/S3-specific. ESP-IDF5.5.5 compilation passed; physical USB framing/timing acceptance remains incomplete. Host dry-run validates framing only.
- The single secret-free physical probe pwsh-366 failed with `READY_VALIDATE / BAD_MAGIC` at 61ms, `may_have_written=false`, `probe_ready=false`, with no key-file, SET or automatic retry. The first 64 received bytes did not begin with valid magic; their source is unproven. Log encoding damage is not evidence of wire corruption or a clock/timeout cause. Finally production restoration passed; pwsh-369 complete 3134496-byte readback matched the production SHA256, and Lead's private pre/post table/NVS/otadata comparison was byte-identical with the same CRC-valid VALID ota0 selection. Restoration is not successful provisioning or binding.
- NVS is not encrypted here. Debug/ROM physical read access can reveal stored key. No eFuse/security-mode change is performed or recommended incidentally.
- Namespace open may allocate metadata; NVS may internally garbage-collect pages through official API. This preserves logical unrelated values but is not byte-identical partition preservation or a ban on internal flash page erases. There is no explicit partition/whole-flash erase in helper.
- SDK/OS stacks may keep secret copies despite application buffer wiping; no forensic-zero guarantee. No secret bytes, digests, frames, or exception details are logged by our client/helper.
