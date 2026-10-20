# Lumina: organizador de fotos com IA

Aplicativo web e local-first para catalogar, organizar, editar e encontrar fotos com a ajuda do Claude. Projeto de estudo, gratuito e sem custos para o usuário. Os requisitos estão em [documentos/PRD.md](documentos/PRD.md).

## Estrutura

```
app/      Front-end React + TypeScript + Vite (PWA)
  src/db/          Catálogo local (IndexedDB via Dexie)
  src/lib/         Importação, busca, IA, login Google, backup, motor de edição (WebGL2)
  src/components/  Grade, visualizador, editor, painéis
  src/views/       Álbuns, Tags, Fila de IA, Configurações
server/   Proxy Node/Express: valida o login Google e chama a API do Claude
documentos/PRD.md
```

## Como rodar

```bash
npm install
cp server/.env.example server/.env   # preencha ANTHROPIC_API_KEY (e GOOGLE_CLIENT_ID, se quiser login)
npm run dev
```

Abra http://localhost:5173. Use Chrome ou Edge para ter acesso direto às pastas do disco. Em outros navegadores, as fotos são copiadas para o armazenamento do navegador.

### Variáveis do servidor (`server/.env`)

| Variável | Descrição |
|---|---|
| `ANTHROPIC_API_KEY` | Chave da API do Claude. Sem ela, só os recursos de IA ficam indisponíveis. |
| `ANTHROPIC_MODEL` | Modelo usado. Padrão: `claude-opus-5-5`. |
| `GOOGLE_CLIENT_ID` | Client ID OAuth do Google (tipo "Aplicativo da Web", origem `http://localhost:5173`). **Vazio = modo de desenvolvimento**: a IA funciona sem login. |
| `PORT` | Porta do servidor (padrão 8787). |

## Privacidade

- Os arquivos originais nunca saem do dispositivo. O catálogo fica no IndexedDB do navegador.
- Para a IA, vai apenas uma miniatura JPEG de até 1024 px, sem EXIF nem GPS, e só depois do consentimento em Configurações.
- O servidor não guarda imagens e aplica limite de requisições contra abuso da chave.

## Funcionalidades (MVP do PRD)

- **Importação:** pastas pela File System Access API, arrastar e soltar (arquivos ou pastas), EXIF, miniaturas, duplicatas por SHA-256, nova varredura de pastas.
- **Biblioteca:** grade virtualizada com linha do tempo por mês, filtros, ordenação, seleção múltipla, notas, favoritas, rótulos de cor, rejeição e lixeira.
- **Álbuns:** criar, renomear, capa, ordem manual (arrastar) e arrastar fotos para um álbum na barra lateral.
- **Tags:** tags manuais com autocompletar, gerenciador (renomear, mesclar, excluir) e sugestões da IA com aceitar/rejeitar.
- **Editor não-destrutivo (WebGL2):** luz, cor, corte com proporções, girar, espelhar, endireitar, predefinições, copiar/colar ajustes, desfazer/refazer, antes/depois e exportação JPEG/WebP/PNG sem metadados.
- **IA:** tags, descrições, texto alternativo, "Aprimorar com IA", busca em linguagem natural e fila com pausa e cache.
- **Busca:** `Ctrl+K`, com sintaxe `tag:praia ano:2024 nota:>=4 fav camera:canon album:viagem` ou frases.
- **Configurações:** pastas, IA e consentimento, tema claro/escuro, backup e restauração do catálogo, atalhos.
