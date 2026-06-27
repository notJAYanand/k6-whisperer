# k6 Whisperer — AI-Powered Performance Testing

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![k6](https://img.shields.io/badge/k6-Latest-blue.svg)](https://k6.io/)

> Describe a performance test in plain English. k6 Whisperer generates the script, runs it, and gives you an AI-powered analysis — no k6 expertise required.

## Features

- **Natural Language Interface** — Describe tests in plain English (e.g. "stress test my login endpoint with 100 users for 5 minutes")
- **Multi-Provider AI** — Supports Google Gemini, Groq (Llama), OpenRouter, and local Ollama models; only models you've configured appear in the selector
- **Editable Scripts** — Review and modify the generated k6 script before execution
- **Step-by-Step Workflow** — Generate → Review → Run → Analyze, with each step visible and controllable
- **AI Result Analysis** — Two tiers: a quick summary and a comprehensive breakdown covering response times, throughput, bottlenecks, and SLA recommendations
- **Concurrent-Safe Execution** — Each test run uses isolated temp files, so multiple users don't interfere with each other
- **Sample Prompts** — Clickable example prompts for quick demos

## Tech Stack

- **Backend** — Node.js, Express.js
- **Frontend** — HTML, CSS, Vanilla JavaScript
- **Performance Engine** — Grafana k6
- **AI Providers** — Google Gemini, Groq, OpenRouter, Ollama (via OpenAI-compatible adapter)
- **Architecture** — RESTful API, multi-provider AI abstraction layer

## Getting Started

### Prerequisites

1. **Node.js** v18+ — [nodejs.org](https://nodejs.org/)
2. **k6** — [k6.io/docs/get-started/installation](https://k6.io/docs/get-started/installation/)
3. **At least one AI provider API key** (see below — all have free tiers)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/k6-whisperer.git
   cd k6-whisperer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Then open `.env` and fill in the keys for whichever providers you want to use. You only need **one** to get started.

4. **Start the server**
   ```bash
   npm start
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## AI Provider Setup

All providers have a free tier. You only need to configure the ones you want — unconfigured providers are automatically hidden from the model selector.

| Provider | Free? | Get API Key | Recommended Model |
|---|---|---|---|
| **Groq** | Yes | [console.groq.com](https://console.groq.com) | Llama 3.3 70B — fast, great code gen |
| **Google Gemini** | Yes | [aistudio.google.com](https://aistudio.google.com) | Gemini 2.0 Flash |
| **OpenRouter** | Free models | [openrouter.ai](https://openrouter.ai) | Llama 3.1 8B (free tier) |
| **Ollama** | Completely free | [ollama.com](https://ollama.com) — local install | `ollama pull llama3` |

Add your keys to `.env`:
```
GROQ_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here
OLLAMA_BASE_URL=http://localhost:11434   # no key needed
```

## How to Use

1. **Select a model** from the dropdown (only your configured models appear)
2. **Describe your test** in the text area, or click one of the example chips
3. **Review the generated script** — it's fully editable before you run it
4. **Run the test** — raw k6 output appears immediately
5. **Get AI analysis** — choose a quick summary or a comprehensive breakdown

### Example Prompts

- `Run a simple load test on https://test.k6.io with 10 virtual users for 30 seconds.`
- `Create a stress test for https://test.k6.io/news.php. Start with 5 users, ramp up to 30 over 45 seconds, then hold for 30 seconds.`
- `Test the POST endpoint at https://test.k6.io/flip_coin.php with bet=heads, 5 users for 20 seconds. Check that status is 200.`
- `Load test https://test.k6.io/pi.php?decimals=8 with 15 users for 30 seconds. Fail if p(95) exceeds 900ms.`
- `Test my local server at http://localhost:8080/api/users with 10 users for 1 minute.`

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/models` | Returns available models based on configured API keys |
| `POST` | `/generate-script` | Generates a k6 script from a natural language prompt |
| `POST` | `/run-script` | Executes a k6 script and returns raw output + JSON metrics |
| `POST` | `/analyze-results` | Returns a brief AI summary of test results |
| `POST` | `/comprehensive-results-analysis` | Returns a detailed AI analysis with recommendations |

## Troubleshooting

**Model not appearing in the selector**
- Check that the corresponding API key is set in `.env`
- Restart the server after editing `.env`

**k6 not found**
- Ensure k6 is installed and on your PATH
- Run `k6 version` to confirm; restart your terminal after installation

**AI generated an invalid script**
- Try rephrasing your prompt to be more specific
- Switch to a more capable model (Llama 3.3 70B or Gemini 2.5 Pro)

**Groq / OpenRouter rate limit errors**
- Free tiers have request limits; wait a moment and retry
- Switch to a different provider temporarily

**Ollama not connecting**
- Ensure the Ollama app is running
- Verify `OLLAMA_BASE_URL` in `.env` matches your Ollama port
- Pull the model first: `ollama pull llama3`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## Acknowledgments

- [Grafana k6](https://k6.io/) for the# k6 Whisperer — AI-Powered Performance Testing

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![k6](https://img.shields.io/badge/k6-Latest-blue.svg)](https://k6.io/)

> Describe a performance test in plain English. k6 Whisperer generates the script, runs it, and gives you an AI-powered analysis — no k6 expertise required.

## Features

- **Natural Language Interface** — Describe tests in plain English (e.g. "stress test my login endpoint with 100 users for 5 minutes")
- **Multi-Provider AI** — Supports Google Gemini, Groq (Llama), OpenRouter, and local Ollama models; only models you've configured appear in the selector
- **Editable Scripts** — Review and modify the generated k6 script before execution
- **Step-by-Step Workflow** — Generate → Review → Run → Analyze, with each step visible and controllable
- **AI Result Analysis** — Two tiers: a quick summary and a comprehensive breakdown covering response times, throughput, bottlenecks, and SLA recommendations
- **Concurrent-Safe Execution** — Each test run uses isolated temp files, so multiple users don't interfere with each other
- **Sample Prompts** — Clickable example prompts for quick demos

## Tech Stack

- **Backend** — Node.js, Express.js
- **Frontend** — HTML, CSS, Vanilla JavaScript
- **Performance Engine** — Grafana k6
- **AI Providers** — Google Gemini, Groq, OpenRouter, Ollama (via OpenAI-compatible adapter)
- **Architecture** — RESTful API, multi-provider AI abstraction layer

## Getting Started

### Prerequisites

1. **Node.js** v18+ — [nodejs.org](https://nodejs.org/)
2. **k6** — [k6.io/docs/get-started/installation](https://k6.io/docs/get-started/installation/)
3. **At least one AI provider API key** (see below — all have free tiers)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/k6-whisperer.git
   cd k6-whisperer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Then open `.env` and fill in the keys for whichever providers you want to use. You only need **one** to get started.

4. **Start the server**
   ```bash
   npm start
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## AI Provider Setup

All providers have a free tier. You only need to configure the ones you want — unconfigured providers are automatically hidden from the model selector.

| Provider | Free? | Get API Key | Recommended Model |
|---|---|---|---|
| **Groq** | Yes | [console.groq.com](https://console.groq.com) | Llama 3.3 70B — fast, great code gen |
| **Google Gemini** | Yes | [aistudio.google.com](https://aistudio.google.com) | Gemini 2.0 Flash |
| **OpenRouter** | Free models | [openrouter.ai](https://openrouter.ai) | Llama 3.1 8B (free tier) |
| **Ollama** | Completely free | [ollama.com](https://ollama.com) — local install | `ollama pull llama3` |

Add your keys to `.env`:
```
GROQ_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here
OLLAMA_BASE_URL=http://localhost:11434   # no key needed
```

## How to Use

1. **Select a model** from the dropdown (only your configured models appear)
2. **Describe your test** in the text area, or click one of the example chips
3. **Review the generated script** — it's fully editable before you run it
4. **Run the test** — raw k6 output appears immediately
5. **Get AI analysis** — choose a quick summary or a comprehensive breakdown

### Example Prompts

- `Run a simple load test on https://test.k6.io with 10 virtual users for 30 seconds.`
- `Create a stress test for https://test.k6.io/news.php. Start with 5 users, ramp up to 30 over 45 seconds, then hold for 30 seconds.`
- `Test the POST endpoint at https://test.k6.io/flip_coin.php with bet=heads, 5 users for 20 seconds. Check that status is 200.`
- `Load test https://test.k6.io/pi.php?decimals=8 with 15 users for 30 seconds. Fail if p(95) exceeds 900ms.`
- `Test my local server at http://localhost:8080/api/users with 10 users for 1 minute.`

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/models` | Returns available models based on configured API keys |
| `POST` | `/generate-script` | Generates a k6 script from a natural language prompt |
| `POST` | `/run-script` | Executes a k6 script and returns raw output + JSON metrics |
| `POST` | `/analyze-results` | Returns a brief AI summary of test results |
| `POST` | `/comprehensive-results-analysis` | Returns a detailed AI analysis with recommendations |

## Troubleshooting

**Model not appearing in the selector**
- Check that the corresponding API key is set in `.env`
- Restart the server after editing `.env`

**k6 not found**
- Ensure k6 is installed and on your PATH
- Run `k6 version` to confirm; restart your terminal after installation

**AI generated an invalid script**
- Try rephrasing your prompt to be more specific
- Switch to a more capable model (Llama 3.3 70B or Gemini 2.5 Pro)

**Groq / OpenRouter rate limit errors**
- Free tiers have request limits; wait a moment and retry
- Switch to a different provider temporarily

**Ollama not connecting**
- Ensure the Ollama app is running
- Verify `OLLAMA_BASE_URL` in `.env` matches your Ollama port
- Pull the model first: `ollama pull llama3`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## Acknowledgments

- [Grafana k6](https://k6.io/) for the
