# Releases e atualização do MeganTrimmer

## Distribuição

O Windows x64 recebe quatro arquivos por versão: `MeganTrimmer-X.Y.Z-Setup.exe`, seu `.blockmap`, `MeganTrimmer-X.Y.Z-Portable.exe` e `latest.yml`.

O instalador NSIS mantém a identidade `com.megan.megantrimmer` e o GUID `1655dfa4-8b90-5b88-9286-f758bf3fd6ef`. Não altere esses valores, o nome `megantrimmer`, o executável nem o diretório de dados ao lançar novas versões.

Instalações novas são por usuário. Nas existentes, o instalador mantém o escopo e o diretório registrados; as antigas instaladas para todos os usuários podem solicitar administrador. O MSI da release 1.2.0 encapsula o mesmo instalador NSIS, portanto a migração usa o reconhecimento nativo. Não há mais geração de MSI.

Versões anteriores à 1.3.0 precisam executar o novo Setup manualmente uma vez. O portátil continua com substituição manual. Os novos instaladores aceitam reinstalar a mesma versão e rejeitam downgrade; essa proteção não modifica instaladores antigos já distribuídos.

Os executáveis continuam sem certificado digital. O download usa HTTPS em produção e o atualizador confere o SHA-512 do instalador. Isso não substitui a autenticação do editor por assinatura digital; o Windows ainda pode exibir avisos de segurança.

## Publicar

Integre primeiro o código na `main`. A versão preparada nesta alteração é **1.3.0**. Depois da validação inicial abaixo, publique enviando a tag correspondente:

```powershell
git switch main
git pull --ff-only
git tag v1.3.0
git push origin v1.3.0
```

Para uma versão seguinte, ajuste pacote e lockfile antes de criar a tag:

```powershell
npm version 1.3.1 --no-git-tag-version
npm test
npm run test:ui
git add package.json package-lock.json
git commit -m "chore: prepare release 1.3.1"
git tag v1.3.1
git push origin main
git push origin v1.3.1
```

O workflow exige uma tag estável correspondente às duas versões do lockfile e ao pacote, em commit pertencente à `main`, superior à última release pública. Ele testa, gera os pacotes e valida o manifesto antes de enviá-los para um rascunho. Somente após conferir os quatro arquivos enviados a release fica pública, com notas automáticas.

O `GITHUB_TOKEN` do Actions é suficiente; a permissão `contents: write` fica restrita ao job de publicação. O app distribuído não contém token. Publicações são serializadas e builds locais usam `--publish never`.

Se a publicação falhar, corrija o erro e execute novamente os jobs falhos no Actions. Um rascunho existente pode ser retomado; uma release já pública é recusada. Após a expiração do artefato de CI (sete dias), execute novamente o workflow completo. Para corrigir uma release pública, lance uma versão superior; não substitua os binários mantendo a versão.

## Validação inicial em Windows descartável

Antes de publicar a primeira versão com auto-update, execute em VM ou Windows Sandbox, sem usar a instalação pessoal:

- Instalar o MSI público da versão 1.2.0, escolher uma pasta personalizada e definir uma pasta de clipes.
- Executar o Setup 1.3.0, conferir a atualização no mesmo diretório, preservação da configuração, atalhos, “Abrir com” e uma única entrada em Aplicativos.
- Repetir com uma instalação NSIS antiga e com uma instalação nova por usuário.
- Reinstalar a mesma versão e tentar instalar um Setup novo cujo número seja inferior ao instalado: somente o downgrade deve ser recusado.
- Manter o app aberto, inclusive durante exportação, e executar o Setup manual e silenciosamente: ele deve aguardar a saída quando iniciado pelo updater ou recusar sem encerrar o app à força.
- Testar usuário padrão, instalação antiga para todos os usuários e cancelamento do UAC.
- Confirmar que o portátil não executa o Setup e que suas configurações continuam utilizáveis.
- Entre dois builds instalados com versões diferentes, validar download, reinício manual e instalação silenciosa ao fechar; conferir a versão após reabrir.
- Cancelar o descarte de alterações e tentar atualizar durante exportação: o editor deve permanecer aberto.

## Verificação local automatizada

```powershell
npm ci
npm test
npm run test:ui
npm run dist
node scripts/release.cjs verify-artifacts
npm run test:package
npm run test:update-feed
```

O smoke de interface usa um atualizador simulado e IPC real. O smoke de feed usa o `electron-updater` real, o instalador gerado e HTTP em `127.0.0.1`; testa autorização de download e rejeição de checksum incorreto, sem executar o instalador. Os dados e downloads de teste ficam em `.cache/`.

A substituição efetiva dos arquivos instalados, as permissões/UAC e a migração do MSI exigem a validação de VM acima. A compilação do NSIS e o teste de download local não comprovam essa migração.
