import { useState } from "react";
import { Modal } from "./Dialogs";
import { exportMany } from "../lib/actions";
import type { ExportFormat, ExportSettings } from "../lib/editor/export";

const SIZES = [
  { label: "Original", value: 0 },
  { label: "4096 px", value: 4096 },
  { label: "2048 px", value: 2048 },
  { label: "1080 px (redes sociais)", value: 1080 },
];

/** RF-49: exportação com formato, tamanho e qualidade. Metadados/GPS sempre removidos. */
export function ExportDialog({ ids, onClose, onExport }: { ids: number[]; onClose: () => void; onExport?: (s: ExportSettings) => Promise<void> }) {
  const [format, setFormat] = useState<ExportFormat>("image/jpeg");
  const [maxSide, setMaxSide] = useState(2048);
  const [quality, setQuality] = useState(85);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const settings = { format, maxSide, quality: quality / 100 };
    try {
      if (onExport) await onExport(settings);
      else await exportMany(ids, settings);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="mb-4 text-base font-semibold">Exportar {ids.length} foto(s)</h2>
      <div className="space-y-3 text-sm">
        <label className="block">
          <span className="mb-1 block text-muted">Formato</span>
          <select className="input" value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
            <option value="image/jpeg">JPEG</option>
            <option value="image/webp">WebP</option>
            <option value="image/png">PNG</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-muted">Tamanho (lado maior)</span>
          <select className="input" value={maxSide} onChange={(e) => setMaxSide(Number(e.target.value))}>
            {SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        {format !== "image/png" && (
          <label className="block">
            <span className="mb-1 flex justify-between text-muted">Qualidade <span>{quality}%</span></span>
            <input type="range" min={40} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
          </label>
        )}
        <p className="text-xs text-muted">Os metadados (EXIF e localização GPS) são removidos dos arquivos exportados.</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={run} disabled={busy}>{busy ? "Exportando…" : "Exportar"}</button>
      </div>
    </Modal>
  );
}
