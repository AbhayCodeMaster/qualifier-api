const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json({ limit: '64kb' }));

const OFFICIAL_EMAIL = process.env.OFFICIAL_EMAIL || 'YOUR CHITKARA EMAIL';
const MAX_ARRAY_LEN = parseInt(process.env.MAX_ARRAY_LEN || '1000', 10);
const MAX_ABS_VALUE = parseInt(process.env.MAX_ABS_VALUE || '1000000', 10);
const MAX_FIB_N = parseInt(process.env.MAX_FIB_N || '10000', 10);
const MAX_AI_QUESTION_LEN = parseInt(process.env.MAX_AI_QUESTION_LEN || '500', 10);

const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function errorResponse(res, status, message) {
  return res.status(status).json({
    is_success: false,
    official_email: OFFICIAL_EMAIL,
    error: message,
  });
}

app.get('/health', (req, res) => {
  res.json({
    is_success: true,
    official_email: OFFICIAL_EMAIL,
  });
});

app.post('/bfhl', async (req, res) => {
  try {
    const body = req.body || {};
    const keys = ['fibonacci', 'prime', 'lcm', 'hcf', 'AI'];
    const active = keys.filter((k) => Object.prototype.hasOwnProperty.call(body, k));

    if (active.length !== 1) {
      return errorResponse(res, 400, 'request must contain exactly one key');
    }

    const key = active[0];
    let data;

    if (key === 'fibonacci') {
      const n = body.fibonacci;
      if (!Number.isInteger(n) || n < 0 || n > MAX_FIB_N) {
        return errorResponse(res, 400, 'fibonacci must be between 0 and MAX_FIB_N');
      }
      data = fibSeries(n);
    } else if (key === 'prime') {
      const arr = body.prime;
      const err = validateArray(arr, 'prime');
      if (err) return errorResponse(res, 400, err);
      data = arr.filter(isPrime);
    } else if (key === 'lcm') {
      const arr = body.lcm;
      const err = validateArray(arr, 'lcm');
      if (err) return errorResponse(res, 400, err);
      data = lcmList(arr);
    } else if (key === 'hcf') {
      const arr = body.hcf;
      const err = validateArray(arr, 'hcf');
      if (err) return errorResponse(res, 400, err);
      data = hcfList(arr);
    } else if (key === 'AI') {
      const q = body.AI;
      if (typeof q !== 'string') {
        return errorResponse(res, 400, 'AI question must be a string');
      }
      const trimmed = q.trim();
      if (!trimmed) {
        return errorResponse(res, 400, 'AI question must be non-empty');
      }
      if (trimmed.length > MAX_AI_QUESTION_LEN) {
        return errorResponse(res, 400, 'AI question too long');
      }
      data = await aiSingleWord(trimmed);
    } else {
      return errorResponse(res, 400, 'unknown key');
    }

    return res.json({
      is_success: true,
      official_email: OFFICIAL_EMAIL,
      data,
    });
  } catch (err) {
    return errorResponse(res, 500, 'Internal server error');
  }
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return errorResponse(res, 400, 'Invalid JSON');
  }
  return errorResponse(res, 500, 'Internal server error');
});

function validateArray(arr, label) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return `${label} array must be non-empty`;
  }
  if (arr.length > MAX_ARRAY_LEN) {
    return 'array length out of bounds';
  }
  for (const n of arr) {
    if (!Number.isInteger(n) || Math.abs(n) > MAX_ABS_VALUE) {
      return 'array value out of bounds';
    }
  }
  return null;
}

function fibSeries(n) {
  if (n <= 0) return [];
  const series = [0, 1];
  while (series.length < n) {
    const len = series.length;
    series.push(series[len - 1] + series[len - 2]);
  }
  return series.slice(0, n);
}

function isPrime(n) {
  if (n <= 1) return false;
  if (n <= 3) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

function lcm(a, b) {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd(a, b);
}

function lcmList(arr) {
  let result = Math.abs(arr[0]);
  for (let i = 1; i < arr.length; i++) {
    result = lcm(result, Math.abs(arr[i]));
  }
  return result;
}

function hcfList(arr) {
  let result = Math.abs(arr[0]);
  for (let i = 1; i < arr.length; i++) {
    result = gcd(result, Math.abs(arr[i]));
  }
  return result;
}

async function aiSingleWord(question) {
  if (AI_PROVIDER === 'openai') {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    return await aiOpenAI(question);
  }
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  return await aiGemini(question);
}

async function aiGemini(question) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const payload = {
    contents: [
      { role: 'user', parts: [{ text: question }] }
    ]
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    throw new Error(`AI provider error: ${resp.status}`);
  }

  const data = await resp.json();
  const text = extractGeminiText(data);
  return firstWord(text);
}

function extractGeminiText(data) {
  try {
    const candidates = data.candidates || [];
    if (!candidates.length) return '';
    const parts = candidates[0].content?.parts || [];
    return parts.map((p) => p.text || '').join(' ');
  } catch (e) {
    return '';
  }
}

async function aiOpenAI(question) {
  const url = 'https://api.openai.com/v1/responses';
  const payload = {
    model: OPENAI_MODEL,
    input: question,
    max_output_tokens: 16,
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    throw new Error(`AI provider error: ${resp.status}`);
  }

  const data = await resp.json();
  let text = '';
  const output = data.output || [];
  for (const item of output) {
    const content = item.content || [];
    for (const block of content) {
      if (block.type === 'output_text') {
        text += `${block.text || ''} `;
      }
    }
  }
  return firstWord(text);
}

function firstWord(text) {
  const match = String(text || '').trim().match(/[A-Za-z0-9]+/);
  return match ? match[0] : '';
}

module.exports = app;
