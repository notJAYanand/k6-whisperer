require('dotenv').config();

const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const util = require('util');

const execPromise = util.promisify(exec);
const app = express();

const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(__dirname, 'temp');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// --- Provider clients (initialized once at startup) ---

const googleClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const groqClient = process.env.GROQ_API_KEY
    ? new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
    : null;

const openRouterClient = process.env.OPENROUTER_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api/v1' })
    : null;

const ollamaClient = new OpenAI({
    apiKey: 'ollama',
    baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
});

// --- Model registry ---

const SUPPORTED_MODELS = {
    // Google Gemini
    'gemini-2.0-flash': { provider: 'google',      apiModel: 'gemini-2.0-flash',                              label: 'Gemini 2.0 Flash',      description: 'Google · Fast & capable',      requiresKey: 'GEMINI_API_KEY' },
    'gemini-2.5-flash': { provider: 'google',      apiModel: 'gemini-2.5-flash',                              label: 'Gemini 2.5 Flash',      description: 'Google · Latest flash',        requiresKey: 'GEMINI_API_KEY' },
    'gemini-2.5-pro':   { provider: 'google',      apiModel: 'gemini-2.5-pro',                                label: 'Gemini 2.5 Pro',        description: 'Google · Most capable',        requiresKey: 'GEMINI_API_KEY' },
    'gemini-1.5-flash': { provider: 'google',      apiModel: 'gemini-1.5-flash',                              label: 'Gemini 1.5 Flash',      description: 'Google · Stable & fast',       requiresKey: 'GEMINI_API_KEY' },
    'gemini-1.5-pro':   { provider: 'google',      apiModel: 'gemini-1.5-pro',                                label: 'Gemini 1.5 Pro',        description: 'Google · Stable, high quality',requiresKey: 'GEMINI_API_KEY' },

    // Groq (free tier)
    'groq/llama-3.3-70b': { provider: 'groq',      apiModel: 'llama-3.3-70b-versatile',                      label: 'Llama 3.3 70B',         description: 'Groq · Free · Very fast',      requiresKey: 'GROQ_API_KEY' },
    'groq/llama-3.1-8b':  { provider: 'groq',      apiModel: 'llama-3.1-8b-instant',                         label: 'Llama 3.1 8B',          description: 'Groq · Free · Fastest',        requiresKey: 'GROQ_API_KEY' },
    'groq/gemma2-9b':     { provider: 'groq',      apiModel: 'gemma2-9b-it',                                  label: 'Gemma 2 9B',            description: 'Groq · Free · Google model',   requiresKey: 'GROQ_API_KEY' },

    // OpenRouter (free models)
    'openrouter/llama-3.1-8b': { provider: 'openrouter', apiModel: 'meta-llama/llama-3.1-8b-instruct:free',  label: 'Llama 3.1 8B',          description: 'OpenRouter · Free',            requiresKey: 'OPENROUTER_API_KEY' },
    'openrouter/mistral-7b':   { provider: 'openrouter', apiModel: 'mistralai/mistral-7b-instruct:free',     label: 'Mistral 7B',            description: 'OpenRouter · Free',            requiresKey: 'OPENROUTER_API_KEY' },

    // Ollama (fully local — no key needed)
    'ollama/llama3':    { provider: 'ollama', apiModel: 'llama3',    label: 'Llama 3 (Local)',    description: 'Ollama · Free · Local',        requiresKey: null },
    'ollama/codellama': { provider: 'ollama', apiModel: 'codellama', label: 'CodeLlama (Local)', description: 'Ollama · Free · Code-focused', requiresKey: null },
    'ollama/mistral':   { provider: 'ollama', apiModel: 'mistral',   label: 'Mistral (Local)',   description: 'Ollama · Free · Local',        requiresKey: null },
};

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

function isModelAvailable(modelId) {
    const config = SUPPORTED_MODELS[modelId];
    if (!config) return false;
    if (!config.requiresKey) return true;
    return !!process.env[config.requiresKey];
}

async function generateText(modelId, prompt) {
    const config = SUPPORTED_MODELS[modelId] || SUPPORTED_MODELS[DEFAULT_MODEL];

    if (config.provider === 'google') {
        const model = googleClient.getGenerativeModel({ model: config.apiModel });
        const result = await model.generateContent(prompt);
        return result.response.text();
    }

    const clients = { groq: groqClient, openrouter: openRouterClient, ollama: ollamaClient };
    const client = clients[config.provider];

    if (!client) {
        throw new Error(`Provider '${config.provider}' is not configured. Add the required API key to your .env file.`);
    }

    const result = await client.chat.completions.create({
        model: config.apiModel,
        messages: [{ role: 'user', content: prompt }],
    });

    return result.choices[0].message.content;
}

app.use(express.json());
app.use(express.static('public'));

// --- Prompt Templates ---

function buildScriptPrompt(userPrompt) {
    return `You are an expert in k6. Your task is to generate a complete k6 JavaScript test script based on the user's request.

IMPORTANT: Follow these k6 import rules strictly:
- Use "import http from 'k6/http';" for HTTP requests
- Use "import { sleep, check } from 'k6';" for sleep and check functions
- Use "import { Rate, Counter } from 'k6/metrics';" for custom metrics
- Never use "import { sleep } from 'k6/sleep';" - this is incorrect

You must only output the raw JavaScript code and nothing else.
Do not include any explanation or markdown formatting like \`\`\`javascript.

User's request: "${userPrompt}"`;
}

function buildSimpleAnalysisPrompt(resultsJson) {
    return `You are a performance testing expert. Analyze the following k6 JSON summary and provide a brief, human-readable summary.

CRITICAL INSTRUCTION — Pass/Fail determination:
The JSON contains a metric called "http_req_failed". Look at its "values" object and find the "rate" key.
- "rate" is a decimal between 0 and 1 representing the FAILURE rate.
- If "rate" is 0 (or 0.0), it means ZERO requests failed — the test PASSED.
- If "rate" is greater than 0, it means some requests failed — the test FAILED.
- The "passes" and "fails" keys inside "values" refer to the number of times the rate metric was evaluated, NOT the number of HTTP requests that succeeded or failed. Do not use them for pass/fail.

Follow these rules:
1. Start with: "Conclusion: The test passed successfully." or "Conclusion: The test failed."
2. Report the requests per second from http_reqs → values → rate.
3. Report the 95th percentile response time from http_req_duration → values → "p(95)".

Here is the JSON data: ${resultsJson}`;
}

function buildComprehensiveAnalysisPrompt(resultsJson) {
    return `You are a performance testing expert. Analyze the following k6 JSON summary and provide a comprehensive analysis.

CRITICAL INSTRUCTION — Pass/Fail determination:
The JSON contains a metric called "http_req_failed". Look at its "values" object and find the "rate" key.
- "rate" is a decimal between 0 and 1 representing the FAILURE rate.
- If "rate" is 0 (or 0.0), the error rate is 0% and the test PASSED.
- If "rate" is greater than 0 (e.g. 0.25 = 25% failure rate), the test FAILED.
- Do NOT use "passes" or "fails" keys inside "values" to count HTTP successes/failures. They are internal rate-metric counters, not request counts.
- The total HTTP request count is found at http_reqs → values → count.

Provide a comprehensive analysis covering:

Test Overview & Configuration
- Test duration, virtual user count, and execution strategy
- Overall pass/fail verdict with the exact error rate percentage

Core Performance Metrics
- http_reqs: total count and requests per second (values.rate)
- http_req_failed: exact failure rate percentage (values.rate × 100)
- http_req_duration: avg, min, max, p(90), p(95), p(99)

Response Time Breakdown
- http_req_blocked: time waiting for a TCP connection slot
- http_req_connecting: TCP connection establishment time
- http_req_tls_handshaking: TLS negotiation time (if present)
- http_req_sending: time to send data to the server
- http_req_waiting: time to first byte (TTFB)
- http_req_receiving: response download time

Load & Resource Analysis
- vus / vus_max: virtual user utilization
- iterations: total count and rate
- data_received / data_sent: transfer volumes and rates

Quality Assessment
- checks: pass rate of assertions (if present in the JSON)

Performance Bottleneck Identification
- Slowest lifecycle component
- Percentile spread (gap between p(90) and p(99) indicates tail latency issues)

Recommendations
- Comparison against industry SLA standards (p(95) < 500ms, error rate < 1%)
- Specific optimization suggestions
- Suggested threshold values for future test runs

Format with clear section headers. Use plain text, not markdown.

Here is the JSON data: ${resultsJson}`;
}

// --- Helpers ---

function isValidK6Script(script) {
    return typeof script === 'string' && script.includes("import http from 'k6/http'");
}

function cleanupFiles(...filePaths) {
    for (const filePath of filePaths) {
        try { fs.unlinkSync(filePath); } catch { /* file may not exist */ }
    }
}

// --- Routes ---

app.get('/models', (req, res) => {
    const models = Object.entries(SUPPORTED_MODELS)
        .filter(([id]) => isModelAvailable(id))
        .map(([id, meta]) => ({
            id,
            label: meta.label,
            description: meta.description,
            isDefault: id === DEFAULT_MODEL,
        }));
    res.json({ models });
});

app.post('/generate-script', async (req, res) => {
    const { prompt, model: modelId } = req.body;
    if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: 'A test description is required.' });
    }

    try {
        const k6Script = await generateText(modelId || DEFAULT_MODEL, buildScriptPrompt(prompt));

        if (!isValidK6Script(k6Script)) {
            console.error('AI generated an invalid script.');
            return res.status(500).json({ error: 'The AI failed to generate a valid k6 script. Please try rephrasing your prompt.' });
        }

        res.json({ script: k6Script });
    } catch (error) {
        console.error('Script generation error:', error);
        res.status(500).json({ error: 'Failed to generate script.', details: error.message });
    }
});

app.post('/run-script', async (req, res) => {
    const { script } = req.body;

    if (!isValidK6Script(script)) {
        return res.status(400).json({ error: "Invalid k6 script. The script must include 'import http from 'k6/http''." });
    }

    const runId = crypto.randomUUID();
    const scriptPath = path.join(TEMP_DIR, `test_${runId}.js`);
    const resultsPath = path.join(TEMP_DIR, `results_${runId}.json`);

    try {
        fs.writeFileSync(scriptPath, script);

        const command = `k6 run "${scriptPath}" --summary-export="${resultsPath}"`;
        const { stdout } = await execPromise(command);

        const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

        res.json({ summary: stdout, results });
    } catch (error) {
        console.error('Script execution error:', error);
        res.status(500).json({ error: 'Failed to execute script.', details: error.stderr || error.message });
    } finally {
        cleanupFiles(scriptPath, resultsPath);
    }
});

app.post('/analyze-results', async (req, res) => {
    const { results, model: modelId } = req.body;
    if (!results) {
        return res.status(400).json({ error: 'No test results provided.' });
    }

    try {
        const analysis = await generateText(modelId || DEFAULT_MODEL, buildSimpleAnalysisPrompt(JSON.stringify(results)));
        res.json({ analysis });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze results.', details: error.message });
    }
});

app.post('/comprehensive-results-analysis', async (req, res) => {
    const { results, model: modelId } = req.body;
    if (!results) {
        return res.status(400).json({ error: 'No test results provided.' });
    }

    try {
        const analysis = await generateText(modelId || DEFAULT_MODEL, buildComprehensiveAnalysisPrompt(JSON.stringify(results)));
        res.json({ analysis });
    } catch (error) {
        console.error('Comprehensive analysis error:', error);
        res.status(500).json({ error: 'Failed to generate comprehensive analysis.', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});