from pathlib import Path
import hashlib,json,struct,zlib
S=Path(__file__).resolve().parents[1]/'main';d=json.loads((S/'cache-source-transform.json').read_text());s=(S/'badge_renderer_exact.c').read_text();assert s.endswith(d['appended']);s=s[:-len(d['appended'])]
for old,new in reversed(d['transforms']):
 assert new in s,new[:100];s=s.replace(new,old)
assert hashlib.sha256(s.encode()).hexdigest()==d['originalSha256'],'Output-driving source drift'
c=json.loads((S/'assets/room-cache-contract.json').read_text());b=(S/'assets/room-cache.bin').read_bytes();assert len(b)==1085860;assert hashlib.sha256(b).hexdigest()==c['blobSha256'];assert zlib.crc32(b[80:])==struct.unpack_from('<I',b,44)[0];assert b[48:80].hex()==c['fingerprint'];assert hashlib.sha256((S/'assets/pixel-cat.pcat').read_bytes()).hexdigest()==c['pcatSha256'];assert d['originalSha256']==c['source042Sha256'];assert (S/'room_cache_fingerprint.h').read_text()=='#pragma once\n#define ROOM_CACHE_FINGERPRINT {'+','.join('0x%02x'%x for x in b[48:80])+'}\n';print('room cache/source contract exact')
