# MeganTrimmer

Editor de vídeo leve para cortes rápidos, focado em fluxo direto: abrir, marcar início/fim, exportar.

## Features

- 🎬 Corte preciso por timeline com scrub de playhead e thumbnails de preview
- 📦 Formatos de saída: ORIGINAL (stream copy), MP4, MKV, AVI (vídeo) e MP3, WAV (áudio)
- 🖥️ Aceleração por hardware (AMD AMF → NVIDIA NVENC → Intel QSV → software libx264)
- 🎞️ Controle de resolução e frame rate com filtragem baseada no vídeo de origem
- 💾 Pasta de clipes configurável (persistida entre sessões)
- 🧩 Salvamento incremental: colisões de nome viram `clip (1).mp4`, `clip (2).mp4`, ...
- 🌙 Interface dark minimalista
- 🪟 Instalador Windows com "Abrir com MeganTrimmer" no menu de contexto (`.mp4`, `.mkv`, `.mov`)

## Requisitos

- Node.js 22.12+
- Windows / macOS / Linux (Electron 41+)

## Stack Técnica

- **Core:** Electron 41.2.0
- **Linguagem:** TypeScript 6.0.2 (ambiente ESM)
- **Processamento:** FFmpeg via fluent-ffmpeg, com binário integrado (`ffmpeg-static`)
- **Empacotamento:** Electron Builder

## Instalação

```bash
npm install
```

## Desenvolvimento

```bash
npm run dev
```

Compila e abre o app (`npm run build` + `electron .`).

## Build

```bash
npm run build
```

O código compilado vai para `dist/`.

## Testes

```bash
npm test
```

Roda `node --test` sobre os testes de `output-path` e `settings` (21 casos).

## Distribuição

Para gerar os instaláveis na pasta `release/`:

```bash
npm run dist           # Portable + MSI (ambos)
npm run dist:portable  # só o Portable.exe
npm run dist:msi       # só o Setup.msi
```

Artefatos gerados:
- `MeganTrimmer-<versão>-Portable.exe` — roda sem instalação
- `MeganTrimmer-<versão>-Setup.msi` — instala no sistema, cria atalhos e registra "Abrir com MeganTrimmer" no menu de contexto do Windows para `.mp4`, `.mkv`, `.mov`

*Observação (Windows):* sem certificado de code signing, o SmartScreen alerta na primeira execução do instalador. Clique em **Mais informações** → **Executar assim mesmo** para prosseguir.

## Como usar

1. Clique em **ABRIR ARQUIVO** — ou, no Windows instalado, botão direito em um arquivo `.mp4`/`.mkv`/`.mov` → **"Abrir com MeganTrimmer"**.
2. Ajuste os handles de início/fim na timeline (tesouras verdes).
3. Escolha formato, resolução e frame rate na sidebar direita.
4. (Opcional) Clique em ⚙ para escolher a **pasta de clipes**. Sem configuração, o padrão é `Videos/MeganTrimmer/`.
5. Clique em **EXPORTAR CORTE**. O arquivo final é salvo na pasta configurada.

Se já existir um arquivo com o mesmo nome, o MeganTrimmer **não sobrescreve** — gera `nome (1).ext`, `nome (2).ext`, etc.

## Especificações de Processamento

- **Stream copy (sem reencode):** containers MP4, MKV e MOV com formato ORIGINAL.
- **Reencode de vídeo:** libx264 via software com preset `veryfast`, ou hardware (h264_amf → h264_nvenc → h264_qsv) com `-quality speed`, detectado automaticamente.
- **Áudio no reencode:** AAC. Extração de áudio: `libmp3lame` (MP3) ou `pcm_s16le` (WAV).
- **Filtros:** escala com manutenção de proporção + padding para dimensões pares + `fps` quando resolução/frame rate difere do original.
- **Mapeamento:** `-map 0` (trilhas integrais) e `-avoid_negative_ts make_zero`.

## Configurações

O arquivo `settings.json` fica em `app.getPath('userData')`:

- **Windows:** `%APPDATA%/MeganTrimmer/settings.json`
- **macOS:** `~/Library/Application Support/MeganTrimmer/settings.json`
- **Linux:** `~/.config/MeganTrimmer/settings.json`

## Estrutura do projeto

```
src/
├── shared/          # tipos e constantes compartilhados (main ↔ renderer)
├── main/            # processo principal (Electron)
│   ├── ipc/         # handlers IPC
│   └── services/    # ffmpeg, settings, output-path, video-info
├── preload.ts       # bridge segura (contextBridge)
└── renderer/        # UI (DOM puro)
    └── modules/     # módulos por responsabilidade
```

## Autor

Murilo D. — [Portfólio](https://murilod.dev/) · [LinkedIn](https://www.linkedin.com/in/murilo-dias-dev/) · [GitHub](https://github.com/self1027)

## Licença

ISC
