// Share-as-image — CMO Signal MVP (brief v4.0 §3d). Rasterise a chart artifact to a
// branded PNG and hand it to the native share sheet (WhatsApp etc.) on mobile, or
// download it on desktop. The image bakes in the export-integrity provenance
// (interval + as-of date + model version) and the Trifecta wordmark, so a chart can
// never be shared as a bare number (brief §2).
//
// Browser-only (uses document / canvas / navigator). Called from event handlers in
// SignalArtifact, never at import time.

// Resolve every CSS custom property referenced in an SVG string against the live
// document root, so the PNG matches the active (light/dark) theme. Charts use only
// SVG shapes + text (no <foreignObject>), so the canvas stays untainted and exportable.
const VAR_RE = /var\((--[a-z0-9-]+)\)/gi;

function resolveCssVars(markup) {
  const root = getComputedStyle(document.documentElement);
  return markup.replace(VAR_RE, (_, name) => root.getPropertyValue(name).trim() || '#000');
}

function token(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('chart image failed to load'));
    img.src = src;
  });
}

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const BODY = "'Hanken Grotesk', -apple-system, system-ui, sans-serif";

/**
 * Rasterise a live chart <svg> into a branded PNG Blob.
 * @param {SVGElement} svgEl   the chart node from the DOM
 * @param {{title?:string, stamp:string, scale?:number}} opts
 *        stamp = the export-integrity caption (interval · as-of · version); required.
 */
export async function chartSvgToPng(svgEl, { title = '', stamp = '', scale = 2 } = {}) {
  const rect = svgEl.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));

  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  let markup = resolveCssVars(new XMLSerializer().serializeToString(clone));
  if (!markup.startsWith('<?xml')) markup = '<?xml version="1.0" encoding="UTF-8"?>\n' + markup;
  // Blob URL (not data URL) — iOS Safari loads SVG-into-<img> far more reliably this way.
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
  let img;
  try { img = await loadImage(url); }
  finally { setTimeout(() => URL.revokeObjectURL(url), 4000); }

  const padX = 28;
  const headerH = title ? 52 : 20;
  const footerH = 56;
  const cw = w + padX * 2;
  const ch = headerH + h + footerH;

  const bg = token('--panel', '#ffffff');
  const text = token('--text', '#131a2e');
  const faint = token('--faint', '#8a93a8');
  const line = token('--line', '#e1e5ef');
  const blue = token('--blue', '#3b54d6');
  const mint = token('--mint', '#1c9a70');

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(cw * scale);
  canvas.height = Math.round(ch * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cw, ch);

  // header — chart title + a small "Signal" eyebrow
  if (title) {
    ctx.fillStyle = faint;
    ctx.font = `600 10px ${MONO}`;
    ctx.fillText('TRIFECTA SIGNAL', padX, 22);
    ctx.fillStyle = text;
    ctx.font = `600 17px ${BODY}`;
    ctx.fillText(title, padX, 42);
  }

  // chart
  ctx.drawImage(img, padX, headerH, w, h);

  // footer separator
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, headerH + h + 16);
  ctx.lineTo(cw - padX, headerH + h + 16);
  ctx.stroke();

  // footer — provenance stamp (left) + brand gradient dot wordmark (right)
  ctx.fillStyle = faint;
  ctx.font = `10px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText(stamp, padX, headerH + h + 38);

  const grad = ctx.createLinearGradient(cw - padX - 90, 0, cw - padX, 0);
  grad.addColorStop(0, blue);
  grad.addColorStop(1, mint);
  ctx.fillStyle = grad;
  ctx.font = `700 11px ${MONO}`;
  ctx.textAlign = 'right';
  ctx.fillText('TRIFECTA', cw - padX, headerH + h + 38);
  ctx.textAlign = 'left';

  return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/**
 * Hand a PNG Blob to the native share sheet; fall back to a download.
 * @returns {'shared'|'cancelled'|'downloaded'}
 */
export async function sharePng(blob, filename, shareText) {
  if (!blob) throw new Error('nothing to share');
  const file = new File([blob], filename, { type: 'image/png' });
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: shareText });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      // fall through to download on any share failure
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
