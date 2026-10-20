# PRD — PhotoApp: Organizador de Fotos Inteligente

| Campo | Valor |
|---|---|
| **Produto** | PhotoApp (nome provisório) |
| **Autor** | Fernando |
| **Status** | Rascunho v0.1 |
| **Última atualização** | 2026-10-19 |

---

## 1. Resumo

O PhotoApp é um gerenciador de fotos bonito, poderoso e fácil de usar. Com ele, o usuário consegue **importar, catalogar, organizar, editar e encontrar** as suas fotos. A organização usa **álbuns** e **tags livres**, e a **inteligência artificial** ajuda a aprimorar imagens e a pesquisar por linguagem natural (ex.: *"praia ao pôr do sol com o cachorro"*).

O produto quer ficar entre dois extremos. De um lado estão os apps simples (Google Fotos, Apple Fotos), fáceis de usar mas pouco controláveis. Do outro estão as ferramentas profissionais (Lightroom, Capture One), poderosas mas complexas. O PhotoApp quer ser **simples por padrão e profundo quando necessário**.

---

## 2. Problema e oportunidade

### 2.1 Problema
- As pessoas acumulam **milhares de fotos** espalhadas entre celular, HD externo, nuvem e redes sociais, e não conseguem achar o que procuram.
- Organizar fotos à mão (pastas, renomear arquivos) é **chato e não escala**.
- Os apps de consumo organizam de forma automática, mas **opaca**. O usuário controla pouco as tags e os álbuns e não consegue levar os dados para outro app (*lock-in*).
- As ferramentas profissionais exigem **curva de aprendizado alta** e editar nelas toma tempo.
- Muita gente não aceita mandar as fotos para a nuvem de terceiros e quer **privacidade**.

### 2.2 Oportunidade
- Os modelos de IA multimodal (embeddings de imagem e texto, segmentação, *upscaling*, *inpainting*) já são maduros e muitos rodam **localmente**.
- Isso permite oferecer uma busca semântica e uma automação de organização que antes só existiam em plataformas gigantes, **sem abrir mão da privacidade**.

---

## 3. Objetivos e não-objetivos

### 3.1 Objetivos
1. **Encontrar qualquer foto em menos de 10 segundos**, por texto livre, pessoa, lugar, data ou tag.
2. **Organizar sem esforço**: a IA sugere tags, álbuns e agrupamentos, e o usuário aceita ou ajusta.
3. **Editar com qualidade** de forma não destrutiva: o original nunca é alterado.
4. **Navegação fluida** em bibliotecas de mais de 100 mil fotos.
5. **O usuário é dono dos dados**: os metadados podem ser exportados em padrões abertos (XMP/IPTC) e a biblioteca funciona offline.

### 3.2 Não-objetivos (por enquanto)
- Não é uma rede social nem tem feed público.
- Não substitui editores de pixel avançados (camadas, máscaras complexas, composições do tipo Photoshop).
- Não terá edição de vídeo no MVP (vídeos podem ser catalogados, mas não editados).
- Não terá ferramentas de fluxo de trabalho para estúdios ou agências (aprovação de cliente, faturamento).

---

## 4. Personas

| Persona | Perfil | Dor principal | O que precisa |
|---|---|---|---|
| **Ana, a memorialista** | 35 anos, mãe, tem 40 mil fotos no celular | "Nunca acho a foto que quero mostrar" | Busca simples, álbuns automáticos de eventos e pessoas |
| **Bruno, o entusiasta** | 28 anos, fotógrafo amador, usa câmera com RAW | "O Lightroom é caro e pesado" | Suporte a RAW, edição não destrutiva, presets, avaliação por estrelas |
| **Carla, a criadora** | 31 anos, produz conteúdo para redes | "Perco tempo escolhendo e tratando fotos" | Curadoria por IA (melhores fotos), aprimoramento rápido, exportação para redes |
| **Diego, o arquivista** | 60 anos, está digitalizando fotos antigas da família | "Fotos escaneadas não têm data nem contexto" | Restauração por IA, edição de metadados em lote, reconhecimento facial |

---

## 5. Princípios de produto

1. **Simples por padrão, poderoso sob demanda**: os recursos avançados ficam acessíveis, mas não poluem a interface.
2. **O original é sagrado**: toda edição é não destrutiva e reversível.
3. **A IA sugere, o usuário decide**: nenhuma organização automática é aplicada sem que dê para revisar ou desfazer.
4. **Privacidade em primeiro lugar**: o processamento local é o padrão, e a nuvem é opcional e explícita.
5. **Velocidade é um recurso**: nenhuma interação comum deve passar de 100 ms de resposta percebida.
6. **Dados abertos**: nada de formato proprietário que prenda o usuário.

---

## 6. Requisitos funcionais

**Prioridade (MoSCoW):** **M** = Must (MVP) · **S** = Should (v1) · **C** = Could (v2+) · **W** = Won't (fora do escopo atual)

### 6.1 Importação e catalogação

| ID | Requisito | Prioridade |
|---|---|---|
| IMP-01 | Importar fotos de pastas locais, cartão de memória e dispositivos conectados | M |
| IMP-02 | Formatos suportados: JPEG, PNG, HEIC/HEIF, WebP, TIFF, GIF | M |
| IMP-03 | Suporte a RAW (CR2/CR3, NEF, ARW, DNG, RAF, ORF) | S |
| IMP-04 | Catalogar vídeos (MP4, MOV) com miniatura e metadados, sem edição | S |
| IMP-05 | Dois modos de armazenamento: **referenciado** (os arquivos ficam onde estão) ou **gerenciado** (são copiados para a biblioteca) | M |
| IMP-06 | Ler metadados EXIF, IPTC e XMP (data, câmera, lente, GPS, exposição) | M |
| IMP-07 | Monitorar pastas (*watch folders*) e importar novas fotos automaticamente | S |
| IMP-08 | Detectar duplicatas exatas (hash) na importação, com opção de pular | M |
| IMP-09 | Detectar fotos quase duplicadas ou em sequência (*burst*) por similaridade visual | S |
| IMP-10 | Importação em segundo plano, com progresso, sem travar a interface | M |
| IMP-11 | Importar de serviços de nuvem (Google Fotos, iCloud, OneDrive) | C |
| IMP-12 | Renomear arquivos na importação usando modelos (ex.: `{data}_{evento}_{seq}`) | C |

### 6.2 Biblioteca e navegação

| ID | Requisito | Prioridade |
|---|---|---|
| BIB-01 | Grade de miniaturas com zoom contínuo (de densa a ampla) e rolagem virtualizada | M |
| BIB-02 | Visualização em linha do tempo agrupada por ano, mês e dia, com navegação rápida por barra lateral | M |
| BIB-03 | Visualizador em tela cheia com zoom, pan e navegação por teclado ou gestos | M |
| BIB-04 | Painel de informações com metadados, tags, álbuns e mapa | M |
| BIB-05 | Visualização em mapa das fotos com GPS, com agrupamento por região | S |
| BIB-06 | Modo comparação: 2 a 4 fotos lado a lado com zoom sincronizado | S |
| BIB-07 | Seleção múltipla (clique, Shift, Ctrl/Cmd, arrastar) e ações em lote | M |
| BIB-08 | Lixeira com retenção configurável (padrão: 30 dias) | M |
| BIB-09 | Ordenação por data de captura, data de importação, nome, avaliação e tamanho | M |
| BIB-10 | Pilhas: agrupar variações (RAW+JPEG, sequências, edições) sob uma foto "capa" | S |
| BIB-11 | Atalhos de teclado para todas as ações frequentes | M |

### 6.3 Álbuns

| ID | Requisito | Prioridade |
|---|---|---|
| ALB-01 | Criar, renomear e excluir álbuns manuais | M |
| ALB-02 | Uma foto pode pertencer a vários álbuns sem duplicar o arquivo | M |
| ALB-03 | Escolher a capa do álbum e reordenar as fotos manualmente | M |
| ALB-04 | Pastas de álbuns (hierarquia, ex.: `Viagens > 2025 > Japão`) | S |
| ALB-05 | **Álbuns inteligentes**: regras dinâmicas (ex.: *tag = "família" E avaliação ≥ 4 E ano = 2025*) | S |
| ALB-06 | **Álbuns sugeridos por IA**: eventos detectados por tempo e lugar ("Viagem a Salvador, mar 2025") | S |
| ALB-07 | Arrastar e soltar fotos em álbuns na barra lateral | M |
| ALB-08 | Álbuns compartilhados com outros usuários (somente leitura ou colaborativos) | C |

### 6.4 Tags, classificação e metadados

| ID | Requisito | Prioridade |
|---|---|---|
| TAG-01 | Tags livres, com autocompletar e criação em linha | M |
| TAG-02 | Tags hierárquicas (ex.: `Animais > Cachorro > Thor`) | S |
| TAG-03 | Avaliação por estrelas (0 a 5), favorito (coração) e marcação de seleção ou rejeição (*pick/reject*) | M |
| TAG-04 | Rótulos de cor (vermelho, amarelo, verde, azul, roxo) | S |
| TAG-05 | Editar em lote título, descrição, data, local e direitos autorais | M |
| TAG-06 | Corrigir data e hora em lote (ex.: ajustar o fuso de uma viagem) | S |
| TAG-07 | Geomarcação manual: arrastar fotos para o mapa ou buscar um endereço | S |
| TAG-08 | Gravar metadados em XMP *sidecar* ou embutidos no arquivo, conforme preferência | S |
| TAG-09 | Gerenciador de tags: renomear, mesclar, mover na hierarquia e ver a contagem de uso | S |
| TAG-10 | Tags sugeridas pela IA aparecem separadas das tags confirmadas, para aceitar ou rejeitar | M |

### 6.5 Edição (não destrutiva)

| ID | Requisito | Prioridade |
|---|---|---|
| EDT-01 | Toda edição é gravada como uma pilha de instruções, e o original nunca é modificado | M |
| EDT-02 | Recortar, endireitar, girar, espelhar e escolher proporção (livre, 1:1, 4:3, 16:9, 4:5, 9:16) | M |
| EDT-03 | Ajustes básicos: exposição, contraste, realces, sombras, brancos, pretos | M |
| EDT-04 | Cor: temperatura, matiz, vibração, saturação | M |
| EDT-05 | Detalhe: nitidez, redução de ruído, clareza, textura | S |
| EDT-06 | Curvas (RGB e por canal) e HSL por cor | S |
| EDT-07 | Vinheta, granulação e correção de lente (perfis) | S |
| EDT-08 | Filtros e presets prontos, com a possibilidade de criar, salvar e compartilhar presets próprios | M |
| EDT-09 | Copiar e colar ajustes entre fotos e aplicar em lote | M |
| EDT-10 | Histórico com desfazer/refazer ilimitado e "snapshots" nomeados | M |
| EDT-11 | Comparar antes e depois (tecla segurada ou divisor deslizante) | M |
| EDT-12 | Ajustes locais com máscaras: pincel, gradiente linear e radial | C |
| EDT-13 | Pré-visualização em tempo real (ver requisitos de desempenho) | M |
| EDT-14 | Criar "versões virtuais": várias edições do mesmo original | S |

### 6.6 Inteligência artificial

#### 6.6.1 Busca e organização

| ID | Requisito | Prioridade |
|---|---|---|
| IA-01 | **Busca semântica em linguagem natural**, em português e inglês (ex.: *"bolo de aniversário com velas"*) | M |
| IA-02 | **Auto-tagging**: detectar objetos, cenas, atividades e animais e sugerir tags | M |
| IA-03 | **Reconhecimento facial**: agrupar rostos e permitir nomear pessoas. Recurso **opt-in**, ver §7.3 | S |
| IA-04 | Busca por similaridade: "encontrar fotos parecidas com esta" | S |
| IA-05 | OCR: extrair texto visível nas fotos (placas, documentos, cardápios) e torná-lo pesquisável | S |
| IA-06 | **Curadoria automática**: pontuar a qualidade estética e técnica (foco, olhos fechados, tremida) e sugerir as melhores de cada sequência | S |
| IA-07 | Legendas automáticas (descrição da cena) para acessibilidade e busca | S |
| IA-08 | Detecção de eventos e viagens para sugerir álbuns (ver ALB-06) | S |
| IA-09 | Detecção de capturas de tela, documentos e memes, com sugestão de limpeza | C |
| IA-10 | "Memórias": retrospectivas automáticas ("há 5 anos") | C |

#### 6.6.2 Aprimoramento

| ID | Requisito | Prioridade |
|---|---|---|
| IA-20 | **Auto-aprimorar em um clique**: ajuste automático de exposição, cor e contraste | M |
| IA-21 | **Upscaling** (super-resolução 2x/4x) | S |
| IA-22 | **Redução de ruído por IA** (especialmente em ISO alto e RAW) | S |
| IA-23 | **Remoção de objetos e pessoas** (*inpainting*) com pincel ou seleção automática | S |
| IA-24 | **Remoção e troca de fundo** com recorte automático de sujeito | S |
| IA-25 | **Restauração de fotos antigas**: arranhões, desbotamento, colorização | C |
| IA-26 | Correção de desfoque leve e de tremido | C |
| IA-27 | Máscaras inteligentes: selecionar céu, sujeito ou fundo automaticamente para ajustes locais | C |
| IA-28 | Edição por comando de texto (ex.: *"deixe o céu mais dramático"*) | C |

#### 6.6.3 Regras gerais de IA

- **IA-R1**: Toda saída da IA é **reversível**. Aprimoramentos geram uma nova versão ou entram na pilha de edição e nunca sobrescrevem o original.
- **IA-R2**: Sugestões (tags, álbuns, nomes de pessoas) ficam visualmente diferentes de dados confirmados pelo usuário.
- **IA-R3**: Antes de qualquer processamento **em nuvem**, o app avisa o usuário de forma explícita e pede consentimento, por recurso.
- **IA-R4**: A indexação de IA roda em segundo plano, pode ser pausada e respeita bateria e uso de CPU/GPU, com um modo "só quando ocioso ou conectado à energia".
- **IA-R5**: O usuário pode desativar qualquer recurso de IA por completo.

### 6.7 Busca

| ID | Requisito | Prioridade |
|---|---|---|
| BUS-01 | Uma barra de busca única que combina texto livre (semântico), tags, pessoas, lugares, datas, câmera e álbuns | M |
| BUS-02 | Filtros por facetas: data (intervalo), avaliação, rótulo de cor, tipo de arquivo, câmera/lente, orientação, com GPS ou sem GPS, editada ou não | M |
| BUS-03 | Operadores e *chips* combináveis (ex.: `pessoa:Ana` `lugar:Rio` `2024` `★≥4`) | S |
| BUS-04 | Salvar uma busca como álbum inteligente | S |
| BUS-05 | Sugestões e autocompletar enquanto o usuário digita | M |
| BUS-06 | Resultados em menos de 500 ms em uma biblioteca de 100 mil fotos (ver §7.1) | M |

### 6.8 Exportação e compartilhamento

| ID | Requisito | Prioridade |
|---|---|---|
| EXP-01 | Exportar com as edições aplicadas, escolhendo formato (JPEG, PNG, TIFF, WebP, AVIF), qualidade e tamanho | M |
| EXP-02 | Presets de exportação (ex.: "Instagram 4:5 1080px", "Impressão 300dpi") | S |
| EXP-03 | Controle de metadados na exportação: remover GPS, manter apenas os direitos autorais etc. | M |
| EXP-04 | Marca d'água (texto ou imagem) opcional | C |
| EXP-05 | Compartilhar pelo menu nativo do sistema operacional | M |
| EXP-06 | Link de compartilhamento público ou privado para um álbum (requer nuvem) | C |
| EXP-07 | Exportar o catálogo inteiro (metadados em XMP e JSON) para portabilidade | S |

### 6.9 Sincronização e backup

| ID | Requisito | Prioridade |
|---|---|---|
| SYN-01 | Backup automático do catálogo (banco de dados) com versões | M |
| SYN-02 | Sincronizar a biblioteca entre dispositivos (desktop ↔ mobile) | C |
| SYN-03 | Backup das fotos originais em nuvem própria ou em um provedor externo (S3, Backblaze, OneDrive) | C |
| SYN-04 | Verificar integridade: detectar arquivos ausentes ou movidos e permitir reconectar | S |

---

## 7. Requisitos não funcionais

### 7.1 Desempenho

| Métrica | Meta |
|---|---|
| Abertura do app até a grade utilizável | < 2 s (biblioteca de 100 mil fotos) |
| Rolagem da grade | 60 fps constante, sem "buracos" de miniatura visíveis por mais de 200 ms |
| Abertura de uma foto em tela cheia | < 150 ms (JPEG) · < 500 ms (RAW, com pré-visualização embutida antes) |
| Atualização do slider de edição | < 50 ms para a pré-visualização |
| Busca (texto, filtros, semântica) | < 500 ms (p95) |
| Importação (sem IA) | ≥ 50 fotos/s em SSD |
| Indexação de IA (local, GPU média) | ≥ 10 fotos/s, em segundo plano |
| Escala suportada | 500 mil fotos por biblioteca, sem perder usabilidade |

### 7.2 Confiabilidade e integridade
- **Nenhuma** operação do app altera os bytes do arquivo original sem uma ação explícita do usuário (ex.: "gravar metadados no arquivo").
- O catálogo usa transações atômicas e se recupera de quedas de energia sem corromper.
- A exclusão de arquivos do disco só acontece após a lixeira e com confirmação.

### 7.3 Privacidade e segurança (LGPD/GDPR)
- **Local-first**: busca, tags e reconhecimento facial funcionam 100% offline por padrão.
- **Dados biométricos** (rostos) são dados pessoais sensíveis pela LGPD (art. 5º, II). Por isso:
  - o reconhecimento facial vem **desligado por padrão** e só é ativado com consentimento explícito;
  - os *embeddings* faciais ficam armazenados apenas no dispositivo e podem ser apagados com um clique;
  - nada é enviado à nuvem sem um opt-in específico para esse recurso.
- O app avisa sobre a remoção de GPS e EXIF antes de compartilhar.
- Se houver nuvem: criptografia em trânsito (TLS 1.3) e em repouso; criptografia ponta a ponta como meta de v2.
- Telemetria de uso é opt-in, anonimizada e **nunca inclui conteúdo de imagens**.

### 7.4 Usabilidade e acessibilidade
- Conformidade com **WCAG 2.2 AA**: contraste, navegação completa por teclado e leitores de tela (usando legendas de IA como *alt text*).
- Tema claro e escuro (o escuro é o padrão para edição, por neutralidade de cor).
- Onboarding em no máximo 3 passos até a primeira importação.
- Todo recurso avançado pode ser descoberto, mas é opcional, com uma interface que revela as opções aos poucos (*progressive disclosure*).

### 7.5 Internacionalização
- No lançamento: **português (BR)** e **inglês**. Arquitetura preparada para outros idiomas.
- Datas, números e unidades seguem o *locale* do sistema.
- A busca semântica entende consultas em vários idiomas.

### 7.6 Compatibilidade
- **MVP: desktop** (Windows 10+ e macOS 13+). Linux é desejável.
- **v2: mobile** (iOS e Android), como complemento sincronizado.
- Gerenciamento de cor: respeitar perfis ICC embutidos e o perfil do monitor.

---

## 8. Experiência do usuário

### 8.1 Estrutura de navegação

```
┌───────────────┬──────────────────────────────────────────┬──────────────┐
│ BARRA LATERAL │  [ 🔍 Busca universal ............ ] [⚙] │   PAINEL     │
│               │                                          │   INFO       │
│ Biblioteca    │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐      │              │
│  • Todas      │  │    │ │    │ │    │ │    │ │    │      │  Metadados   │
│  • Favoritas  │  └────┘ └────┘ └────┘ └────┘ └────┘      │  Tags        │
│  • Recentes   │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐      │  Álbuns      │
│  • Lixeira    │  │    │ │    │ │    │ │    │ │    │      │  Pessoas     │
│ Pessoas       │  └────┘ └────┘ └────┘ └────┘ └────┘      │  Mapa        │
│ Lugares       │                                          │              │
│ Álbuns   [+]  │        GRADE / LINHA DO TEMPO            │              │
│  ▸ Viagens    │                                          │              │
│  ▸ Família    │                                          │              │
│ Álb. intelig. │                                          │              │
│ Tags          │  [Zoom ──●──]  1.234 fotos · 12 selec.   │              │
└───────────────┴──────────────────────────────────────────┴──────────────┘
```

**Modos principais:** Biblioteca (grade e linha do tempo) → Visualizador (uma foto) → Editor (painel de ajustes à direita, filmstrip embaixo).

### 8.2 Fluxos-chave

1. **Primeira execução**: boas-vindas → escolher pastas ou importar → escolher os recursos de IA desejados (com explicação de privacidade) → a grade aparece **na hora**, enquanto a indexação continua em segundo plano.
2. **Encontrar uma foto**: o usuário digita na busca → recebe sugestões (pessoas, tags, lugares) → os resultados se atualizam enquanto ele digita → refina com facetas → abre a foto.
3. **Organizar um evento**: a IA sugere o álbum "Casamento da Júlia – 12/04" → o usuário revisa as fotos incluídas → aceita → a IA sugere as 20 melhores → o usuário marca como favoritas.
4. **Editar e exportar**: abre a foto → clica em "Auto-aprimorar" → faz o ajuste fino → copia os ajustes para mais 15 fotos → exporta com o preset "Instagram".
5. **Revisar as sugestões da IA**: um painel "Revisar" mostra as tags sugeridas e os rostos não nomeados, com ações rápidas (✓ / ✗ / atalho de teclado).

### 8.3 Diretrizes de design
- O conteúdo (as fotos) é o protagonista. A interface é neutra e minimalista e some em tela cheia.
- Microinterações suaves (transições de 150–250 ms), sem chegar a atrasar o uso.
- Feedback imediato: toda ação longa mostra progresso e pode ser cancelada.
- Estados vazios ensinam a usar o app ("Arraste fotos aqui ou clique em Importar").

---

## 9. Arquitetura (proposta de alto nível)

> Esta seção é uma recomendação inicial para orientar a discussão técnica. Ela não é uma decisão final.

| Camada | Proposta | Justificativa |
|---|---|---|
| **App desktop** | Tauri (Rust) + React/TypeScript, **ou** Electron + React | Multiplataforma. O Tauri gera binários menores e dá acesso nativo ao processamento de imagem |
| **Catálogo** | SQLite (modo WAL) + extensão vetorial (ex.: sqlite-vec) | Embutido, rápido, transacional e com busca vetorial local |
| **Processamento de imagem** | libvips (miniaturas, exportação) + LibRaw (RAW) + pipeline de edição em GPU (WebGPU/wgpu ou shaders) | Desempenho com imagens grandes e edição em tempo real |
| **IA local** | ONNX Runtime com modelos tipo CLIP/SigLIP (busca e tags), detector e embedder facial, OCR, Real-ESRGAN (upscale), LaMa (inpainting), segmentação (tipo SAM) | Funciona offline e preserva a privacidade |
| **IA em nuvem (opcional)** | API de modelo multimodal para legendas ricas, edição por comando de texto e recursos pesados | Para recursos que não cabem no dispositivo, sempre opt-in |
| **Cache** | Pirâmide de miniaturas (256, 1024 e 2048 px) em disco | Grade instantânea e visualização rápida |
| **Fila de tarefas** | *Worker pool* com prioridades (a interface vem antes da importação, que vem antes da IA) | A interface nunca trava |

### 9.1 Modelo de dados (simplificado)

```
Asset         (id, caminho, hash, tipo, largura, altura, data_captura, data_import,
               avaliacao, favorito, rotulo_cor, pick_status, gps_lat, gps_lng,
               camera, lente, iso, abertura, velocidade, excluido_em)
Edit          (id, asset_id, versao, pilha_ajustes_json, criado_em, snapshot_nome)
Album         (id, nome, pai_id, tipo[manual|inteligente|sugerido], regras_json, capa_asset_id)
AlbumAsset    (album_id, asset_id, ordem)
Tag           (id, nome, pai_id)
AssetTag      (asset_id, tag_id, origem[usuario|ia], confianca, confirmado)
Person        (id, nome, capa_face_id)
Face          (id, asset_id, bbox, embedding, person_id, confirmado)
Embedding     (asset_id, modelo, vetor)
OcrText       (asset_id, texto)
Stack         (id, capa_asset_id) / StackMember (stack_id, asset_id)
```

---

## 10. Métricas de sucesso

| Categoria | Métrica | Meta (6 meses após o lançamento) |
|---|---|---|
| **Ativação** | % de usuários que importam ≥ 100 fotos no 1º dia | ≥ 70% |
| **Organização** | % de usuários ativos com ≥ 1 álbum ou ≥ 10 tags | ≥ 50% |
| **Busca** | % de buscas seguidas de abrir uma foto (sucesso) | ≥ 60% |
| **Busca** | Tempo mediano entre a busca e abrir a foto | < 10 s |
| **IA** | Taxa de aceitação das tags sugeridas | ≥ 70% |
| **IA** | % de usuários que usam ≥ 1 recurso de aprimoramento por semana | ≥ 30% |
| **Edição** | % de usuários ativos que editam ≥ 1 foto por semana | ≥ 25% |
| **Retenção** | Retenção D30 | ≥ 40% |
| **Qualidade** | Sessões sem crash | ≥ 99,5% |
| **Satisfação** | NPS | ≥ 40 |

---

## 11. Roadmap por fases

### Fase 1 — MVP (fundação)
Objetivo: um catálogo rápido e confiável, com organização manual sólida e busca básica por IA.
- Importação (IMP-01, 02, 05, 06, 08, 10), biblioteca e visualizador (BIB-01 a 04, 07 a 09, 11)
- Álbuns manuais (ALB-01 a 03, 07), tags, estrelas e favoritos (TAG-01, 03, 05, 10)
- Edição não destrutiva básica (EDT-01 a 04, 08 a 11, 13)
- IA: busca semântica (IA-01), auto-tagging (IA-02), auto-aprimorar (IA-20)
- Busca unificada com facetas (BUS-01, 02, 05, 06)
- Exportação básica (EXP-01, 03, 05), backup do catálogo (SYN-01)

### Fase 2 — v1 (poder)
Objetivo: atender entusiastas e automatizar a organização.
- RAW, vídeos (catalogação), watch folders e quase duplicatas
- Álbuns inteligentes e sugeridos, tags hierárquicas, XMP, mapa, pilhas
- Edição avançada (curvas, HSL, detalhe, lente, versões virtuais)
- IA: reconhecimento facial, similaridade, OCR, curadoria, upscaling, redução de ruído, remoção de objetos e de fundo

### Fase 3 — v2 (expansão)
Objetivo: um ecossistema em vários dispositivos com recursos criativos.
- App mobile e sincronização, backup em nuvem, compartilhamento de álbuns
- Máscaras locais, restauração de fotos antigas, edição por comando de texto
- Memórias, importação de serviços de nuvem, marca d'água

---

## 12. Riscos e mitigações

| Risco | Impacto | Probabilidade | Mitigação |
|---|---|---|---|
| A IA local é lenta em máquinas modestas | Alto | Média | Modelos quantizados, indexação incremental e ociosa, fallback opcional para a nuvem |
| O tamanho do instalador cresce com os modelos de IA | Médio | Alta | Baixar os modelos sob demanda, só dos recursos ativados |
| Baixa precisão das tags e do reconhecimento facial em português | Médio | Média | Modelos multilíngues, um limiar de confiança ajustável e o fluxo de revisão "a IA sugere, o usuário decide" |
| Questões legais com biometria (LGPD) | Alto | Média | Opt-in explícito, processamento local, exclusão fácil, revisão jurídica antes da Fase 2 |
| Corrupção do catálogo ou perda de dados | Crítico | Baixa | SQLite transacional, backups automáticos, o original nunca é tocado |
| Suporte a RAW variado e complexo | Médio | Alta | Usar o LibRaw, priorizar as câmeras mais populares e usar a pré-visualização embutida como fallback |
| Desempenho com bibliotecas muito grandes | Alto | Média | Virtualização, cache de miniaturas, índices de banco e testes de carga com 500 mil fotos desde cedo |
| Concorrência (Google, Apple, Adobe) | Alto | Alta | Diferenciar por privacidade, dados abertos, ausência de lock-in e equilíbrio entre simplicidade e poder |

---

## 13. Questões em aberto

1. **Plataforma do MVP**: desktop primeiro (premissa deste documento), web ou mobile?
2. **Modelo de negócio**: gratuito com recursos de IA premium (freemium), compra única ou assinatura? Os recursos de IA em nuvem têm custo variável que precisa ser coberto.
3. **Nuvem própria**: vamos oferecer armazenamento próprio ou só integrar com provedores existentes?
4. **Stack**: Tauri ou Electron? A decisão depende da experiência da equipe e do peso do processamento nativo.
5. **Quais modelos de IA específicos**: avaliar os modelos (licenças comerciais, precisão em PT-BR, tamanho) antes da Fase 1.
6. **Público-alvo principal do MVP**: consumidor geral (Ana) ou entusiasta (Bruno)? Isso afeta a prioridade de RAW e da edição avançada.
7. **Colaboração**: álbuns compartilhados exigem contas de usuário e backend. Isso entra no roadmap ou fica de fora?

---

## 14. Glossário

| Termo | Definição |
|---|---|
| **Edição não destrutiva** | Os ajustes são gravados como instruções e aplicados na visualização e na exportação. O arquivo original não muda. |
| **Embedding** | Representação numérica (vetor) de uma imagem ou texto. Permite comparar significado e similaridade. |
| **Busca semântica** | Busca pelo significado do conteúdo, e não só por palavras-chave ou nomes de arquivo. |
| **Álbum inteligente** | Álbum cujo conteúdo é definido por regras e se atualiza sozinho. |
| **XMP sidecar** | Arquivo `.xmp` ao lado da foto, com metadados num padrão aberto que outros apps também leem. |
| **Inpainting** | Técnica de IA que preenche uma área removida da imagem de forma realista. |
| **Upscaling** | Aumentar a resolução da imagem com IA, recriando detalhes. |
| **Pilha (stack)** | Grupo de fotos relacionadas exibidas como uma só (ex.: RAW+JPEG, sequência). |
| **Local-first** | O app funciona e guarda os dados no dispositivo. A nuvem é opcional. |
