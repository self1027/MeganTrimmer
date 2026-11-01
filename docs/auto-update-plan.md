# Auto-update e releases — plano aprovado em 2026-11-01

## Requisitos

- Windows x64: NSIS EXE + portátil; sem novos MSI nem assinatura digital.
- GitHub Releases público: self1027/megan-trimmer, canal estável.
- Verificar ao abrir, a cada seis horas e por ação manual.
- Padrão: confirmar download e instalação. Opção silenciosa: baixar e instalar ao fechar normalmente.
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

- Nenhum download automático no modo padrão, nem instalação automática sem modo silencioso.
- Alternar a preferência depois do download afeta o fechamento imediatamente.
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
