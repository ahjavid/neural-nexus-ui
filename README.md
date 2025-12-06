# Neural Nexus UI

A modern, feature-rich chat interface for [Ollama](https://ollama.ai) - run AI models locally with style.

![Neural Nexus UI](https://img.shields.io/badge/React-18-blue) ![Vite](https://img.shields.io/badge/Vite-6-purple) ![Tailwind](https://img.shields.io/badge/Tailwind-3-cyan) ![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

- **🎨 Modern Dark UI** - Beautiful, responsive interface with smooth animations
- **🗣️ Voice Mode** - Hands-free conversation with speech recognition and text-to-speech
- **📚 Knowledge Base** - Attach custom knowledge for context-aware responses
- **🎭 Personas** - Switch between chat modes (Default, Coder, Writer, Analyst)
- **🧘 Zen Mode** - Distraction-free, minimal interface
- **⚙️ Advanced Settings** - Full control over model parameters (temperature, top_k, top_p, etc.)
- **💾 Session Management** - Multiple chat sessions with auto-save
- **📎 File Attachments** - Upload images and text files
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
│   ├── App.jsx        # Main application component
│   ├── main.jsx       # React entry point
│   └── index.css      # Global styles & Tailwind
├── index.html         # HTML template
├── vite.config.js     # Vite configuration (includes proxy)
├── tailwind.config.js # Tailwind configuration
├── postcss.config.js  # PostCSS configuration
└── package.json       # Dependencies & scripts
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

## 🏗️ Building for Production

```bash
# Build optimized bundle
npm run build

# Preview production build
npm run preview
```

The build output will be in the `dist/` folder.

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

---

Made with ❤️ for the local AI community
