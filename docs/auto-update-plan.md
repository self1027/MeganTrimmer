# Auto-update e releases — plano aprovado em 2026-11-01

## Requisitos

- Windows x64: NSIS EXE + portátil; sem novos MSI nem assinatura digital.
- GitHub Releases público: self1027/megan-trimmer, canal estável.
- Verificar ao abrir, a cada seis horas e por ação manual.
- Escolha explícita obrigatória quando há nova versão: modal com dois botões (atualizar ou continuar sem atualizar) e link para Releases; nenhuma instalação automática ao fechar.
- Preservar identidade, configurações, diretório e escopo das instalações existentes.
- Novas instalações por usuário; antigos MSI encapsulam NSIS e seguem seu upgrade nativo.
- Não interromper exportações nem perder alterações sem confirmação.
- Publicar por tag vX.Y.Z correspondente ao pacote e lockfile, após testes e validação dos artefatos.
- Até 500 linhas adicionadas + removidas por commit; arquivo individual acima disso pode ocupar um commit exclusivo.

## Tarefas

1. Registrar alterações preexistentes em commits limitados (concluído antes da implementação).
2. Criar controlador testável de atualização, preferência persistida e contratos IPC.
3. Integrar ciclo de vida, proteção de fechamento e interface às configurações existentes.
4. Configurar identidade NSIS, proteção contra downgrade e processos em uso; gerar apenas EXE/portátil.
5. Criar CI e publicação com manifesto, checksums, rascunho e promoção após conferência.
6. Rodar testes Node, Electron, build e smoke do pacote; revisar a implementação.

## Critérios de aceite

- Nenhum download antes da escolha de atualizar, nem instalação ao fechar normalmente.
- Continuar sem atualizar libera o editor e impede reinício, inclusive se a pessoa mudar de ideia durante o download.
- Exportação bloqueia reinício; cancelar descarte mantém o editor aberto.
- Falhas de rede/integridade deixam o app utilizável, sem instalação.
- Portátil e desenvolvimento não executam NSIS via atualizador.
- Workflow falho não publica release; rerun não altera release já publicada.
- Instalação limpa, mesma versão, upgrade, downgrade e MSI antigo devem ser conferidos em Windows descartável antes da primeira publicação.
- Testar atualização real entre builds com feed local isolado, sem publicar versões de teste.

## Registro de execução

- Base anterior: dcfcb75; snapshot das alterações existentes: b381762, em seis commits.
- Baseline: npm test, 40/40 testes passaram.
- Decisão: manter o checkout/branch de trabalho atual, já usado pelo projeto, conforme o pedido de continuar e commitar as alterações existentes.
- Decisão: controlador do app agenda a instalação; autoInstallOnAppQuit permanece false para evitar handlers obsoletos ao alternar a preferência.
- Validação de VM: não executar instaladores sobre a instalação pessoal deste computador.
- Controlador e preferência: npm test passou com 52 testes, incluindo download manual, troca de modo após download, falhas e concorrência.
- Ciclo de vida: 56 testes Node e smoke Electron de edição/atualização passaram; o ambiente da sessão define ELECTRON_RUN_AS_NODE=1, removido somente do processo de teste para iniciar a interface real.
- Build 1.3.0: Setup, portátil, blockmap e latest.yml gerados; assinatura conferida como NotSigned, conforme a escolha de distribuir sem certificado.
- Publicação: validadores e CI implementados; 63 testes Node passaram após a correção da revisão; actionlint 1.7.12 não apontou erros nos workflows.
- Feed HTTP local: electron-updater real baixou/verificou o instalador e rejeitou SHA-512 incorreto, sem instalar nem usar o cache de produção.
- Pacote: seis formatos exportados e decodificados com PATH vazio, usando FFmpeg/FFprobe incluídos no asar.
- Ruling: os testes de substituição física, MSI e UAC ficam para Windows descartável; Windows Sandbox não está disponível neste host e instalar aqui alteraria o ambiente pessoal.
- Revisão independente: falha do instalador emitida por evento podia deixar instalação/fechamento liberados; reproduzida em dois testes e corrigida, com regressão adicional no Electron para manter a proteção de alterações pendentes.
- Revisão do usuário: substituir checkbox/opção silenciosa por diálogo modal obrigatório, com Atualizar agora, Continuar sem atualizar e hyperlink para GitHub Releases. A decisão explícita substitui o comportamento silencioso anterior; preferências antigas são ignoradas.
- Fluxo revisado: 59 testes Node passaram; o smoke Electron confirmou bloqueio modal, dois botões, recusa sem download, recusa durante download, reabertura manual, descarte cancelado e ausência de instalação ao fechar. Os quatro testes exclusivos do modo silencioso removido foram retirados.
