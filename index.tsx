// /pages/index.tsx
import React, { useMemo, useState, useEffect } from "react";
import Head from "next/head";

type RasterFormat = "png" | "jpeg";

type SvgItem = {
  id: string;
  name: string;
  svg: string; // raw SVG markup
  tags?: string[];
};

type Size = { width: number; height: number };

const SAMPLE_SVGS: SvgItem[] = [
  {
    id: "islamic-ornament",
    name: "Ornamen Geometrik",
    svg: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#22c55e"/>
      <stop offset="1" stop-color="#16a34a"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="16" fill="url(#g)"/>
  <g fill="none" stroke="white" stroke-width="3">
    <path d="M80 20l40 40-40 40-40-40z"/>
    <path d="M80 60l40 40-40 40-40-40z" opacity="0.6"/>
    <circle cx="80" cy="60" r="10" fill="white" stroke="none"/>
  </g>
</svg>`,
    tags: ["geometric", "ornament"],
  },
  {
    id: "masjid",
    name: "Masjid Siluet",
    svg: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160">
  <rect width="240" height="160" fill="#0ea5e9"/>
  <g fill="white">
    <path d="M30 140h180v-40h-180z"/>
    <path d="M60 100h40v-20a20 20 0 1 1 40 0v20h40v-10h-15v-35h-10v35h-30v-20a35 35 0 1 0-70 0v20H60z"/>
    <rect x="35" y="85" width="10" height="55"/>
    <rect x="195" y="85" width="10" height="55"/>
  </g>
</svg>`,
    tags: ["silhouette", "building"],
  },
  {
    id: "calligraphy",
    name: "Kaligrafi Sederhana",
    svg: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">
  <rect width="200" height="120" fill="#111827"/>
  <path d="M20 80c30-40 50-40 80 0s50 40 80 0" fill="none" stroke="#fbbf24" stroke-width="6" stroke-linecap="round"/>
  <circle cx="100" cy="60" r="8" fill="#fbbf24"/>
</svg>`,
    tags: ["calligraphy", "line"],
  },
];

/** Parse intrinsic SVG aspect ratio from viewBox or width/height attributes */
function getSvgIntrinsicSize(svgMarkup: string): Size | null {
  try {
    const doc = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
    const svgEl = doc.documentElement;

    const vb = svgEl.getAttribute("viewBox");
    if (vb) {
      const parts = vb.trim().split(/\s+/).map(Number);
      if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
        const [, , w, h] = parts;
        if (w > 0 && h > 0) return { width: w, height: h };
      }
    }

    const wAttr = svgEl.getAttribute("width");
    const hAttr = svgEl.getAttribute("height");

    const parseLen = (s: string | null) =>
      s ? parseFloat(s.replace(/[a-z%]+$/i, "")) : NaN;

    const w = parseLen(wAttr);
    const h = parseLen(hAttr);
    if (w > 0 && h > 0) return { width: w, height: h };

    return null;
  } catch {
    return null;
  }
}

function svgToDataUrl(svg: string) {
  // Ensure xmlns is present
  if (!svg.includes("xmlns=")) {
    svg = svg.replace(
      /<svg\b/,
      '<svg xmlns="http://www.w3.org/2000/svg"'
    );
  }
  const encoded = encodeURIComponent(svg)
    // Preserve certain characters for smaller/cleaner URLs
    .replace(/%0A/g, "")
    .replace(/%20/g, " ")
    .replace(/%3D/g, "=")
    .replace(/%3A/g, ":")
    .replace(/%2F/g, "/")
    .replace(/%22/g, "'");

  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

async function rasterizeSvg(
  svgMarkup: string,
  outSize: Size,
  format: RasterFormat,
  background: { color: string; transparent: boolean }
): Promise<Blob> {
  const imgUrl = svgToDataUrl(svgMarkup);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    // Important to allow drawing from data URL without tainting canvas
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = imgUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(outSize.width));
  canvas.height = Math.max(1, Math.round(outSize.height));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  // Fill background if needed (JPEG requires opaque; PNG can be transparent)
  if (format === "jpeg" || !background.transparent) {
    ctx.fillStyle = background.color || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } // else keep transparent for PNG

  // Compute draw size preserving aspect
  // We assume caller already chose width/height; draw to full canvas:
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const quality = format === "jpeg" ? 0.92 : undefined;

  // Prefer toBlob; fallback to dataURL for older browsers
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      `image/${format}`,
      quality
    );
  });

  return blob;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const Card: React.FC<{
  item: SvgItem;
  defaultWidth?: number;
}> = ({ item, defaultWidth = 1024 }) => {
  const [format, setFormat] = useState<RasterFormat>("png");
  const [transparent, setTransparent] = useState<boolean>(true);
  const [bgColor, setBgColor] = useState<string>("#ffffff");
  const intrinsic = useMemo(() => getSvgIntrinsicSize(item.svg), [item.svg]);
  const aspect = intrinsic ? intrinsic.width / intrinsic.height : 1;
  const [lockRatio, setLockRatio] = useState(true);

  const [size, setSize] = useState<Size>(() => {
    if (intrinsic) {
      const width = defaultWidth;
      return { width, height: Math.round(width / (intrinsic.width / intrinsic.height)) };
    }
    return { width: defaultWidth, height: Math.round(defaultWidth / aspect) };
  });

  // When format switches to jpeg, force non-transparent
  useEffect(() => {
    if (format === "jpeg" && transparent) {
      setTransparent(false);
    }
  }, [format, transparent]);

  const previewDataUrl = useMemo(() => svgToDataUrl(item.svg), [item.svg]);

  const onWidthChange = (v: number) => {
    const width = Math.max(1, Math.round(v || 0));
    if (lockRatio) {
      setSize({ width, height: Math.max(1, Math.round(width / aspect)) });
    } else {
      setSize((s) => ({ ...s, width }));
    }
  };

  const onHeightChange = (v: number) => {
    const height = Math.max(1, Math.round(v || 0));
    if (lockRatio) {
      setSize({ width: Math.max(1, Math.round(height * aspect)), height });
    } else {
      setSize((s) => ({ ...s, height }));
    }
  };

  const handleDownload = async () => {
    try {
      const blob = await rasterizeSvg(item.svg, size, format, {
        color: bgColor,
        transparent: format === "png" ? transparent : false,
      });
      const filename = `${item.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")}-${size.width}x${size.height}.${format === "jpeg" ? "jpg" : "png"}`;
      downloadBlob(blob, filename);
    } catch (err: any) {
      alert(`Gagal mengunduh: ${err?.message || err}`);
    }
  };

  return (
    <div className="card">
      <div className="thumb">
        <img src={previewDataUrl} alt={item.name} />
      </div>

      <div className="meta">
        <h3>{item.name}</h3>
        {intrinsic && (
          <p className="dim">
            Rasio asli: {intrinsic.width}×{intrinsic.height}
          </p>
        )}
        {item.tags?.length ? <p className="tags">#{item.tags.join(" #")}</p> : null}
      </div>

      <div className="controls">
        <div className="row">
          <label>Lebar (px)</label>
          <input
            type="number"
            min={1}
            value={size.width}
            onChange={(e) => onWidthChange(Number(e.target.value))}
          />
        </div>

        <div className="row">
          <label>Tinggi (px)</label>
          <input
            type="number"
            min={1}
            value={size.height}
            onChange={(e) => onHeightChange(Number(e.target.value))}
          />
        </div>

        <div className="row checkbox">
          <label>
            <input
              type="checkbox"
              checked={lockRatio}
              onChange={(e) => setLockRatio(e.target.checked)}
            />
            Kunci rasio
          </label>
        </div>

        <div className="row">
          <label>Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as RasterFormat)}
          >
            <option value="png">PNG (mendukung transparansi)</option>
            <option value="jpeg">JPG</option>
          </select>
        </div>

        <div className="row checkbox">
          <label>
            <input
              type="checkbox"
              disabled={format === "jpeg"}
              checked={transparent}
              onChange={(e) => setTransparent(e.target.checked)}
            />
            Transparan (PNG saja)
          </label>
        </div>

        <div className="row">
          <label>Warna latar</label>
          <input
            type="color"
            disabled={transparent && format === "png"}
            value={bgColor}
            onChange={(e) => setBgColor(e.target.value)}
          />
        </div>

        <button className="download" onClick={handleDownload}>
          Unduh sebagai {format.toUpperCase()}
        </button>
      </div>

      <style jsx>{`
        .card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          padding: 12px;
        }
        .thumb {
          background: #f9fafb;
          border-radius: 8px;
          padding: 12px;
          display: grid;
          place-items: center;
          min-height: 160px;
        }
        .thumb img {
          max-width: 100%;
          max-height: 240px;
          object-fit: contain;
        }
        .meta h3 {
          margin: 0 0 4px;
          font-size: 16px;
        }
        .dim, .tags {
          margin: 0;
          color: #6b7280;
          font-size: 12px;
        }
        .controls {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .controls .row {
          display: grid;
          gap: 6px;
        }
        .controls .row.checkbox {
          align-items: center;
          grid-auto-flow: column;
          justify-content: start;
        }
        label {
          font-size: 12px;
          color: #374151;
        }
        input[type="number"], select, input[type="color"] {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 14px;
          outline: none;
        }
        input[type="color"] {
          padding: 0;
          height: 36px;
        }
        .download {
          grid-column: 1 / -1;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid #16a34a;
          background: #22c55e;
          color: white;
          font-weight: 600;
          cursor: pointer;
        }
        .download:hover {
          background: #16a34a;
        }

        @media (min-width: 720px) {
          .card {
            grid-template-columns: 1.2fr 1fr;
          }
          .thumb {
            min-height: 200px;
          }
          .meta {
            grid-column: 1 / -1;
          }
          .controls {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </div>
  );
};

export default function HomePage() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SAMPLE_SVGS;
    return SAMPLE_SVGS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }, [query]);

  return (
    <>
      <Head>
        <title>jariahkusvg — Galeri SVG → PNG/JPG</title>
        <meta
          name="description"
          content="Galeri SVG yang bisa diunduh sebagai PNG/JPG dengan ukuran kustom."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main>
        <header className="hero">
          <h1>jariahkusvg</h1>
          <p>Galeri SVG → export ke PNG/JPG, ukuran kustom, siap pakai.</p>

          <div className="search">
            <input
              placeholder="Cari (misal: geometric, masjid, calligraphy)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </header>

        <section className="grid">
          {filtered.map((item) => (
            <Card key={item.id} item={item} />
          ))}
          {!filtered.length && (
            <p style={{ gridColumn: "1 / -1", color: "#6b7280" }}>
              Tidak ada hasil untuk &quot;{query}&quot;.
            </p>
          )}
        </section>
      </main>

      <footer className="footer">
        <span>
          Dibuat dengan ❤️ untuk memudahkan sedekah karya — Rahman Prasitama
          Putra
        </span>
      </footer>

      <style jsx>{`
        main {
          max-width: 1100px;
          margin: 0 auto;
          padding: 24px;
        }
        .hero {
          text-align: center;
          margin-bottom: 24px;
        }
        h1 {
          margin: 0 0 8px;
          font-size: 28px;
          letter-spacing: 0.5px;
        }
        .search input {
          margin-top: 12px;
          width: min(520px, 100%);
          border: 1px solid #d1d5db;
          border-radius: 999px;
          padding: 12px 16px;
          outline: none;
          font-size: 14px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        .footer {
          padding: 20px;
          text-align: center;
          color: #6b7280;
          font-size: 12px;
        }
      `}</style>

      <style jsx global>{`
        html, body, #__next {
          background: #f3f4f6;
          margin: 0;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto,
            Noto Sans, Ubuntu, Cantarell, Helvetica Neue, Arial, 'Apple Color Emoji',
            'Segoe UI Emoji';
        }
      `}</style>
    </>
  );
}
