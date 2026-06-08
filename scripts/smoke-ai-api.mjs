const baseUrl = (process.env.API_BASE_URL || "http://localhost:3107").replace(/\/$/, "");
const smokeRequestCookie = process.env.SMOKE_REQUEST_COOKIE || "";
const live = process.env.SMOKE_AI_LIVE === "1";
const modelOverride = process.env.SMOKE_AI_MODEL;

function headers(extra = {}) {
  return {
    ...(smokeRequestCookie ? { cookie: smokeRequestCookie } : {}),
    ...extra,
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: headers(options.headers),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed (${response.status}): ${text}`);
  }

  return data;
}

function getAvailableProviderNames(config) {
  return Object.entries(config.availableProviders || {})
    .filter(([, available]) => available)
    .map(([provider]) => provider);
}

console.log(`Running AI API smoke against ${baseUrl}`);

const config = await request("/api/ai/config");
if (!config || typeof config.defaultModel !== "string" || typeof config.provider !== "string") {
  throw new Error(`Unexpected AI config response: ${JSON.stringify(config)}`);
}

const availableProviders = getAvailableProviderNames(config);
console.log(
  `AI config loaded. defaultModel=${config.defaultModel}; provider=${config.provider}; availableProviders=${availableProviders.join(",") || "none"}`
);

if (!live) {
  console.log("AI API config smoke passed. Set SMOKE_AI_LIVE=1 to run live generation checks.");
  process.exit(0);
}

if (availableProviders.length === 0) {
  throw new Error("SMOKE_AI_LIVE=1 requires at least one configured AI provider key.");
}

const model = modelOverride || config.defaultModel;
const completion = await request("/api/ai/complete", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model,
    prompt: 'Reply with exactly the word "ok".',
  }),
});

if (!completion?.text || typeof completion.text !== "string") {
  throw new Error(`Unexpected AI completion response: ${JSON.stringify(completion)}`);
}

const chat = await request("/api/ai/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model,
    message: 'Reply with exactly the word "ok".',
  }),
});

if (!chat?.text || typeof chat.text !== "string") {
  throw new Error(`Unexpected AI chat response: ${JSON.stringify(chat)}`);
}

console.log("AI API live smoke passed.");
