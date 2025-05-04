# 🚀 LogCAI - Local + Cloud AI Coding Assistant

> Supercharge your VS Code with blazing-fast local AI and intelligent coding assistance.


## ✨ Core Features

- 🧠 **Chat with AI inside VS Code**  
  Get streaming, interactive chat responses from your models.

- ✍️ **Inline Code Suggestions**  
  Autocomplete code intelligently, with live updates as you type.

- 📚 **Retrieval-Augmented Generation (RAG)**  
  Automatically index your project and inject relevant snippets into AI prompts.

- 🔀 **Switch Model Providers**  
  Choose between Ollama (local), OpenAI, or Anthropic anytime.

- 🛡️ **Secure API Key Storage**  
  Your API keys are encrypted and stored securely using VS Code's Secret Storage.

- 📈 **Status Bar Connection Status**  
  Always know if your model is connected or needs attention.

- ⚡ **Streamed Completions**  
  Chat and inline code completions stream live without delay.

- 🧩 **Command Palette Shortcuts**  
  Easily open chat, trigger completions, manage models, run diagnostics, and more.

- 🎨 **Beautiful Syntax-Highlighted Chat UI**  
  Supports copy-to-clipboard, regenerate response, and insert to editor.

- 🧠 **Language-Aware Context Extraction**  
  Smartly extracts local functions, classes, and imports for better AI accuracy.

- 🧹 **Project Structure Awareness**  
  Uses a file tree overview during prompt construction for smarter replies.

- 🚀 **Install Ollama Models Easily**  
  Directly install popular Ollama models from the extension.

---

## 🛠️ Supported Model Providers

| Provider | Mode | Details |
|:---------|:-----|:--------|
| **Ollama** | Local | No internet needed. Models run fully offline. |
| **OpenAI** | Cloud | Supports GPT-4o, GPT-4 Turbo, etc. |
| **Anthropic** | Cloud | Supports Claude 3 Opus and others. |

Switch easily using the `LogCAI: Select Model Provider` command.

---

## 🛠️ Available Commands

- **LogCAI: Open Chat** – Open the chat panel.
- **LogCAI: Get Inline Completion** – Trigger inline code generation manually.
- **LogCAI: Index Codebase** – Build your workspace RAG index.
- **LogCAI: Clear Codebase Index** – Reset RAG storage.
- **LogCAI: Install Ollama Model** – Install missing models on the fly.
- **LogCAI: Run Diagnostics** – Check server connections and model health.
- **LogCAI: Select Model Provider** – Switch between Ollama, OpenAI, Anthropic.
- **LogCAI: Select Ollama Model** – Pick your active Ollama model.

---

## ⚙️ Key Settings

| Setting | Description |
|:--------|:------------|
| `logcai.modelProvider` | Choose your model backend. |
| `logcai.temperature` | Control randomness of output. |
| `logcai.maxTokens` | Maximum response length. |
| `logcai.enableRAG` | Enable or disable project context retrieval. |
| `logcai.inlinePreviewDelay` | Delay for showing inline previews. |
| `logcai.maxFilesToProcess` | Control project indexing depth. |

All configurable via **Settings → Extensions → LogCAI**.

---

## 📦 Installation

1. Install **Ollama** if using local models:  
   👉 [https://ollama.ai/download](https://ollama.ai/download)

2. Start Ollama server:
   ```bash
   ollama serve
   ```

3. Install LogCAI from VSCode Marketplace 


4. Open the Command Palette and search `LogCAI`.

---

## 🛡️ Security

- ✅ API keys stored securely in VS Code Secret Storage.
- ✅ No hidden telemetry.
- ✅ Ollama local mode keeps your data private and offline.

---

## 📜 License

This project is licensed under the [MIT License](./LICENSE).

---

## 🙌 Built With

- VS Code API
- TypeScript
- Ollama
- OpenAI
- Anthropic
- Love ❤️ by [Sridhar](https://logcai.com)

---

# 🚀 Install LogCAI and Code Smarter — Locally and Privately!

---
