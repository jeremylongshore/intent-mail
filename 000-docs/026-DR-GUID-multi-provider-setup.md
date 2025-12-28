# Multi-Provider AI Setup Guide

This guide walks through setting up free and low-cost AI API providers for intent-mail.

## Quick Start (5 minutes)

### Step 1: Choose Your Providers

**Recommended minimum setup:**
```
Primary:   Groq (Fastest, free tier)
Fallback1: Cerebras (1M free tokens/day)
Fallback2: Local Ollama (Phi-3:mini, always available)
```

**Total cost for this setup: $0/month**

---

## Cloud Provider Setup

### 1. Groq API (Required - Fastest)

**Why:** 280-1200 tokens/sec, 14.4K free requests/day, no credit card

**Steps:**
1. Go to: https://console.groq.com
2. Sign up (no credit card required)
3. Go to Settings → API Keys
4. Create new API key
5. Copy key to `.env`:
   ```
   GROQ_API_KEY=your_key_here
   ```

**Test:**
```bash
python -c "
from openai import OpenAI
client = OpenAI(api_key='YOUR_KEY', base_url='https://api.groq.com/openai/v1')
resp = client.chat.completions.create(
    model='llama-3.3-70b-versatile',
    messages=[{'role': 'user', 'content': 'Hi'}]
)
print(resp.choices[0].message.content)
"
```

---

### 2. Cerebras API (Recommended - Most free tokens)

**Why:** 1,000,000 free tokens/day, 3,000+ tokens/sec, SOC2 certified

**Steps:**
1. Go to: https://www.cerebras.ai/inference
2. Sign up (no credit card required)
3. Get API key from dashboard
4. Copy to `.env`:
   ```
   CEREBRAS_API_KEY=your_key_here
   ```

**Test:**
```bash
python -c "
from openai import OpenAI
client = OpenAI(api_key='YOUR_KEY', base_url='https://api.cerebras.ai/v1')
resp = client.chat.completions.create(
    model='llama-3.1-70b',
    messages=[{'role': 'user', 'content': 'Hi'}]
)
print(resp.choices[0].message.content)
"
```

---

### 3. Together.ai (Optional - Best model diversity)

**Why:** $25 free credits, 200+ models, Llama 3.2 11B Vision free

**Steps:**
1. Go to: https://www.together.ai
2. Sign up
3. Create API key in settings
4. Copy to `.env`:
   ```
   TOGETHER_API_KEY=your_key_here
   ```

**Test:**
```bash
python -c "
from openai import OpenAI
client = OpenAI(api_key='YOUR_KEY', base_url='https://api.together.ai/v1')
resp = client.chat.completions.create(
    model='meta-llama/Llama-3.3-70B-Instruct-Turbo',
    messages=[{'role': 'user', 'content': 'Hi'}]
)
print(resp.choices[0].message.content)
"
```

---

## Local Model Setup

### Option A: Ollama (Simplest, Recommended)

**Why:** One-command install, fastest setup, multiple models

**Install:**

**macOS/Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download from: https://ollama.ai/download

**Start Ollama:**
```bash
ollama serve  # Starts API server on localhost:11434
```

**Download a model (in new terminal):**
```bash
# Best all-around (3.8B, good reasoning)
ollama pull phi3:mini

# Or lightweight (1B)
ollama pull llama3.2:1b

# Or ultra-compact (360M)
ollama pull smollm2:360m

# Or for edge devices (0.5B)
ollama pull qwen2.5:0.5b
```

**Test:**
```bash
python -c "
from openai import OpenAI
client = OpenAI(api_key='ollama', base_url='http://localhost:11434/v1')
resp = client.chat.completions.create(
    model='phi3:mini',
    messages=[{'role': 'user', 'content': 'Hi'}]
)
print(resp.choices[0].message.content)
"
```

**Verify Ollama running:**
```bash
curl http://localhost:11434/api/tags
```

---

### Option B: Llamafile (Maximum Portability)

**Why:** Single executable, no installation, works offline, portable on USB

**Download:**

Latest models at: https://huggingface.co/Mozilla

Example:
```bash
# Download (choose one)
wget https://huggingface.co/Mozilla/Llama-3.2-1B-Instruct-llamafile/resolve/main/Llama-3.2-1B-Instruct.llamafile

# Make executable and run
chmod +x Llama-3.2-1B-Instruct.llamafile
./Llama-3.2-1B-Instruct.llamafile
```

**Access:**
```bash
# Web UI: http://localhost:8080
# API: http://localhost:8080/completion (similar to Ollama)

# Example:
curl http://localhost:8080/completion \
  -d '{"prompt":"Hello world","n_predict":200}'
```

---

## Multi-Provider Integration

### Installation

```bash
pip install openai litellm
```

### Basic Usage

```python
from multi_provider_implementation import MultiProviderRouter

# Initialize router (auto-detects providers from .env)
router = MultiProviderRouter()

# Get response with automatic fallback
response = router.generate(
    prompt="What is intent mail?",
    system_prompt="You are helpful assistant",
    max_tokens=500
)

print(f"Response: {response.content}")
print(f"Provider: {response.provider.value}")
print(f"Latency: {response.latency_ms:.0f}ms")
print(f"Cost: ${response.cost_usd:.6f}")
```

### Advanced Usage

```python
from multi_provider_implementation import SimpleLLMPool

pool = SimpleLLMPool()

# Simple interface
answer, provider = pool.ask("What is Python?")
print(f"{provider}: {answer}")

# Health check
health = pool.health_check()
for provider, is_healthy in health.items():
    print(f"{provider}: {'OK' if is_healthy else 'FAILED'}")

# View statistics
stats = router.get_stats()
print(stats)
```

---

## Configuration

### .env Setup

```bash
# Copy template
cp .env.providers.example .env

# Edit with your keys
nano .env
```

**Required:**
- At least `GROQ_API_KEY` OR `CEREBRAS_API_KEY`

**Optional:**
- `TOGETHER_API_KEY` for additional credits
- `OLLAMA_BASE_URL` if not using default localhost:11434

---

## Testing Your Setup

### 1. Test Individual Providers

```bash
python multi_provider_implementation.py
```

This runs 5 examples showing:
- Basic multi-provider usage
- Provider statistics
- Simple interface
- Health checks
- Custom configuration

### 2. Test Rate Limits

```python
# How many requests before hitting limits?

# Groq: 14,400 per day (1 per 6 seconds)
# Cerebras: 1,000,000 tokens/day (varies by response size)
# Together: 36 per hour on free tier (1 per 100 seconds)
# Ollama: Unlimited (local)

# Example: Check time until rate limit
import time
from datetime import datetime, timedelta

groq_requests_per_day = 14400
requests_made = 100
requests_remaining = groq_requests_per_day - requests_made
seconds_per_request = 86400 / groq_requests_per_day

print(f"Groq: {requests_remaining} requests remaining")
print(f"Safe rate: 1 request per {seconds_per_request:.0f} seconds")
```

### 3. Monitor Costs

```python
# Track spending monthly
stats = router.get_stats()
total_cost = sum(s["total_cost"] for s in stats.values())
print(f"Total spent this month: ${total_cost:.2f}")

# With recommended setup, free tier only:
# Groq: $0 (14.4K req/day free)
# Cerebras: $0 (1M tokens/day free)
# Ollama: $0 (local)
# Total: $0/month
```

---

## Model Recommendations

### By Use Case

**Speed-critical (real-time chat):**
```
Primary: Groq (280-1200 t/s)
Fallback: Local Ollama (15-25 t/s)
```

**Quality + Speed:**
```
Primary: Groq (Fastest)
Fallback: Cerebras (Highest quality models)
```

**Budget-conscious:**
```
Cerebras (1M free tokens) → Groq (14.4K free req) → Local Ollama
```

**Offline/Privacy-critical:**
```
Local Ollama only (no cloud at all)
- Phi-3:mini (3.8B, best reasoning)
- Llama3.2:1B (Meta's lightweight)
- Qwen2.5:0.5B (ultra-compact)
```

**Multimodal (vision):**
```
Together.ai: Llama 3.2 11B Vision (FREE)
OR Local: SmolVLM-256M
```

---

## Troubleshooting

### Provider not connecting

```python
# Check health
health = pool.health_check()
print(health)

# If Groq fails:
# 1. Verify GROQ_API_KEY is correct
# 2. Check rate limits: curl https://console.groq.com
# 3. Fallback to Cerebras
```

### Ollama not responding

```bash
# Check if running
curl http://localhost:11434/api/tags

# If not running, start it
ollama serve

# Check disk space (models are large)
df -h

# Models location:
# macOS: ~/.ollama/models
# Linux: ~/.ollama/models
# Windows: %USERPROFILE%\.ollama\models
```

### Rate limits exceeded

**Groq:** 14,400 requests/day
```python
# Wait 6+ seconds between requests
# Or switch to Cerebras
```

**Together.ai:** 36/hour on free tier
```python
# Wait 100+ seconds between requests
# Add credit card for higher limits (3 req/sec)
```

**Cerebras:** 1M tokens/day
```python
# Track token usage
# Switch to Groq or local if exceeded
```

---

## Production Recommendations

### For High Traffic

```python
# Multi-provider with load balancing
providers = [
    ("groq", 0.5),        # 50% traffic
    ("cerebras", 0.3),    # 30% traffic
    ("ollama", 0.2),      # 20% traffic (local fallback)
]

# Implement weighted round-robin
import random
chosen = random.choices(
    [p[0] for p in providers],
    weights=[p[1] for p in providers],
    k=1
)[0]
```

### For Cost Optimization

```python
# 1. Use free tiers first
groq_daily_budget = 14.4K requests * 300 tokens = 4.32M tokens free
cerebras_daily_budget = 1M tokens free
together_one_time = $25 credits

# 2. Monitor usage
stats = router.get_stats()
if stats["groq"]["requests"] > 10000:
    switch_to("cerebras")

# 3. Implement request queuing to avoid spikes
```

### For Reliability

```python
# Health checks every 5 minutes
# Automatic failover within 2 seconds
# Circuit breaker (disable provider after 3 failures)
# Fallback to local Ollama always available
```

---

## Next Steps

1. **Start with Groq** (easiest, fastest)
2. **Add Ollama backup** (always available locally)
3. **Monitor costs** (free tier is generous)
4. **Scale up** when needed (Cerebras, Together.ai)

---

## Resources

- Groq Docs: https://console.groq.com/docs
- Cerebras Docs: https://inference-docs.cerebras.ai
- Together.ai Docs: https://docs.together.ai
- Ollama: https://ollama.ai
- Llamafile: https://github.com/mozilla-ai/llamafile
- LiteLLM: https://docs.litellm.ai

---

## Support

For issues:
1. Check provider status pages
2. Review rate limits
3. Test health checks
4. Switch to local Ollama fallback
5. Check GitHub issues for provider-specific problems
