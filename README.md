<div align="center">

# 🎬 Media Downloader

**Baixe vídeos do YouTube, Instagram e X (Twitter) com um clique.**

App desktop para Windows — sem anúncios, sem limites, sem conta necessária.

![Platform](https://img.shields.io/badge/platform-Windows-blue?style=flat-square&logo=windows)
![Python](https://img.shields.io/badge/Python-3.11-yellow?style=flat-square&logo=python)
![Electron](https://img.shields.io/badge/Electron-28-47848f?style=flat-square&logo=electron)
![yt-dlp](https://img.shields.io/badge/powered%20by-yt--dlp-red?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

<img src="https://raw.githubusercontent.com/ZeroTrinta/media-downloader/main/screenshot.png" width="600" alt="Screenshot do app"/>

</div>

---

## ✨ Funcionalidades

- 🎥 **YouTube** — vídeo (MP4) em até 4K ou somente áudio (MP3)
- 📸 **Instagram** — vídeos de posts e reels públicos
- 🐦 **X / Twitter** — vídeos nativos de tweets
- 🔐 **Cookies do navegador** — acesso a vídeos com restrição de idade
- 📊 **Barra de progresso** em tempo real
- 📁 **Abre a pasta** do arquivo ao concluir
- 🔄 **Atualização do yt-dlp** com um clique

---

## 🚀 Instalação

### Pré-requisito único: Git

> Se não tiver o Git, baixe em **[git-scm.com](https://git-scm.com/download/win)** e instale.  
> Todo o resto (Node.js, Python, ffmpeg, yt-dlp) é instalado automaticamente.

### Passo a passo

```bash
# 1. Clone o repositório
git clone https://github.com/ZeroTrinta/media-downloader.git

# 2. Entre na pasta
cd media-downloader

# 3. Execute o instalador (clique duas vezes no instalar.bat)
```

Ou diretamente: **clique com botão direito** em `instalar.bat` → **Executar como administrador**

O instalador vai:
1. ✅ Instalar Node.js (se necessário)
2. ✅ Instalar Python 3.11 (se necessário)
3. ✅ Instalar ffmpeg (se necessário)
4. ✅ Instalar yt-dlp e Electron
5. ✅ Criar atalho na Área de Trabalho

Após a instalação, use o **atalho na Área de Trabalho** ou clique em `iniciar.bat`.

---

## 📖 Como usar

1. Abra o app pelo atalho ou `iniciar.bat`
2. Cole a URL do vídeo no campo
3. Escolha o formato (**Vídeo MP4** ou **Áudio MP3**) e a qualidade
4. Para vídeos com restrição de idade, selecione o navegador onde você está logado
5. Clique em **Baixar**
6. Os arquivos são salvos em: `C:\Users\seu-usuario\Downloads\media-downloader`

---

## 🛠️ Requisitos do sistema

| Componente | Versão mínima | Instalado por |
|------------|--------------|---------------|
| Windows    | 10 (64-bit)  | —             |
| Git        | qualquer     | **você**      |
| Node.js    | 18+          | instalador    |
| Python     | 3.8+         | instalador    |
| ffmpeg     | qualquer     | instalador    |
| yt-dlp     | latest       | instalador    |

---

## ❓ Problemas comuns

**O app não abre / tela preta**
→ Execute `instalar.bat` novamente para garantir que todas as dependências estão instaladas.

**Erro "n challenge solving failed"**
→ Node.js não está instalado corretamente. Execute `instalar.bat` novamente.

**Vídeo com restrição de idade não baixa**
→ Selecione o navegador onde você está logado no YouTube antes de clicar em Baixar.

**Qualidade baixa / sem áudio**
→ ffmpeg não foi instalado. Execute `instalar.bat` novamente.

**Instagram / conteúdo privado não baixa**
→ O app só suporta conteúdo público. Conteúdo privado requer autenticação manual via cookies.

---

## ⚖️ Aviso legal

Este projeto usa [yt-dlp](https://github.com/yt-dlp/yt-dlp) e foi criado para uso **pessoal e educacional**.  
Use apenas para baixar conteúdo livre de direitos autorais, conteúdo próprio, ou conteúdo que você tem permissão para baixar.  
Respeite os Termos de Serviço de cada plataforma.

---

## 📄 Licença

MIT © 2024
