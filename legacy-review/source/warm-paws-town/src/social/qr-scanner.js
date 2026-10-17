import jsQR from 'jsqr';
/** Decode only our explicitly typed local QR payload, never navigate scanned URLs. */
export function parseDiscoveryQr(value) {
  const uri = new URL(value);
  const token = uri.searchParams.get('token');
  if (uri.protocol !== 'baji:' || uri.hostname !== 'discover' || uri.pathname || uri.hash || [...uri.searchParams.keys()].some(key => key !== 'token') || typeof token !== 'string' || token.length < 8 || token.length > 256 || !/^[A-Za-z0-9_-]+$/.test(token)) throw new Error('不是有效的小猫匿名遇见二维码。');
  return token;
}
export function discoveryQr(token) { return 'baji://discover?token=' + encodeURIComponent(token); }
export class QrScanner {
  constructor({ video, canvas, media = navigator.mediaDevices, decode = jsQR, onValue, onError = () => {}, requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame }) {
    Object.assign(this, { video, canvas, media, decode, onValue, onError, requestFrame, cancelFrame, generation: 0, stream: null, frame: null });
  }
  async start() {
    this.stop(); const generation = this.generation;
    if (!this.media?.getUserMedia) throw new Error('当前设备不支持摄像头扫码，请使用支持摄像头的 Android App。');
    const stream = await this.media.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
    this.stream = stream; this.video.srcObject = stream;
    try { await this.video.play(); } catch (error) { this.stop(); throw error; }
    if (generation !== this.generation) return;
    const inspect = () => {
      if (generation !== this.generation) return;
      if (this.video.readyState >= 2 && this.video.videoWidth) {
        this.canvas.width = this.video.videoWidth; this.canvas.height = this.video.videoHeight;
        const context = this.canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(this.video, 0, 0);
        const image = context.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const result = this.decode(image.data, image.width, image.height);
        if (result) {
          try { const token = parseDiscoveryQr(result.data); this.stop(); this.onValue(token); return; }
          catch (error) { this.onError(error); }
        }
      }
      this.frame = this.requestFrame(inspect);
    };
    this.frame = this.requestFrame(inspect);
  }
  stop() {
    this.generation++; if (this.frame !== null) this.cancelFrame(this.frame); this.frame = null;
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    this.video.pause?.(); this.video.srcObject = null;
  }
}
