# Chitkara Qualifier 1 API (Node.js)

## Endpoints
- `GET /health`
- `POST /bfhl`

## Run locally
```bash
npm install
npm start
```

## Environment
Copy `.env.example` to `.env` and fill values, or set env vars.
- `OFFICIAL_EMAIL` (required for submission)
- `AI_PROVIDER` (`gemini` or `openai`)
- `GEMINI_API_KEY` or `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, default `gpt-4o-mini`)
- `PORT` (optional, default `8080`)

## Examples
```bash
curl -X POST http://localhost:8080/bfhl -H "Content-Type: application/json" -d "{"fibonacci": 7}"
```
