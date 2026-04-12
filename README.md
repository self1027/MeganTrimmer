# Video Trimmer

Ferramenta desktop para extração e corte de mídia de alta precisão, desenvolvida com Electron, TypeScript e FFmpeg.

## Funcionalidades

* **Corte de Precisão:** Interface baseada em timeline com suporte a seeking otimizado via FFmpeg.
* **Fidelidade Visual:** Processamento utilizando libx264 com CRF 18 e mapeamento integral de trilhas.
* **Storyboard:** Geração de miniaturas em tempo real para navegação visual na linha do tempo.
* **Portabilidade:** Executável autônomo com binário FFmpeg integrado e configurado.
* **Interface:** Design focado em utilidade e clareza, sem elementos decorativos desnecessários.

## Stack Técnica

* **Core:** Electron 41.2.0
* **Linguagem:** TypeScript 6.0.2 (Ambiente ESM)
* **Processamento:** FFmpeg via fluent-ffmpeg
* **Empacotamento:** Electron Builder

## Instruções de Uso

### Instalação de Dependências
```bash
npm install
```

### Ambiente de Desenvolvimento
```bash
npm run dev
```

### Compilação e Distribuição
Para gerar o executável portátil na pasta release:
```bash
npm run dist
```
*Observação: O processo de build requer privilégios de administrador ou ativação do Modo de Desenvolvedor no Windows para a correta extração das ferramentas de assinatura.*

## Especificações de Processamento

A extração de mídia é executada com os seguintes parâmetros técnicos:
* **Codec de Vídeo:** libx264 (H.264)
* **Perfil de Qualidade:** CRF 18 (Transparência visual)
* **Velocidade de Codificação:** Superfast
* **Tratamento de Áudio:** AAC 192kbps
* **Sincronia:** Passthrough de VSync para preservação da taxa de quadros original.

---
*Projeto estruturado para integração direta com sistemas operacionais Windows via argumentos de linha de comando.*