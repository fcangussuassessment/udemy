# PRD — Lumina: Organizador de Fotos com IA

| Campo | Valor |
|---|---|
| **Produto** | Lumina (nome provisório) |
| **Versão do documento** | 0.2 |
| **Data** | 2026-10-19 |
| **Autor** | Fernando |
| **Status** | Rascunho |
| **Natureza** | Projeto de estudo — exercício de uso do Claude para gerar o app. Gratuito, sem qualquer custo para o usuário |

---

## Sumário

1. [Visão geral e problema](#1-visão-geral-e-problema)
2. [Objetivos e não-objetivos](#2-objetivos-e-não-objetivos)
3. [Personas](#3-personas)
4. [Requisitos funcionais](#4-requisitos-funcionais)
5. [Requisitos não-funcionais](#5-requisitos-não-funcionais)
6. [Experiência e design](#6-experiência-e-design)
7. [Arquitetura proposta](#7-arquitetura-proposta)
8. [Modelo de dados](#8-modelo-de-dados)
9. [User stories e critérios de aceite](#9-user-stories-e-critérios-de-aceite)
10. [Escopo por fase](#10-escopo-por-fase)
11. [Métricas de sucesso](#11-métricas-de-sucesso)
12. [Riscos e mitigações](#12-riscos-e-mitigações)
13. [Questões em aberto](#13-questões-em-aberto)
14. [Glossário](#14-glossário)

---

## 1. Visão geral e problema

### 1.1 Problema

As pessoas acumulam milhares de fotos espalhadas entre pastas do computador, HDs externos, cartões de memória e downloads do celular. Encontrar uma foto específica ("aquela do aniversário na praia em 2022") é lento e frustrante. As alternativas atuais têm limitações:

- **Ferramentas profissionais** (ex.: Lightroom) são poderosas, mas caras, pesadas e com curva de aprendizado alta.
- **Serviços em nuvem** (ex.: Google Fotos, iCloud) são fáceis, mas exigem enviar toda a biblioteca para terceiros, e prendem o usuário ao ecossistema.
- **Gerenciadores de arquivos do sistema** não oferecem álbuns, tags, avaliação, edição nem busca por conteúdo.

### 1.2 Proposta de valor

**Lumina** é um gerenciador de fotos **web, local-first e com IA**: roda no navegador, trabalha diretamente com as fotos no disco do usuário (sem upload da biblioteca), oferece uma interface bonita e rápida para catalogar, organizar em álbuns, marcar com tags e editar de forma não-destrutiva — e usa IA (Claude) para gerar tags e legendas automaticamente, sugerir aprimoramentos e permitir **busca em linguagem natural**.

> *"Todas as suas fotos, organizadas e encontráveis em segundos — sem abrir mão da privacidade."*

---

## 2. Objetivos e não-objetivos

### 2.1 Objetivos

| # | Objetivo | Como mediremos |
|---|---|---|
| O1 | Permitir que o usuário importe e navegue por uma biblioteca grande de forma fluida | Grade fluida (60 fps) com 50 mil fotos |
| O2 | Tornar a organização (álbuns, tags, avaliações) rápida, inclusive em lote | Tempo médio para organizar 100 fotos < 5 min |
| O3 | Fazer qualquer foto ser encontrável por descrição em linguagem natural | ≥ 80% de buscas IA com clique em um dos 10 primeiros resultados |
| O4 | Oferecer edição não-destrutiva suficiente para 90% dos ajustes do dia a dia | % de fotos editadas exportadas sem uso de outra ferramenta |
| O5 | Preservar a privacidade: originais nunca saem do dispositivo | 0 originais enviados; IA apenas com consentimento explícito |

### 2.2 Não-objetivos

- **Não tem monetização:** o app é **100% gratuito** — sem planos pagos, assinaturas, quotas de uso, anúncios ou compras.
- **Não é rede social:** sem feed, curtidas ou perfis públicos.
- **Não substitui o Photoshop:** sem camadas, máscaras avançadas, clonagem ou retoque de pele no MVP.
- **Não é armazenamento em nuvem:** no MVP não hospedamos as fotos do usuário.
- **Não é app mobile nativo** no MVP (a versão web deve ser responsiva, mas o foco é desktop).
- **Não processa vídeos** no MVP (vídeos podem ser listados, mas sem edição).

---

## 3. Personas

### 3.1 Marina — Fotógrafa entusiasta (persona primária)
- 32 anos, fotografa com câmera mirrorless nos fins de semana; ~40 mil fotos em HD externo.
- **Necessidades:** importar cartões rapidamente, avaliar e descartar fotos ruins, ajustar exposição/cor, exportar para redes sociais.
- **Dores:** Lightroom é pesado e complexo; perde tempo procurando fotos antigas.
- **Frase:** *"Quero escolher as 20 melhores de uma sessão de 600 fotos em meia hora."*

### 3.2 Carlos — Guardião das memórias da família
- 45 anos, junta fotos de celular da família inteira em uma pasta no PC; ~15 mil fotos desorganizadas.
- **Necessidades:** álbuns por evento ("Natal 2024"), achar fotos por pessoa/lugar, remover duplicatas.
- **Dores:** não tem paciência para marcar foto por foto; desconfia de enviar fotos dos filhos para a nuvem.
- **Frase:** *"Quero digitar 'vovó no sítio' e a foto aparecer."*

### 3.3 Júlia — Criadora de conteúdo
- 27 anos, produz conteúdo para Instagram e blog; reutiliza fotos em várias campanhas.
- **Necessidades:** tags por cliente/campanha, texto alternativo e legendas, exportação em vários tamanhos.
- **Dores:** escrever legendas e alt text toma tempo; difícil saber quais fotos já foram usadas.
- **Frase:** *"Preciso achar 'fotos verticais de café com luz natural' para o próximo post."*

---

## 4. Requisitos funcionais

Prioridade (MoSCoW): **M** = Must (obrigatório no MVP), **S** = Should, **C** = Could, **W** = Won't (agora).

### 4.1 Importação

| ID | Requisito | Prioridade |
|---|---|---|
| RF-01 | Adicionar uma ou mais **pastas locais** à biblioteca via File System Access API, com varredura recursiva | M |
| RF-02 | Importar arquivos por **arrastar e soltar** e por seletor de arquivos (fallback para navegadores sem File System Access API) | M |
| RF-03 | Suportar JPEG, PNG, WebP e GIF; HEIC/AVIF quando o navegador suportar | M |
| RF-04 | Ler metadados **EXIF/IPTC/XMP** (data, câmera, lente, ISO, abertura, GPS, orientação) | M |
| RF-05 | Gerar miniaturas em segundo plano, com barra de progresso e possibilidade de cancelar | M |
| RF-06 | Detectar **duplicatas exatas** (hash do arquivo) e **quase duplicatas** (hash perceptual) | S |
| RF-07 | Monitorar pastas e detectar arquivos novos/removidos ao reabrir o app | S |
| RF-08 | Suporte a arquivos RAW (CR3, NEF, ARW, DNG) via prévia embutida | C |

### 4.2 Biblioteca e catálogo

| ID | Requisito | Prioridade |
|---|---|---|
| RF-10 | **Grade virtualizada** de miniaturas com zoom (tamanho ajustável) | M |
| RF-11 | Visualização em **linha do tempo** agrupada por ano/mês/dia | M |
| RF-12 | **Visualizador em tela cheia** com navegação por teclado, zoom e painel de metadados | M |
| RF-13 | **Avaliação** de 1 a 5 estrelas, **favorito** e **rótulos de cor** | M |
| RF-14 | **Filtros** combináveis: data, câmera/lente, avaliação, favorito, tag, álbum, rótulo de cor, orientação, com/sem GPS | M |
| RF-15 | Ordenação por data de captura, data de importação, nome, avaliação | M |
| RF-16 | **Seleção múltipla** (clique, Shift, Ctrl/Cmd, arrastar) e ações em lote | M |
| RF-17 | Modo **"Triagem"** (culling): navegação rápida com atalhos para aceitar/rejeitar/avaliar | S |
| RF-18 | Visualização em **mapa** para fotos com GPS | C |
| RF-19 | Lixeira do catálogo (remover do catálogo sem apagar o arquivo; apagar do disco com confirmação) | M |

### 4.3 Álbuns

| ID | Requisito | Prioridade |
|---|---|---|
| RF-20 | Criar, renomear, excluir **álbuns manuais**; uma foto pode estar em vários álbuns | M |
| RF-21 | Adicionar fotos a álbuns por arrastar e soltar, menu de contexto ou atalho | M |
| RF-22 | Definir **capa** do álbum e ordenação manual das fotos dentro dele | S |
| RF-23 | **Pastas de álbuns** (aninhamento, ex.: "Viagens › 2024 › Portugal") | S |
| RF-24 | **Álbuns inteligentes** baseados em regras (ex.: "avaliação ≥ 4 E tag = praia E ano = 2024"), atualizados automaticamente | S |
| RF-25 | **Sugestão de álbuns pela IA** (agrupar fotos por evento/data/local/tema) | C |

### 4.4 Tags e marcação

| ID | Requisito | Prioridade |
|---|---|---|
| RF-30 | Adicionar/remover **tags livres** em uma ou várias fotos, com autocompletar | M |
| RF-31 | **Tags hierárquicas** (ex.: `Lugares/Brasil/Rio de Janeiro`) | S |
| RF-32 | Gerenciador de tags: renomear, mesclar, excluir, ver contagem de uso | M |
| RF-33 | Distinção visual entre tags manuais e tags sugeridas pela IA (aceitar/rejeitar) | M |
| RF-34 | Gravar tags e avaliações de volta nos arquivos (XMP sidecar) | C |

### 4.5 Edição não-destrutiva

Todas as edições são armazenadas como uma **pilha de ajustes** no catálogo; o arquivo original nunca é alterado.

| ID | Requisito | Prioridade |
|---|---|---|
| RF-40 | **Cortar**, girar, espelhar e **endireitar**; proporções predefinidas (1:1, 4:5, 16:9, livre) | M |
| RF-41 | Ajustes básicos: **exposição, contraste, realces, sombras, brancos, pretos** | M |
| RF-42 | Cor: **temperatura, matiz, vibração, saturação** | M |
| RF-43 | **Curvas** de tons (RGB e por canal) | S |
| RF-44 | Nitidez, redução de ruído simples, vinheta | S |
| RF-45 | **Filtros/predefinições** prontos e predefinições criadas pelo usuário; aplicar em lote | S |
| RF-46 | **Histórico** com desfazer/refazer ilimitado e "voltar ao original" | M |
| RF-47 | Comparação **antes/depois** (lado a lado e cortina deslizante) | M |
| RF-48 | Copiar/colar ajustes entre fotos | S |
| RF-49 | **Exportar** em JPEG/PNG/WebP com escolha de tamanho, qualidade, remoção de metadados/GPS e exportação em lote | M |

### 4.6 Inteligência artificial (Claude API)

Toda funcionalidade de IA é **opt-in**. Antes do primeiro uso, o app explica que apenas **miniaturas reduzidas** (ex.: lado maior de 1024 px) são enviadas para a API, e o usuário precisa consentir.

| ID | Requisito | Prioridade |
|---|---|---|
| RF-50 | **Auto-tagging:** gerar tags (objetos, cenas, cores, atividades, clima) para fotos selecionadas ou para toda a biblioteca | M |
| RF-51 | **Legendas e descrições:** gerar descrição em linguagem natural de cada foto (usada para a busca) | M |
| RF-52 | **Busca em linguagem natural:** "praia ao pôr do sol com cachorro", "fotos verticais de café" — combinando descrições geradas, tags e metadados | M |
| RF-53 | **Sugestões de aprimoramento:** a IA analisa a foto e propõe valores de ajuste (exposição, balanço de branco, corte) aplicados **localmente** como uma edição normal e reversível | S |
| RF-54 | **Texto alternativo** (acessibilidade) e sugestões de legenda para redes sociais | S |
| RF-55 | Processamento em **fila** com progresso, pausa, retomada e contagem de fotos a processar | M |
| RF-56 | **Cache** de resultados: uma foto nunca é reenviada se já foi analisada (salvo pedido explícito) | M |
| RF-57 | Sugestão de **álbuns/eventos** (ver RF-25) e de **melhores fotos** de uma série | C |
| RF-58 | Perguntas sobre a biblioteca ("quantas fotos tirei em Lisboa?") | C |

### 4.7 Busca

| ID | Requisito | Prioridade |
|---|---|---|
| RF-60 | Barra de busca global (atalho `Ctrl/Cmd + K`) | M |
| RF-61 | Busca por texto em nome de arquivo, tags, legendas, descrições de IA e metadados | M |
| RF-62 | Sintaxe de filtros na busca (ex.: `tag:praia ano:2024 nota:>=4`) | S |
| RF-63 | Busca semântica via IA quando a consulta é linguagem natural (ver RF-52) | M |
| RF-64 | Salvar uma busca como álbum inteligente | S |

### 4.8 Configurações e dados

| ID | Requisito | Prioridade |
|---|---|---|
| RF-70 | Gerenciar pastas da biblioteca (adicionar, remover, reescanear) | M |
| RF-71 | Ativar/desativar IA; ver quantas fotos já foram analisadas | M |
| RF-72 | Tema **claro/escuro/sistema** | M |
| RF-73 | Idioma (pt-BR no MVP; en no futuro) | M |
| RF-74 | **Backup e restauração** do catálogo (exportar/importar arquivo do banco) | M |
| RF-75 | Personalização de atalhos de teclado | C |
| RF-76 | **Login com Google** (OAuth) para usar os recursos de IA; o restante do app funciona sem login | M |
| RF-77 | Sair da conta e exibir nome/foto do usuário logado | M |

---

## 5. Requisitos não-funcionais

| ID | Categoria | Requisito |
|---|---|---|
| RNF-01 | Desempenho | Grade com rolagem a 60 fps em bibliotecas de até **50 mil fotos** |
| RNF-02 | Desempenho | Abrir uma foto no visualizador em **< 300 ms** (miniatura em cache) |
| RNF-03 | Desempenho | Importação de 1.000 fotos (indexação + miniaturas) em **< 2 min** em hardware médio |
| RNF-04 | Desempenho | Ajustes de edição refletidos na prévia em **< 50 ms** (processamento via GPU/WebGL) |
| RNF-05 | Desempenho | Busca local retorna resultados em **< 200 ms**; busca IA em **< 3 s** |
| RNF-06 | Privacidade | Arquivos originais **nunca** saem do dispositivo; apenas miniaturas reduzidas vão para a IA, com consentimento |
| RNF-07 | Privacidade | Metadados GPS **não** são enviados para a IA por padrão |
| RNF-08 | Privacidade | Conformidade com a **LGPD**: política de privacidade clara, possibilidade de apagar todos os dados de IA |
| RNF-09 | Segurança | A chave da API do Claude **nunca** fica no navegador; requisições passam por um proxy backend que valida o **login Google** e aplica limite de taxa contra abuso |
| RNF-10 | Offline | Todas as funções exceto IA funcionam **offline** (PWA instalável) |
| RNF-11 | Compatibilidade | Suporte completo em **Chrome e Edge** (desktop); Firefox e Safari com fallback (importação por upload para o armazenamento privado do navegador - OPFS) |
| RNF-12 | Acessibilidade | **WCAG 2.1 nível AA**: navegação completa por teclado, contraste, leitores de tela, texto alternativo |
| RNF-13 | Confiabilidade | Catálogo salvo de forma transacional; nenhuma perda de dados em caso de fechamento do navegador |
| RNF-14 | Responsividade | Layout utilizável de 1280 px até 4K; modo de leitura em tablets |
| RNF-15 | Manutenibilidade | Código em TypeScript estrito, cobertura de testes ≥ 70% na lógica de domínio |
| RNF-16 | Internacionalização | Todas as strings externalizadas; datas e números no formato local |

---

## 6. Experiência e design

### 6.1 Princípios

1. **As fotos são as protagonistas:** interface escura por padrão, cromo mínimo, painéis recolhíveis.
2. **Rápido de verdade:** nada bloqueia a interface; tudo pesado roda em segundo plano.
3. **Teclado primeiro, mouse amigável:** atalhos para tudo (avaliar `1–5`, favorito `F`, rejeitar `X`, editar `E`, buscar `Ctrl+K`).
4. **Lote por padrão:** qualquer ação que funciona em uma foto funciona em uma seleção.
5. **IA como assistente, não como dona:** sugestões sempre visíveis, revisáveis e reversíveis.
6. **Nada é destrutivo sem confirmação:** edição não-destrutiva e lixeira do catálogo.

### 6.2 Telas principais

| Tela | Descrição |
|---|---|
| **Biblioteca** | Barra lateral esquerda (Biblioteca, Favoritos, Recentes, Álbuns, Tags, Pastas), grade central com zoom, barra superior com busca e filtros, painel direito recolhível com metadados/tags da seleção |
| **Visualizador** | Foto em tela cheia, setas para navegar, tira de miniaturas inferior, painel de informações (EXIF, tags, descrição IA, álbuns) |
| **Editor** | Foto ao centro, painel direito com seções recolhíveis (Corte, Luz, Cor, Curvas, Detalhes, Predefinições), botão "Aprimorar com IA", histórico, antes/depois |
| **Álbuns** | Grade de álbuns com capas, pastas de álbuns, criação de álbum inteligente com editor de regras visual |
| **Busca** | Resultados em grade com destaque do motivo do resultado (tag, descrição, metadado) e chips de filtros |
| **Fila de IA** | Lista de tarefas de IA, progresso, pausar/retomar |
| **Configurações** | Conta Google (entrar/sair), pastas, IA e privacidade, aparência, idioma, atalhos, backup |
| **Onboarding** | Boas-vindas → escolher pasta → importação com progresso → convite opcional para entrar com Google e ativar IA |

### 6.3 Estados importantes
- **Biblioteca vazia:** chamada clara para "Adicionar pasta" com ilustração.
- **Permissão de pasta perdida** (navegador revogou acesso): banner pedindo para reautorizar.
- **Offline:** recursos de IA desativados com aviso discreto.
- **Erro de IA / serviço indisponível:** mensagem clara e opção de tentar depois.
- **Não logado:** recursos de IA mostram botão "Entrar com Google".

---

## 7. Arquitetura proposta

### 7.1 Visão geral

```
┌────────────────────────── Navegador (PWA) ──────────────────────────┐
│                                                                     │
│  UI (React + TypeScript)                                            │
│   ├─ Biblioteca / Visualizador / Editor / Álbuns / Busca            │
│   └─ Estado (Zustand) + consultas reativas ao catálogo              │
│                                                                     │
│  Web Workers                                                        │
│   ├─ Varredura de pastas, hash (SHA-256 / pHash), EXIF              │
│   ├─ Geração de miniaturas (OffscreenCanvas)                        │
│   └─ Índice de busca (full-text)                                    │
│                                                                     │
│  Motor de edição (WebGL2) ── pilha de ajustes → prévia / exportação │
│                                                                     │
│  Armazenamento local                                                │
│   ├─ Catálogo: SQLite WASM persistido em OPFS                       │
│   ├─ Miniaturas: OPFS                                               │
│   └─ Originais: disco do usuário (File System Access API handles)   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTPS (só miniaturas + texto)
                     ┌──────────▼──────────┐
                     │  Proxy de IA        │  valida login Google, limite de
                     │  (serverless/Node)  │  taxa, sem guardar fotos
                     └──────────┬──────────┘
                                │
                     ┌──────────▼──────────┐
                     │  Claude API         │
                     └─────────────────────┘
```

### 7.2 Stack sugerida

| Camada | Tecnologia |
|---|---|
| Front-end | React 19 + TypeScript + Vite |
| UI | Tailwind CSS + Radix UI (componentes acessíveis) |
| Estado | Zustand + TanStack Query |
| Virtualização da grade | TanStack Virtual |
| Catálogo | SQLite WASM (OPFS) com FTS5 para busca textual |
| Metadados | `exifr` |
| Edição | WebGL2 (shaders próprios) |
| PWA/offline | Workbox (service worker) |
| Autenticação | Login com Google (Google Identity Services / OAuth 2.0); token validado no proxy |
| Proxy de IA | Função serverless (Node/TypeScript) com SDK oficial da Anthropic |
| IA | Claude API — modelo com visão (ex.: `claude-sonnet-5-5`) para tags, legendas e sugestões; respostas em JSON estruturado |
| Testes | Vitest (unidade), Playwright (ponta a ponta) |

### 7.3 Fluxo da IA

1. Usuário seleciona fotos e clica em "Analisar com IA" (ou ativa análise automática).
2. Worker gera miniatura de 1024 px (sem EXIF/GPS) e a coloca na fila.
3. Cliente envia lotes ao proxy; proxy valida o token do login Google e chama a Claude API pedindo um **JSON estruturado**: `{ tags[], descricao, alt_text, sugestoes_ajuste{} }`.
4. Resultado salvo em `AIAnnotation`; tags entram como "sugeridas"; descrição é indexada no FTS.
5. **Busca em linguagem natural:** a consulta é enviada ao proxy, que a converte em termos/sinônimos e filtros estruturados (ex.: `{termos:["praia","pôr do sol","cachorro"], ano:null}`); a busca executa **localmente** sobre descrições, tags e metadados. Opcionalmente, a IA reordena os ~50 melhores candidatos usando as descrições (sem reenviar imagens).

---

## 8. Modelo de dados

```
Photo
  id, folder_id, relative_path, file_name, file_size, mime_type,
  sha256, phash, width, height, orientation,
  taken_at, imported_at, camera_make, camera_model, lens,
  iso, aperture, shutter_speed, focal_length, gps_lat, gps_lng,
  rating (0–5), is_favorite, color_label, is_rejected, deleted_at

Folder        id, name, handle_ref, last_scanned_at
Album         id, name, parent_id (pasta de álbuns), cover_photo_id,
              type (manual | smart), created_at, sort_mode
AlbumPhoto    album_id, photo_id, position
SmartAlbumRule id, album_id, field, operator, value, group (AND/OR)
Tag           id, name, parent_id (hierarquia), color
PhotoTag      photo_id, tag_id, source (manual | ai), confidence, status (suggested | accepted | rejected)
Edit          id, photo_id, version, adjustments_json, created_at   -- pilha não-destrutiva
Preset        id, name, adjustments_json, is_builtin
AIAnnotation  photo_id, model, description, alt_text, raw_json, analyzed_at
AIJob         id, type, status, photo_ids, progress, error, created_at
Export        id, photo_ids, settings_json, created_at
```

Índices: `taken_at`, `sha256`, `rating`, `PhotoTag(tag_id)`, tabela FTS5 sobre `file_name + tags + description + alt_text`.

---

## 9. User stories e critérios de aceite

### US-01 — Importar uma pasta
**Como** Marina, **quero** adicionar a pasta do meu HD **para** ver todas as minhas fotos no app.
- **Dado** que estou na biblioteca vazia, **quando** clico em "Adicionar pasta" e autorizo o acesso, **então** o app varre a pasta recursivamente e mostra o progresso.
- **Dado** que a importação está em andamento, **quando** navego no app, **então** as fotos já processadas aparecem na grade e a interface não trava.
- **Dado** que uma foto já existe na biblioteca (mesmo hash), **quando** importo novamente, **então** ela não é duplicada.

### US-02 — Criar um álbum e adicionar fotos
**Como** Carlos, **quero** criar o álbum "Natal 2024" **para** reunir as fotos do evento.
- **Dado** que selecionei 30 fotos, **quando** escolho "Adicionar ao álbum › Novo álbum" e digito o nome, **então** o álbum é criado contendo as 30 fotos.
- **Dado** que uma foto está no álbum, **quando** a removo do álbum, **então** ela continua na biblioteca.

### US-03 — Marcar fotos em lote
**Como** Júlia, **quero** aplicar a tag "Cliente Café Aroma" em várias fotos **para** encontrá-las depois.
- **Dado** que selecionei várias fotos, **quando** digito uma tag no painel de tags, **então** ela é aplicada a todas e o autocompletar sugere tags existentes.
- **Dado** que a IA sugeriu tags, **quando** clico em "aceitar todas", **então** elas passam de "sugeridas" para "aceitas".

### US-04 — Editar e exportar
**Como** Marina, **quero** ajustar a exposição e cortar uma foto **para** publicá-la.
- **Dado** que abri o editor, **quando** movo o controle de exposição, **então** a prévia atualiza em tempo real (< 50 ms).
- **Dado** que fiz edições, **quando** clico em "Voltar ao original", **então** a foto volta ao estado original e o arquivo em disco nunca foi alterado.
- **Dado** que terminei a edição, **quando** exporto em JPEG 2048 px qualidade 85% sem GPS, **então** o arquivo é salvo na pasta escolhida com essas configurações.

### US-05 — Aprimorar com IA
**Como** Carlos, **quero** clicar em "Aprimorar com IA" **para** melhorar uma foto escura sem entender de edição.
- **Dado** que a IA está ativada, **quando** clico em "Aprimorar com IA", **então** os ajustes sugeridos são aplicados como uma edição visível no histórico e posso desfazê-los.

### US-06 — Buscar em linguagem natural
**Como** Carlos, **quero** digitar "vovó no sítio com as galinhas" **para** achar a foto sem lembrar a data.
- **Dado** que as fotos foram analisadas pela IA, **quando** digito a frase na busca, **então** recebo resultados relevantes em < 3 s, com indicação do motivo de cada resultado.
- **Dado** que estou offline, **quando** faço a mesma busca, **então** o app faz busca textual local e avisa que a busca inteligente está indisponível.

### US-07 — Consentimento de IA
**Como** usuário preocupado com privacidade, **quero** entender o que é enviado **para** decidir se ativo a IA.
- **Dado** que nunca usei a IA, **quando** clico em qualquer função de IA, **então** vejo uma explicação (o que é enviado e o que não é) e só prossigo após aceitar.
- **Dado** que ativei a IA, **quando** desativo e escolho "apagar dados de IA", **então** todas as descrições e tags de IA são removidas.

### US-08 — Entrar com Google
**Como** usuário, **quero** entrar com minha conta Google **para** usar os recursos de IA sem criar senha.
- **Dado** que não estou logado, **quando** clico em uma função de IA, **então** vejo o botão "Entrar com Google" e, após autorizar, a ação continua.
- **Dado** que não estou logado, **quando** uso biblioteca, álbuns, tags e edição, **então** tudo funciona normalmente sem login.

---

## 10. Escopo por fase

### MVP (v1.0)
- Importação de pastas (RF-01 a RF-05), biblioteca, linha do tempo, visualizador, avaliação/favoritos/rótulos, filtros e seleção em lote.
- Álbuns manuais; tags livres e gerenciador de tags.
- Edição básica não-destrutiva (corte, luz, cor, histórico, antes/depois, exportação).
- IA: auto-tagging, descrições, busca em linguagem natural, fila e cache, consentimento.
- Login com Google para os recursos de IA.
- Tema claro/escuro, pt-BR, backup do catálogo, PWA offline.

### v1.1
- Álbuns inteligentes e pastas de álbuns; tags hierárquicas.
- Modo triagem; curvas, nitidez, vinheta; predefinições e copiar/colar ajustes.
- Detecção de duplicatas e quase duplicatas.
- IA: "Aprimorar com IA", texto alternativo e legendas para redes sociais.

### v2.0
- Sincronização opcional do catálogo (não das fotos) entre dispositivos.
- Mapa, suporte a RAW, gravação em XMP.
- Sugestão de álbuns/eventos e melhores fotos pela IA; perguntas sobre a biblioteca.
- Reconhecimento de pessoas (com processamento local e consentimento reforçado).
- Compartilhamento de álbuns por link; versão mobile.

---

## 11. Métricas de sucesso

| Métrica | Meta (3 meses após lançamento) |
|---|---|
| Ativação: usuários que importam ≥ 1 pasta no primeiro uso | ≥ 70% |
| Tempo até a primeira foto na grade | < 60 s |
| % de fotos com ao menos uma tag (manual ou IA) | ≥ 60% |
| Adoção da IA (usuários que dão consentimento) | ≥ 50% |
| Taxa de sucesso da busca IA (clique no top 10) | ≥ 80% |
| Retenção D7 / D30 | ≥ 40% / ≥ 25% |
| Fotos editadas e exportadas por usuário ativo/mês | ≥ 10 |
| NPS | ≥ 40 |

---

## 12. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| File System Access API indisponível no Firefox/Safari | Alto | Fallback com importação para OPFS; comunicar navegadores recomendados |
| Navegador revoga permissão de pasta entre sessões | Médio | Persistir handles no IndexedDB, pedir reautorização com um clique; miniaturas continuam disponíveis |
| Análise de IA demorada em bibliotecas grandes | Médio | Miniaturas pequenas, cache, processamento em lote e em segundo plano |
| Privacidade / LGPD | Alto | Opt-in explícito, sem GPS/EXIF enviados, proxy sem retenção, opção de apagar dados de IA, política clara |
| Desempenho com 50k+ fotos | Médio | Virtualização, Web Workers, SQLite indexado, testes de carga desde o início |
| Limite de armazenamento do navegador (miniaturas/OPFS) | Médio | Miniaturas compactas (WebP), solicitar armazenamento persistente, monitorar quota |
| HEIC/RAW sem suporte nativo | Médio | Decodificadores WASM em fase posterior; usar prévia embutida |
| Qualidade/alucinação das tags da IA | Médio | Tags marcadas como "sugeridas", com aceitar/rejeitar; prompts com JSON estruturado e testes de avaliação |

---

## 13. Questões em aberto

| # | Questão |
|---|---|
| Q1 | Nome final do produto e identidade visual |
| Q2 | Suporte a RAW entra antes da v2? |
| Q3 | Reconhecimento facial: viável localmente no navegador e aceitável sob a LGPD? |
| Q4 | Análise de IA automática para fotos novas ou sempre sob demanda? |
| Q5 | Suporte a vídeos (listagem, miniatura, reprodução) no MVP? |

---

## 14. Glossário

| Termo | Definição |
|---|---|
| **Local-first** | Arquitetura em que os dados vivem primariamente no dispositivo do usuário e funcionam offline |
| **Catálogo** | Banco de dados do app com metadados, álbuns, tags e edições — separado dos arquivos de foto |
| **Edição não-destrutiva** | Edições salvas como instruções; o arquivo original nunca é modificado |
| **EXIF / IPTC / XMP** | Padrões de metadados embutidos em arquivos de imagem |
| **OPFS** | Origin Private File System — sistema de arquivos privado do navegador |
| **File System Access API** | API do navegador que permite ler/gravar pastas do disco com permissão do usuário |
| **pHash** | Hash perceptual — identifica imagens visualmente semelhantes |
| **Álbum inteligente** | Álbum cujo conteúdo é definido por regras e atualizado automaticamente |
| **Triagem (culling)** | Processo de revisar rapidamente uma sessão para escolher as melhores fotos |
| **PWA** | Progressive Web App — app web instalável e com funcionamento offline |
| **FTS5** | Extensão de busca textual completa do SQLite |
| **OAuth / Login com Google** | Padrão de autenticação em que o usuário entra com a conta Google, sem criar senha no app |
| **MoSCoW** | Método de priorização: Must, Should, Could, Won't |
