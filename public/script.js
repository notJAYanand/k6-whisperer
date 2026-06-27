const SAMPLE_PROMPTS = {
    'basic-load': 'Run a simple load test on https://test.k6.io with 10 virtual users for 30 seconds.',
    'stress-ramp': 'Create a stress test for https://test.k6.io/news.php. Start with 5 users, ramp up to 30 users over 45 seconds, then stay at 30 users for another 30 seconds.',
    'post-checks': 'Test the POST endpoint at https://test.k6.io/flip_coin.php. Send a payload with bet=heads for 20 seconds using 5 virtual users. Add a check to verify the HTTP status is 200.',
    'thresholds': 'Run a load test on https://test.k6.io/pi.php?decimals=8 for 30 seconds with 15 users. Add a threshold to fail the test if the 95th percentile response time exceeds 900 milliseconds.',
};

let lastTestResults = null;
let selectedModel = null;
let chartInstances = {};

function setPrompt(key) {
    document.getElementById('promptInput').value = SAMPLE_PROMPTS[key];
}

function setButtonLoading(btn, loading, label) {
    btn.disabled = loading;
    btn.innerHTML = loading
        ? `<span class="spinner"></span>${label}...`
        : label;
}

function showError(elementId, message) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    el.hidden = false;
}

function hideError(elementId) {
    document.getElementById(elementId).hidden = true;
}

async function generateScript() {
    const prompt = document.getElementById('promptInput').value;
    if (!prompt.trim()) {
        showError('generateError', 'Please enter a test description.');
        return;
    }
    hideError('generateError');

    const btn = document.getElementById('generateBtn');
    setButtonLoading(btn, true, 'Generate Script');

    try {
        const response = await fetch('/generate-script', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, model: selectedModel }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to generate script.');

        document.getElementById('generatedScript').value = data.script;
        document.getElementById('scriptSection').hidden = false;
        document.getElementById('scriptSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        showError('generateError', error.message);
    } finally {
        setButtonLoading(btn, false, 'Generate Script');
    }
}

async function runScript() {
    const script = document.getElementById('generatedScript').value;
    if (!script.trim()) {
        showError('runError', 'No script to run.');
        return;
    }
    hideError('runError');

    const btn = document.getElementById('runBtn');
    setButtonLoading(btn, true, 'Run Test');

    lastTestResults = null;
    document.getElementById('resultsSection').hidden = true;
    document.getElementById('rawOutput').textContent = '';
    document.getElementById('analysis').textContent = '';
    document.getElementById('comprehensiveAnalysis').textContent = '';
    destroyChart('percentileChart');
    destroyChart('lifecycleChart');
    document.getElementById('metricCards').innerHTML = '';

    try {
        const response = await fetch('/run-script', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ script }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to run script.');

        lastTestResults = data.results;
        document.getElementById('rawOutput').textContent = data.summary;

        const failedRate = data.results?.metrics?.http_req_failed?.value ?? null;
        const statusEl = document.getElementById('resultsStatus');
        if (failedRate === 0) {
            statusEl.textContent = '✓ Test completed — 0% error rate';
            statusEl.className = 'results-status pass';
        } else if (failedRate > 0) {
            statusEl.textContent = `✗ Test completed — ${(failedRate * 100).toFixed(1)}% error rate`;
            statusEl.className = 'results-status fail';
        } else {
            statusEl.textContent = 'Test completed.';
            statusEl.className = 'results-status info';
        }

        document.getElementById('resultsSection').hidden = false;
        renderCharts(data.results);
        document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        showError('runError', error.message);
    } finally {
        setButtonLoading(btn, false, 'Run Test');
    }
}

async function getAnalysis() {
    if (!lastTestResults) return;

    const btn = document.getElementById('getAnalysisBtn');
    setButtonLoading(btn, true, 'Get AI Summary');

    try {
        const response = await fetch('/analyze-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results: lastTestResults, model: selectedModel }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to get analysis.');

        document.getElementById('analysis').textContent = data.analysis;
    } catch (error) {
        document.getElementById('analysis').textContent = `Analysis failed: ${error.message}`;
    } finally {
        setButtonLoading(btn, false, 'Get AI Summary');
    }
}

async function getComprehensiveAnalysis() {
    if (!lastTestResults) return;

    const btn = document.getElementById('getComprehensiveAnalysisBtn');
    setButtonLoading(btn, true, 'Get Comprehensive Analysis');

    try {
        const response = await fetch('/comprehensive-results-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results: lastTestResults, model: selectedModel }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to get analysis.');

        document.getElementById('comprehensiveAnalysis').textContent = data.analysis;
    } catch (error) {
        document.getElementById('comprehensiveAnalysis').textContent = `Analysis failed: ${error.message}`;
    } finally {
        setButtonLoading(btn, false, 'Get Comprehensive Analysis');
    }
}

async function copyScript() {
    const script = document.getElementById('generatedScript').value;
    if (!script) return;

    const btn = document.getElementById('copyBtn');
    try {
        await navigator.clipboard.writeText(script);
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    } catch {
        document.getElementById('generatedScript').select();
    }
}

async function loadModels() {
    try {
        const response = await fetch('/models');
        const { models } = await response.json();
        const select = document.getElementById('modelSelect');
        select.innerHTML = '';

        models.forEach(m => {
            const option = document.createElement('option');
            option.value = m.id;
            option.textContent = m.label;
            if (m.isDefault) {
                option.selected = true;
                selectedModel = m.id;
                document.getElementById('modelDescription').textContent = m.description;
            }
            select.appendChild(option);
        });

        select.addEventListener('change', () => {
            selectedModel = select.value;
            const chosen = models.find(m => m.id === selectedModel);
            document.getElementById('modelDescription').textContent = chosen?.description ?? '';
        });
    } catch (error) {
        console.error('Failed to load models:', error);
    }
}

function destroyChart(id) {
    if (chartInstances[id]) {
        chartInstances[id].destroy();
        chartInstances[id] = null;
    }
}

function renderMetricCards(metrics) {
    const totalReqs = metrics.http_reqs?.count ?? 'N/A';
    const rps = metrics.http_reqs?.rate?.toFixed(2) ?? 'N/A';
    const failedRate = metrics.http_req_failed?.value ?? null;
    const errorRate = failedRate != null ? (failedRate * 100).toFixed(2) + '%' : 'N/A';
    const p95 = metrics.http_req_duration?.['p(95)'] != null
        ? metrics.http_req_duration['p(95)'].toFixed(0) + ' ms'
        : 'N/A';

    const cards = [
        { label: 'Total Requests', value: totalReqs },
        { label: 'Requests / sec', value: rps },
        { label: 'Error Rate', value: errorRate, highlight: failedRate > 0 ? 'error' : 'success' },
        { label: 'p(95) Response', value: p95 },
    ];

    document.getElementById('metricCards').innerHTML = cards.map(c =>
        `<div class="metric-card ${c.highlight || ''}">
            <div class="metric-value">${c.value}</div>
            <div class="metric-label">${c.label}</div>
        </div>`
    ).join('');
}

function renderPercentileChart(metrics) {
    const values = metrics.http_req_duration;
    if (!values) return;

    const data = [values.avg, values.med, values['p(90)'], values['p(95)'], values.max]
        .map(v => v != null ? parseFloat(v.toFixed(2)) : 0);

    destroyChart('percentileChart');
    chartInstances.percentileChart = new Chart(
        document.getElementById('percentileChart').getContext('2d'),
        {
            type: 'bar',
            data: {
                labels: ['Avg', 'Median', 'p(90)', 'p(95)', 'Max'],
                datasets: [{
                    label: 'ms',
                    data,
                    backgroundColor: ['#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3'],
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, title: { display: true, text: 'ms' } } }
            }
        }
    );
}

function renderLifecycleChart(metrics) {
    const phases = [
        { key: 'http_req_blocked', label: 'Blocked' },
        { key: 'http_req_connecting', label: 'Connecting' },
        { key: 'http_req_tls_handshaking', label: 'TLS' },
        { key: 'http_req_sending', label: 'Sending' },
        { key: 'http_req_waiting', label: 'Waiting (TTFB)' },
        { key: 'http_req_receiving', label: 'Receiving' },
    ];

    const labels = phases.map(p => p.label);
    const data = phases.map(p => {
        const avg = metrics[p.key]?.avg;
        return avg != null ? parseFloat(avg.toFixed(2)) : 0;
    });

    destroyChart('lifecycleChart');
    chartInstances.lifecycleChart = new Chart(
        document.getElementById('lifecycleChart').getContext('2d'),
        {
            type: 'bar',
            data: {
                labels,
                datasets: [{ label: 'Avg ms', data, backgroundColor: '#6366f1', borderRadius: 4 }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true, title: { display: true, text: 'ms' } } }
            }
        }
    );
}

function renderCharts(results) {
    const metrics = results?.metrics;
    if (!metrics) return;
    renderMetricCards(metrics);
    renderPercentileChart(metrics);
    renderLifecycleChart(metrics);
}

document.addEventListener('DOMContentLoaded', loadModels);
