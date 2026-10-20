import { useEffect, useState } from "react";
import { db } from "../db/db";
import { useApp } from "../store";

// Object URLs das miniaturas, por foto e versão (a versão muda quando a foto é editada).
const cache = new Map<number, { version: number; url: Promise<string | null> }>();

function load(photoId: number, version: number): Promise<string | null> {
  const hit = cache.get(photoId);
  if (hit && hit.version === version) return hit.url;
  // Libera a URL antiga só depois que as telas já trocaram para a nova.
  hit?.url.then((u) => u && setTimeout(() => URL.revokeObjectURL(u), 5000));
  const url = db.thumbs.get(photoId).then((t) => {
    const blob = t?.edited ?? t?.original;
    return blob ? URL.createObjectURL(blob) : null;
  });
  cache.set(photoId, { version, url });
  return url;
}

export function useThumbUrl(photoId: number | undefined): string | null {
  const version = useApp((s) => (photoId ? (s.thumbVersion[photoId] ?? 0) : 0));
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photoId) return;
    let alive = true;
    load(photoId, version).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [photoId, version]);
  return url;
}
