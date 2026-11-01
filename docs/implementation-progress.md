# MeganTrimmer — plano aprovado em 2026-11-01

Implementação: exportação confiável → troca segura → polimento → validação e portátil.

- Regressões reproduzidas: MKV, MP3, WAV/AAC, ausência de fallback e sobrescrita.
- Decisão: branch `codex/reliable-export-polish` no checkout limpo existente.
- Decisão: incluir FFprobe para metadados sem instalação global.
- Interfaces: erro serializável, progresso com unsubscribe, validação de vídeo e caminho do arquivo arrastado.
- Teste físico NVIDIA/Intel permanece externo; simular seleção/fallback e testar pacote localmente.

## Entrega

- Exportação: probes reais, parâmetros por encoder, fallback por software, MKV e áudio corrigidos, temporários e publicação sem sobrescrita.
- Compatibilidade adicional: legendas mov_text preservadas como SRT em MKV; fallback de publicação para volumes sem hard links.
- Troca: validação nativa + preview antes da substituição, diálogo exportar/descartar/cancelar, comparação com o último estado exportado e proteção contra resultados atrasados.
- Interface: tema escuro/verde, SVGs, estado inicial, destino visível, progresso real, erros copiáveis e movimento reduzido.
- Validação: 40 testes Node e 10 cenários no Electron/Chromium. Screenshots em `.cache/ui-smoke/` para 900×700 e 1600×900.
- Revisão independente concluída; corrigido o caso de legendas em MKV identificado pelo revisor. Teste de fallback agora força probe simulado e verifica a fase fallback, inclusive em CI sem GPU.
- Versão 1.2.1; FFmpeg e FFprobe integrados ao pacote. Validação física em NVIDIA/Intel e em volume exFAT real continua pendente.
- Portátil final: `release/MeganTrimmer-1.2.1-Portable.exe`. Build concluído com código empacotado igual ao build final.
- Smoke do pacote: seis formatos exportados e decodificados com `PATH` vazio, usando o executável e os binários de `release/win-unpacked`. Script: `scripts/check-package.cjs`, executado pelo Electron empacotado com `ELECTRON_RUN_AS_NODE=1`.

## Ícone do aplicativo — 1.2.2

- Mesma tesoura verde da interface exportada em SVG, PNG 512 px e ICO com 16/24/32/48/64/128/256 px.
- `npm run icons` regenera os assets com o Chromium já instalado, sem dependências novas.
- ICO compartilhado pela janela, executável, portátil, instalador e desinstalador; atalhos e associações usam o ícone do executável.
- Validado o ICO no pacote e extraído visualmente o novo ícone do executável Windows.
