# Neural Nexus UI

A modern, feature-rich chat interface for [Ollama](https://ollama.ai) - run AI models locally with style.

![Neural Nexus UI](https://img.shields.io/badge/React-18-blue) ![Vite](https://img.shields.io/badge/Vite-6-purple) ![Tailwind](https://img.shields.io/badge/Tailwind-3-cyan) ![License](https://img.shields.io/badge/License-MIT-green)

![Neural Nexus UI Demo](assets/ui_screenshot.gif)

## ✨ Features

- **🎨 Modern Dark UI** - Beautiful, responsive interface with smooth animations
- **🗣️ Voice Mode** - Hands-free conversation with speech recognition and text-to-speech
- **🔧 Tool Calling** - AI can use tools for calculations, time, URL fetching, and more
- **📚 Knowledge Base** - Attach custom knowledge for context-aware responses
- **🎭 Personas** - Switch between chat modes (Default, Coder, Writer, Analyst)
- **🧘 Zen Mode** - Distraction-free, minimal interface
- **⚙️ Advanced Settings** - Full control over model parameters (temperature, top_k, top_p, etc.)
- **💾 Session Management** - Multiple chat sessions with auto-save using IndexedDB
- **📎 File Attachments** - Upload images, code files, and documents
- **📄 Document Processing** - Extract text from PDF, Word (.docx), and Excel (.xlsx) files
- **⌨️ Keyboard Shortcuts** - Power user friendly
- **🔄 Streaming Responses** - Real-time token streaming

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (or use conda with nodejs)
- [Ollama](https://ollama.ai) running locally

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/neural-nexus-ui.git
cd neural-nexus-ui

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Using Conda (Alternative)

```bash
# Create conda environment
conda create -n neural-nexus-ui nodejs=20 -y
conda activate neural-nexus-ui

# Install and run
npm install
npm run dev
```

## 🛠️ Configuration

### Ollama Setup

Make sure Ollama is running:

```bash
ollama serve
```

Pull a model:

```bash
ollama pull llama3.2
# or
ollama pull deepseek-r1:8b
```

The UI will auto-detect available models.

### Environment

The app connects to Ollama at `http://localhost:11434` by default. You can change this in the Settings panel.

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | New chat |
| `Ctrl/Cmd + B` | Toggle sidebar |
| `Ctrl/Cmd + ,` | Open settings |
| `Ctrl/Cmd + /` | Toggle Zen mode |
| `Enter` | Send message |
| `Shift + Enter` | New line |

## 🎭 Personas

- **Default** - Balanced, general-purpose assistant
- **Coder** - Technical expert for programming tasks
- **Writer** - Creative writing and content assistance
- **Analyst** - Data analysis and structured insights

## 📁 Project Structure

```
neural-nexus-ui/
├── src/
│   ├── components/       # React components (TypeScript)
│   │   ├── Button.tsx
│   │   ├── ChatInput.tsx
│   │   ├── ChatMessage.tsx
│   │   ├── CodeBlock.tsx
│   │   ├── HelpModal.tsx
│   │   ├── KnowledgeBaseModal.tsx
│   │   ├── MessageContent.tsx
│   │   ├── ModelManagerModal.tsx
│   │   ├── PersonaSelector.tsx
│   │   ├── SettingsModal.tsx
│   │   ├── Sidebar.tsx
│   │   ├── VoiceModeOverlay.tsx
│   │   ├── WelcomeScreen.tsx
│   │   └── index.ts
│   ├── utils/            # Utility functions
│   │   ├── documents.ts  # PDF/Word/Excel processing
│   │   ├── helpers.ts    # Formatting helpers
│   │   ├── storage.ts    # IndexedDB manager
│   │   └── index.ts
│   ├── types/            # TypeScript types
│   │   └── index.ts
│   ├── __tests__/        # Test files
│   │   ├── Button.test.tsx
│   │   ├── helpers.test.ts
│   │   ├── HelpModal.test.tsx
│   │   └── setup.ts
│   ├── App.jsx           # Main application component
│   ├── main.jsx          # React entry point
│   └── index.css         # Global styles & Tailwind
├── .nvmrc                # Node version (20)
├── .env.example          # Environment template
├── index.html            # HTML template
├── tsconfig.json         # TypeScript configuration
├── vitest.config.ts      # Test configuration
├── vite.config.js        # Vite configuration (includes proxy)
├── tailwind.config.js    # Tailwind configuration
├── postcss.config.js     # PostCSS configuration
└── package.json          # Dependencies & scripts
```

## 🧪 Development

### Available Scripts

```bash
# Start development server
npm run dev

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Type check
npm run typecheck

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🔧 Advanced Model Parameters

Access these in Settings → Advanced:

| Parameter | Description | Default |
|-----------|-------------|---------|
| Temperature | Creativity (0-2) | 0.7 |
| Top K | Token selection pool | 40 |
| Top P | Nucleus sampling | 0.9 |
| Repeat Penalty | Reduce repetition | 1.1 |
| Context Length | Token memory | 4096 |
| Max Tokens | Response length | 2048 |
| Mirostat | Perplexity control | Off |

## 🧠 Memory & Context

### How Context Works

- **Session Memory** - Each chat session maintains full conversation history
- **Context Window** - Limited by `num_ctx` parameter (default: 4096 tokens)
- **Knowledge Base** - Inject persistent context across conversations
- **System Prompts** - Persona-specific instructions sent with each request

### Context Tips

- Use **Knowledge Base** for information you want available across all chats
- Increase `num_ctx` in Advanced Settings for longer conversations (uses more VRAM)
- Start a **New Chat** when switching topics to avoid context pollution
- The model receives: `System Prompt + Knowledge Base + Full Chat History + Your Message`

### Storage

- Sessions are saved to **IndexedDB** (virtually unlimited storage, browser-managed)
- Knowledge Base entries are stored in IndexedDB
- No server-side storage - everything stays local
- Auto-migrates from localStorage to IndexedDB on first load

## 📄 Document Processing

Neural Nexus can extract text from various document formats for AI analysis:

| Format | Extensions | Processing | Max Size |
|--------|------------|------------|----------|
| **PDF** | `.pdf` | Text extraction from all pages | 100MB |
| **Word** | `.docx`, `.doc` | Full text extraction | 100MB |
| **Excel** | `.xlsx`, `.xls` | CSV conversion per sheet | 100MB |
| **Images** | `.png`, `.jpg`, `.gif`, `.webp` | Sent to multimodal models | 50MB |
| **Code/Text** | `.py`, `.js`, `.md`, `.txt`, etc. | Direct text injection | 25MB |

### How Document Processing Works

1. **CPU-based extraction** - Documents are processed in your browser using JavaScript libraries
2. **Text injection** - Extracted text is injected into the prompt for the LLM
3. **No external services** - All processing happens locally, your documents never leave your machine

### Supported Libraries

- **PDF.js** - Mozilla's PDF rendering library
- **Mammoth** - Word document text extraction
- **SheetJS (xlsx)** - Excel spreadsheet parsing

## 🔧 Tool Calling (Function Calling)

Neural Nexus supports Ollama's tool calling feature, allowing the AI to use tools for enhanced capabilities.

### Enabling Tools

1. Open **Settings** (`Ctrl/Cmd + ,`)
2. Click **"Show Tools (Function Calling)"**
3. Toggle **"Enable Tool Calling"** on
4. Optionally enable/disable individual tools

### Built-in Tools

| Tool | Description | Example Use |
|------|-------------|-------------|
| `get_current_time` | Get current date/time with timezone support | "What time is it in Tokyo?" |
| `calculate` | Mathematical calculations | "What is 15% of 250?" |
| `random_number` | Generate random numbers | "Give me a random number between 1 and 100" |
| `web_search` | Search the web using DuckDuckGo | "Search for Lexus RX 350 2025 specs" |
| `fetch_url` | Fetch content from a specific URL | "Fetch the content from https://example.com" |
| `encode_text` | Base64/URL encoding/decoding | "Encode this text to base64" |
| `generate_uuid` | Generate UUIDs | "Generate a UUID for me" |
| `text_stats` | Text analysis (word count, etc.) | "How many words are in this paragraph?" |

### Supported Models

Tool calling requires models that support function calling:
- **qwen3** (recommended)
- **llama3.1**, **llama3.2**
- **mistral**
- **granite3-dense**

### How It Works

1. When tools are enabled, tool definitions are sent with your message
2. The model decides if any tools would help answer your question
3. If yes, the model generates tool calls instead of a direct response
4. Neural Nexus executes the tools and sends results back to the model
5. The model generates a final response using the tool results

> **Note:** When tools are enabled, responses use non-streaming mode which may feel slightly slower, but enables the AI to use tools accurately.

## ⚠️ Known Limitations

| Issue | Description | Workaround |
|-------|-------------|------------|
| Voice Mode (Firefox) | Speech recognition not supported | Use Chrome, Edge, or Safari |
| Large Context | May slow down with very long conversations | Start new chat or reduce `num_ctx` |
| Image Support | Only works with multimodal models (llava, etc.) | Use a vision-capable model |
| Token Limit | Responses truncated at `num_predict` tokens | Increase in Advanced Settings |
| CORS Errors | Browser blocks Ollama API | App uses Vite proxy (dev mode) |
| Tool Calling | Only works with compatible models | Use qwen3, llama3.1+, or mistral |

## 🐛 Reporting Issues

Found a bug? Please [open an issue](https://github.com/ahjavid/neural-nexus-ui/issues) with:

1. **Description** - What happened vs. what you expected
2. **Steps to Reproduce** - How to trigger the bug
3. **Environment** - Browser, OS, Ollama version, model used
4. **Console Errors** - Open DevTools (F12) → Console tab
5. **Screenshots** - If applicable

### Common Issues

<details>
<summary><b>Connection Failed / Can't reach Ollama</b></summary>

1. Make sure Ollama is running: `ollama serve`
2. Check if Ollama responds: `curl http://localhost:11434/api/tags`
3. In dev mode, the Vite proxy handles CORS automatically
4. For production builds, configure Ollama with `OLLAMA_ORIGINS=*`
</details>

<details>
<summary><b>No models available</b></summary>

1. Pull a model first: `ollama pull llama3.2`
2. Click the refresh button next to the model dropdown
3. Check Ollama is running: `ollama list`
</details>

<details>
<summary><b>Voice mode not working</b></summary>

1. Use Chrome, Edge, or Safari (Firefox not supported)
2. Allow microphone permissions when prompted
3. Check browser console for errors (F12)
4. Ensure HTTPS or localhost (required for mic access)
</details>

<details>
<summary><b>Slow responses / High latency</b></summary>

1. Reduce `num_ctx` (context length) in Advanced Settings
2. Use a smaller model (e.g., `llama3.2:1b` instead of `llama3.2:8b`)
3. Check GPU utilization with `ollama ps`
4. Reduce `num_predict` for shorter responses
</details>

## 🏗️ Building for Production

```bash
# Build optimized bundle
npm run build

# Preview production build
npm run preview
```

The build output will be in the `dist/` folder.

> **Note:** Production builds require Ollama to have CORS enabled:
> ```bash
> OLLAMA_ORIGINS=* ollama serve
> ```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Ollama](https://ollama.ai) - Local LLM runtime
- [React](https://react.dev) - UI framework
- [Vite](https://vitejs.dev) - Build tool
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Lucide](https://lucide.dev) - Icons
- [PDF.js](https://mozilla.github.io/pdf.js/) - PDF text extraction
- [Mammoth](https://github.com/mwilliamson/mammoth.js) - Word document processing
- [SheetJS](https://sheetjs.com/) - Excel spreadsheet parsing

---

Made with ❤️ for the local AI community
