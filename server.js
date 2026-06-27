require('dotenv').config();

const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const util = require('util');

const execPromise = util.promisify(exec);
const app = express();

const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(__dirname, 'temp');

// Initialize the AI client once at startup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SUPPORTED_MODELS = {
    'gemini-2.0-flash':     { label: 'Gemini 2.0 Flash',    description: 'Fast and efficient' },
    'gemini-2.5-flash':     { label: 'Gemini 2.5 Flash',    description: 'Latest flash model' },
    'gemini-2.5-pro':       { label: 'Gemini 2.5 Pro',      description: 'Most capable, slower' },
    'gemini-1.5-flash':     { label: 'Gemini 1.5 Flash',    description: 'Stable and fast' },
    'gemini-1.5-pro':       { label: 'Gemini 1.5 Pro',      description: 'Stable, high quality' },
};

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

function getModel(modelId) {
    const id = SUPPORTED_MODELS[modelId] ? modelId : DEFAULT_MODEL;
    return genAI.getGenerativeModel({ model: id });
}

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
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
    return `You are a performance testing expert. Analyze the following k6 JSON output and provide a brief, human-readable summary.

Follow these rules strictly:
1. Start with a one-sentence conclusion: "Conclusion: The test passed successfully." or "Conclusion: The test failed."
2. To determine pass/fail, check the "http_req_failed" metric's "values.rate" property. If "rate" is 0, the test passed. If not 0, it failed.
3. Report the requests per second from the "http_reqs" metric's "rate" property.
4. Report the 95th percentile response time from the "http_req_duration" metric's "p(95)" property.

Here is the JSON data to analyze: ${resultsJson}`;
}

function buildComprehensiveAnalysisPrompt(resultsJson) {
    return `Provide a comprehensive analysis of this k6 performance test result, covering:

Test Overview & Configuration
- Test duration, virtual user count, and execution strategy
- Test completion status and overall success/failure assessment

Core Performance Metrics Analysis
- http_reqs: Total requests and request rate (RPS)
- http_req_failed: Error rate percentage and absolute numbers
- http_req_duration: Full breakdown including avg, min, max, p(90), p(95), p(99) percentiles

Response Time Breakdown:
- http_req_blocked: Time waiting for TCP connection slots
- http_req_connecting: TCP connection establishment time
- http_req_tls_handshaking: TLS negotiation time (if applicable)
- http_req_sending: Data transmission time to server
- http_req_waiting: Time to first byte (TTFB)
- http_req_receiving: Response data reception time

System Resource & Load Analysis:
- vus / vus_max: Virtual user counts throughout the test
- iterations: Total completed iterations and iteration rate
- data_received / data_sent: Transfer rates

Quality & Reliability Assessment:
- checks: Success rate of assertions
- Any failed checks with root cause analysis

Performance Bottleneck Identification:
- Slowest components in the request lifecycle
- Response time percentile outliers
- Network vs. server-side performance

Business Impact & Recommendations:
- Performance against standard industry SLA criteria
- Scalability insights
- Specific optimization recommendations
- Threshold suggestions for future tests

Format with clear sections. Do not return raw markdown — use plain text with spacing.

Here is the JSON data to analyze: ${resultsJson}`;
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

app.post('/generate-script', async (req, res) => {
    const { prompt, model: modelId } = req.body;
    if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: 'A test description is required.' });
    }

    const model = getModel(modelId);

    try {
        const result = await model.generateContent(buildScriptPrompt(prompt));
        const k6Script = result.response.text();

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

    const model = getModel(modelId);

    try {
        const result = await model.generateContent(buildSimpleAnalysisPrompt(JSON.stringify(results)));
        res.json({ analysis: result.response.text() });
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

    const model = getModel(modelId);

    try {
        const result = await model.generateContent(buildComprehensiveAnalysisPrompt(JSON.stringify(results)));
        res.json({ analysis: result.response.text() });
    } catch (error) {
        console.error('Comprehensive analysis error:', error);
        res.status(500).json({ error: 'Failed to generate comprehensive analysis.', details: error.message });
    }
});

app.get('/models', (req, res) => {
    const models = Object.entries(SUPPORTED_MODELS).map(([id, meta]) => ({
        id,
        label: meta.label,
        description: meta.description,
        isDefault: id === DEFAULT_MODEL,
    }));
    res.json({ models });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});