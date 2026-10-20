import { useEffect, useRef, useState, type ReactNode } from "react";
import { create } from "zustand";

interface DialogRequest {
  kind: "prompt" | "confirm";
  title: string;
  message?: ReactNode;
  defaultValue?: string;
  confirmLabel?: string;
  danger?: boolean;
  /** Opção extra exibida como caixa de seleção no diálogo de confirmação. */
  checkbox?: string;
  resolve: (value: { ok: boolean; value: string; checked: boolean }) => void;
}

const useDialog = create<{ current: DialogRequest | null }>(() => ({ current: null }));

function open(req: Omit<DialogRequest, "resolve">) {
  return new Promise<{ ok: boolean; value: string; checked: boolean }>((resolve) => {
    useDialog.setState({ current: { ...req, resolve } });
  });
}

export async function promptText(title: string, defaultValue = "", confirmLabel = "OK") {
  const r = await open({ kind: "prompt", title, defaultValue, confirmLabel });
  return r.ok ? r.value.trim() : null;
}

export async function confirmAction(
  title: string,
  message?: ReactNode,
  opts: { confirmLabel?: string; danger?: boolean; checkbox?: string } = {},
) {
  const r = await open({ kind: "confirm", title, message, ...opts });
  return { ok: r.ok, checked: r.checked };
}

export function Modal({ children, onClose, className = "" }: { children: ReactNode; onClose: () => void; className?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full max-w-md rounded-xl border border-line bg-panel p-5 shadow-2xl ${className}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHost() {
  const current = useDialog((s) => s.current);
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (current) {
      setValue(current.defaultValue ?? "");
      setChecked(false);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [current]);

  if (!current) return null;
  const close = (ok: boolean) => {
    current.resolve({ ok, value, checked });
    useDialog.setState({ current: null });
  };

  return (
    <Modal onClose={() => close(false)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          close(true);
        }}
      >
        <h2 className="mb-3 text-base font-semibold">{current.title}</h2>
        {current.message && <div className="mb-4 text-sm text-muted">{current.message}</div>}
        {current.kind === "prompt" && (
          <input ref={inputRef} className="input mb-4" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        )}
        {current.checkbox && (
          <label className="mb-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            {current.checkbox}
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => close(false)}>
            Cancelar
          </button>
          <button type="submit" className={`btn ${current.danger ? "btn-danger" : "btn-primary"}`} autoFocus={current.kind === "confirm"}>
            {current.confirmLabel ?? "OK"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
