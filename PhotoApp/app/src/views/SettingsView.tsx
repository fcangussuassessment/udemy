import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { db, getSetting, setSetting, type Folder } from "../db/db";
import { toast, errorMessage } from "../store";
import { importFolder, scanFolder } from "../lib/import";
import { hasPermission, requestPermission, supportsFolderAccess } from "../lib/files";
import { exportBackup, importBackup } from "../lib/backup";
import { deleteAllAIData } from "../lib/ai";
import { purge } from "../lib/catalog";
import { useAuth, signOut } from "../lib/auth";
import { confirmAction, Modal } from "../components/Dialogs";
import { Icon } from "../components/Icon";
import { applyTheme, getTheme, type Theme } from "../components/theme";
import { formatBytes } from "../components/InfoPanel";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-panel p-5">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsView() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <FoldersSection />
        <AISection />
        <Section title="Aparência e idioma">
          <ThemePicker />
          <p className="mt-3 text-sm text-muted">Idioma: Português (Brasil)</p>
        </Section>
        <BackupSection />
        <ShortcutsSection />
      </div>
    </div>
  );
}

function FoldersSection() {
  const folders = useLiveQuery(() => db.folders.toArray(), []);
  return (
    <Section title="Pastas da biblioteca">
      {!supportsFolderAccess && (
        <p className="mb-3 rounded-md bg-panel-2 p-3 text-sm text-muted">
          Este navegador não permite acesso direto a pastas. As fotos importadas são copiadas para o armazenamento do navegador. Para usar suas pastas diretamente, use Chrome ou Edge.
        </p>
      )}
      <ul className="mb-3 divide-y divide-line">
        {folders?.map((f) => <FolderRow key={f.id} folder={f} />)}
        {folders?.length === 0 && <li className="py-2 text-sm text-muted">Nenhuma pasta adicionada.</li>}
      </ul>
      {supportsFolderAccess && (
        <button className="btn btn-primary" onClick={importFolder}>
          <Icon name="folder" /> Adicionar pasta
        </button>
      )}
    </Section>
  );
}

function FolderRow({ folder }: { folder: Folder }) {
  const count = useLiveQuery(() => db.photos.where("folderId").equals(folder.id).count(), [folder.id]);
  const [granted, setGranted] = useState<boolean | null>(null);
  useEffect(() => {
    if (folder.handle) hasPermission(folder.handle).then(setGranted);
  }, [folder.handle]);

  const rescan = async () => {
    if (!folder.handle) return importFolder();
    if (!(await requestPermission(folder.handle))) return toast("Permissão negada.", "error");
    setGranted(true);
    await scanFolder(folder.id);
  };

  const remove = async () => {
    const r = await confirmAction(`Remover a pasta "${folder.name}" da biblioteca?`, "As fotos saem do catálogo. Os arquivos no disco não são apagados.", { confirmLabel: "Remover", danger: true });
    if (!r.ok) return;
    const ids = await db.photos.where("folderId").equals(folder.id).primaryKeys();
    await purge(ids, false);
    await db.folders.delete(folder.id);
  };

  return (
    <li className="flex items-center gap-3 py-2 text-sm">
      <Icon name="folder" className="text-muted" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{folder.name}</div>
        <div className="text-xs text-muted">
          {count ?? 0} foto(s)
          {folder.lastScannedAt && ` · verificada em ${new Date(folder.lastScannedAt).toLocaleString("pt-BR")}`}
          {!folder.handle && " · desconectada (restaurada de backup)"}
          {folder.handle && granted === false && " · acesso precisa ser autorizado"}
        </div>
      </div>
      <button className="btn" onClick={rescan}>
        <Icon name="refresh" /> {folder.handle ? (granted === false ? "Autorizar" : "Verificar") : "Reconectar"}
      </button>
      <button className="btn-ghost btn !px-2 text-danger" onClick={remove} aria-label="Remover pasta">
        <Icon name="trash" />
      </button>
    </li>
  );
}

function AISection() {
  const consent = useLiveQuery(() => getSetting("aiConsent", false), []);
  const { user, required, serverOnline } = useAuth();
  const [showConsent, setShowConsent] = useState(false);
  const analyzed = useLiveQuery(() => db.aiAnnotations.count(), []);

  return (
    <Section title="Inteligência artificial e privacidade">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={!!consent}
          onChange={(e) => (e.target.checked ? setShowConsent(true) : setSetting("aiConsent", false))}
        />
        <span>
          <span className="font-medium">Usar IA para tags, descrições, busca e aprimoramento</span>
          <span className="block text-sm text-muted">{analyzed ?? 0} foto(s) já analisada(s).</span>
        </span>
      </label>
      <div className="mt-4 text-sm">
        {!serverOnline ? (
          <p className="text-danger">Servidor de IA offline. Inicie-o com <code>npm run dev</code>.</p>
        ) : !required ? (
          <p className="text-muted">Servidor em modo de desenvolvimento: login com Google desativado.</p>
        ) : user ? (
          <p className="flex items-center gap-2">
            Conectado como <strong>{user.email}</strong>
            <button className="btn-ghost btn !py-0.5" onClick={signOut}>Sair</button>
          </p>
        ) : (
          <p className="text-muted">Entre com sua conta Google (barra lateral, embaixo) para usar a IA.</p>
        )}
      </div>
      <button
        className="btn mt-4 text-danger"
        onClick={async () => {
          const r = await confirmAction("Apagar todos os dados da IA?", "Descrições, textos alternativos e tags geradas pela IA serão removidos. Tags que você criou continuam.", { confirmLabel: "Apagar", danger: true });
          if (r.ok) {
            await deleteAllAIData();
            toast("Dados da IA apagados.", "success");
          }
        }}
      >
        Apagar dados da IA
      </button>
      {showConsent && (
        <ConsentDialog
          onClose={() => setShowConsent(false)}
          onAccept={async () => {
            await setSetting("aiConsent", true);
            setShowConsent(false);
            toast("IA ativada.", "success");
          }}
        />
      )}
    </Section>
  );
}

/** US-07: explica o que é (e o que não é) enviado antes de ativar a IA. */
export function ConsentDialog({ onClose, onAccept }: { onClose: () => void; onAccept: () => void }) {
  return (
    <Modal onClose={onClose} className="max-w-lg">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <Icon name="sparkles" className="text-accent" /> Ativar recursos de IA
      </h2>
      <div className="space-y-3 text-sm">
        <p>Para gerar tags, descrições, buscar por frases e sugerir ajustes, o Lumina usa o Claude, da Anthropic.</p>
        <div className="rounded-md bg-panel-2 p-3">
          <p className="mb-1 font-medium">O que é enviado</p>
          <ul className="list-disc space-y-0.5 pl-5 text-muted">
            <li>Uma miniatura reduzida (até 1024 px) de cada foto que você mandar analisar.</li>
            <li>O texto das buscas em linguagem natural.</li>
          </ul>
        </div>
        <div className="rounded-md bg-panel-2 p-3">
          <p className="mb-1 font-medium">O que nunca é enviado</p>
          <ul className="list-disc space-y-0.5 pl-5 text-muted">
            <li>Os arquivos originais, que continuam só no seu dispositivo.</li>
            <li>Dados EXIF e localização GPS.</li>
            <li>Nomes de arquivos, álbuns e pastas.</li>
          </ul>
        </div>
        <p className="text-muted">O servidor do Lumina não guarda as imagens. Você pode desativar a IA e apagar todos os dados gerados a qualquer momento.</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Agora não</button>
        <button className="btn btn-primary" onClick={onAccept}>Concordo, ativar IA</button>
      </div>
    </Modal>
  );
}

function ThemePicker() {
  const [theme, setTheme] = useState<Theme>(getTheme());
  const options: { value: Theme; label: string }[] = [
    { value: "dark", label: "Escuro" },
    { value: "light", label: "Claro" },
    { value: "system", label: "Sistema" },
  ];
  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Tema">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={theme === o.value}
          className={`btn ${theme === o.value ? "!border-accent text-accent" : ""}`}
          onClick={() => {
            setTheme(o.value);
            applyTheme(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function BackupSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [usage, setUsage] = useState<string | null>(null);
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => e.usage !== undefined && setUsage(`${formatBytes(e.usage)} de ${formatBytes(e.quota ?? 0)}`));
  }, []);

  return (
    <Section title="Backup do catálogo">
      <p className="mb-3 text-sm text-muted">
        O backup guarda álbuns, tags, avaliações, edições e dados da IA (não inclui as fotos). Ao restaurar, reconecte as pastas para recriar as miniaturas. Fotos importadas por arrastar e soltar não são incluídas.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => exportBackup().catch((e) => toast(errorMessage(e), "error"))}>
          <Icon name="download" /> Exportar backup
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" /> Restaurar backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const r = await confirmAction("Restaurar backup?", "O catálogo atual será substituído pelo do backup.", { confirmLabel: "Restaurar", danger: true });
            if (!r.ok) return;
            try {
              const n = await importBackup(file);
              toast(`Backup restaurado: ${n} foto(s). Reconecte as pastas em “Pastas da biblioteca”.`, "success");
            } catch (err) {
              toast(errorMessage(err), "error");
            }
          }}
        />
      </div>
      {usage && <p className="mt-3 text-xs text-muted">Espaço usado no navegador: {usage}</p>}
    </Section>
  );
}

const SHORTCUTS: [string, string][] = [
  ["Ctrl + K", "Buscar"],
  ["Setas", "Navegar na grade"],
  ["Enter / duplo clique", "Abrir no visualizador"],
  ["← →", "Foto anterior / próxima (visualizador)"],
  ["1 – 5 / 0", "Dar nota / remover nota"],
  ["F", "Favorita"],
  ["X", "Rejeitar"],
  ["6 – 9", "Rótulo de cor"],
  ["E", "Editar"],
  ["I", "Painel de informações"],
  ["Delete", "Mover para a lixeira"],
  ["Ctrl + A", "Selecionar tudo"],
  ["Ctrl + Z / Ctrl + Shift + Z", "Desfazer / refazer (editor)"],
  ["C", "Cortar (editor)"],
  ["\\", "Antes/depois (editor)"],
];

function ShortcutsSection() {
  return (
    <Section title="Atalhos de teclado">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        {SHORTCUTS.map(([k, d]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-line py-1">
            <dt className="text-muted">{d}</dt>
            <dd><kbd className="rounded border border-line bg-panel-2 px-1.5 text-xs">{k}</kbd></dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
