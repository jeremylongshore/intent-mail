# Free and Low-Cost AI Providers Research - Executive Summary

**Date:** December 27, 2025
**Project:** intent-mail multi-provider AI integration
**Research Scope:** 6 cloud APIs, 6 local models, multi-provider fallback strategies

---

## Key Findings

### Best Cloud Providers (Ranked)

1. **Groq API** - RECOMMENDED PRIMARY
   - Free tier: 14,400 requests/day (no credit card)
   - Speed: 280-1,200 tokens/sec (5-18x faster than competitors)
   - Models: Llama 3.1/3.3/4, Mixtral, Gemma, GPT-OSS
   - Cost: $0/month (free tier only)
   - Latency: ~0.2 seconds
   - **Best for:** Real-time applications, streaming responses

2. **Cerebras** - RECOMMENDED SECONDARY
   - Free tier: 1,000,000 tokens/day (no credit card)
   - Speed: 3,000+ tokens/sec (fastest processing)
   - Models: Llama 4, Qwen3 32B-480B, GPT-OSS 120B
   - Cost: $0/month (free tier only)
   - Benchmark: 574ms for 100 tokens (best-in-class)
   - **Best for:** High-volume batch processing, enterprise requirements

3. **Together.ai** - RECOMMENDED FOR DIVERSITY
   - Free tier: $25 credits + Llama 3.2 11B Vision FREE
   - Models: 200+ models (largest selection)
   - Rate limit: 36/hour on free (add card for 3 req/sec)
   - Cost: $0/month (free credits + multimodal)
   - **Best for:** Model experimentation, multimodal applications

4. **Hugging Face** - CONDITIONAL
   - Free tier: "Few hundred requests/month" (vague)
   - Models: 1,000+ community models
   - Cost: $9/month PRO plan for clarity
   - **Issue:** Documentation lacks specificity
   - **Best for:** Discovering niche models, community-driven use

5. **Fireworks.ai** - NOT RECOMMENDED
   - Free tier: Only $1 credits
   - Cost: $0.20-0.50/1M tokens
   - **Issue:** Minimal free tier
   - **Skip unless:** Need fine-tuning deployment

6. **Replicate** - NOT RECOMMENDED
   - Free tier: Very limited runs
   - Pricing: Per-second ($0.0001-0.0122/sec)
   - **Issue:** High overhead, not ideal for free tier
   - **Skip unless:** Need specialized model marketplace

---

### Recommended Free Tier Architecture

```
User Request
    ↓
[Application Layer]
    ↓
[Provider Router - LiteLLM]
    ↓
┌─────────────────────────────────────────┐
│ PRIMARY: Groq (280-1200 t/s)            │ ← Try first (fastest)
│ Cost: $0 (14.4K req/day free)           │
└─────────────────────────────────────────┘
    ↓ (if rate limit or error)
┌─────────────────────────────────────────┐
│ SECONDARY: Cerebras (3000+ t/s)         │ ← 1M tokens/day
│ Cost: $0 (very generous free tier)      │
└─────────────────────────────────────────┘
    ↓ (if rate limit or error)
┌─────────────────────────────────────────┐
│ TERTIARY: Together.ai ($25 credits)     │ ← Experimentation
│ Cost: $0 (free credits available)       │
└─────────────────────────────────────────┘
    ↓ (if cloud unavailable)
┌─────────────────────────────────────────┐
│ OFFLINE: Local Ollama (Phi-3:mini)      │ ← Always available
│ Cost: $0 (local, no internet)           │
└─────────────────────────────────────────┘

TOTAL MONTHLY COST: $0 (all free tiers)
TOTAL AVAILABLE TOKENS/DAY: 14.4K req + 1M tokens + $25 = PLENTY
```

---

## Best Local Models (Ranked by Use Case)

### For General-Purpose Chat (Recommended: Phi-3:mini)

| Model | Size | Speed | Reasoning | Best For |
|-------|------|-------|-----------|----------|
| **Phi-3:mini** | 3.8B | 20-40 t/s | Excellent | RECOMMENDED - Best all-around |
| Llama3.2:1B | 1.0B | 15-20 t/s | Good | Lightweight production |
| TinyLlama | 1.1B | 15-25 t/s | Good | Speed-optimized |
| SmolLM2-360M | 0.36B | 20-30 t/s | Basic | IoT/Raspberry Pi |
| Qwen2.5-0.5B | 0.49B | 9 t/s (CPU) | Basic | Ultra-edge devices |

### For Vision+Language (SmolVLM-256M only)
- Size: 256M (smallest multimodal)
- Speed: Real-time on consumer hardware
- Cost: Free, no cloud calls
- Use: Image understanding on edge

### Quick Deployment Commands

```bash
# Install Ollama (1 command)
curl -fsSL https://ollama.ai/install.sh | sh

# Start service
ollama serve

# Download model (new terminal)
ollama pull phi3:mini      # Recommended
# OR
ollama pull llama3.2:1b    # Lightweight
# OR
ollama pull smollm2:360m   # Ultra-compact
```

---

## Implementation Complexity

### Cloud APIs: SIMPLE (OpenAI-compatible)
All recommended providers (Groq, Cerebras, Together.ai) are **direct OpenAI API drop-in replacements**

```python
# Works with ANY provider - just change API key and base_url
from openai import OpenAI

# Groq
client = OpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1")

# Cerebras
client = OpenAI(api_key=cerebras_key, base_url="https://api.cerebras.ai/v1")

# Together.ai
client = OpenAI(api_key=together_key, base_url="https://api.together.ai/v1")

# All use same completion API
response = client.chat.completions.create(...)
```

**Complexity Score: 1/10 (Trivial)**

---

### Local Models: VERY SIMPLE (HTTP server)
Both Ollama and Llamafile provide OpenAI-compatible HTTP endpoints

```bash
# Ollama: automatically starts on localhost:11434
curl http://localhost:11434/api/generate -d '{"model":"phi3:mini","prompt":"Hi"}'

# Llamafile: starts on localhost:8080
curl http://localhost:8080/completion -d '{"prompt":"Hi"}'
```

**Complexity Score: 2/10 (Trivial)**

---

### Multi-Provider Router: SIMPLE with LiteLLM
Pre-built framework handles fallback, cost tracking, retry logic

```python
from litellm import Router

router = Router(model_list=[...])  # Config
response = router.completion(...)  # Automatic fallback
```

**Complexity Score: 2/10 (Configuration only)**

---

## Cost Analysis for intent-mail

### Scenario 1: Free Tier Only (Recommended)

**Monthly allocation:**
- Groq: 14,400 requests/day free (432K/month)
- Cerebras: 1,000,000 tokens/day free (30M/month)
- Together.ai: $25 free credits (expires)
- Ollama: Unlimited local

**Use case:** 1,000 daily requests
- ~300 tokens per request = 300,000 tokens/day
- **Days to exhaust free tier:** 100+ days (3+ months)
- **Cost:** $0/month

**Verdict:** Free tier MORE than sufficient for most applications

---

### Scenario 2: With Paid Upgrades (If needed)

**If exceeding free limits:**
- Groq paid: $0.05-0.79 per 1M tokens
- Cerebras paid: $0.50-2.00 per 1M tokens (estimated)
- Together.ai: $0.20-0.50 per 1M tokens

**Example:** 10M tokens/month
- Groq: $0.50-7.90
- Cerebras: $5-20
- Together.ai: $2-5
- **Total: $7.50-33/month** (varies by model selection)

---

## Recommended Implementation Roadmap

### Phase 1: MVP (1 hour)
1. Sign up for Groq API (free, no card)
2. Set `GROQ_API_KEY` in `.env`
3. Use OpenAI client with Groq endpoint
4. Cost: $0/month

### Phase 2: Reliability (2 hours)
1. Add Cerebras as fallback (free tier)
2. Set `CEREBRAS_API_KEY`
3. Implement simple try/catch with fallback logic
4. Cost: $0/month

### Phase 3: Offline Capability (1 hour)
1. Install Ollama
2. Pull `phi3:mini` model
3. Add Ollama as final fallback
4. Cost: $0/month (local)

### Phase 4: Production (4 hours)
1. Integrate LiteLLM Router
2. Add health checks (5-min intervals)
3. Implement cost tracking
4. Add rate limit awareness
5. Cost: $0/month

**Total implementation time: 8 hours**
**Total cost: $0/month**

---

## Key Metrics & Benchmarks

### Speed Comparison (tokens/second)

```
Groq Llama 3.3 70B:        280 t/s
Groq Mixtral:               430+ t/s
Groq Gemma 7B:              814 t/s
Cerebras (varies by model):  3,000+ t/s

Local Phi-3:mini:           20-40 t/s
Local Llama3.2:1B:          15-20 t/s
Local TinyLlama:            15-25 t/s

Comparison:
- Groq is 7-40x faster than local models
- Cerebras is 100-150x faster than local
- For quality, use Groq/Cerebras; for offline, use local
```

### Latency for 100 Tokens

```
Cerebras Llama 3.1 70B:  574ms (fastest)
Groq Llama 3.1 70B:      851ms
FriendliAI:              1,041ms
GPU providers:           2,000-5,000ms

Local Phi-3:mini:        2,500-5,000ms (depends on CPU)
```

### Cost per 1M Tokens (Paid tier)

```
Groq:        $0.05-0.79 (cheapest for small models)
Together.ai: $0.20-0.50
Cerebras:    $0.50-2.00 (estimated)
OpenAI:      $0.50-15.00 (most expensive)
Local:       $0.00 (no cloud cost)
```

---

## Risk Mitigation

### Provider Outages
- Groq June 2025 incident: ~2 hours downtime
- Solution: Automatic fallback to Cerebras (different infrastructure)

### Rate Limits
- Groq: 14.4K req/day = 1 every 6 seconds on average
- Cerebras: 1M tokens/day (varies by response size)
- Solution: Queue requests, implement circuit breaker

### API Changes
- All recommended providers maintain OpenAI compatibility
- Switch providers requires only URL/key change
- Local Ollama provides ultimate fallback

### Cost Overruns
- Start with free tiers only (LiteLLM can enforce limits)
- Set monthly budget alerts
- Automatic fallback to local Ollama if limit approached

---

## Files Provided

1. **research-free-ai-providers.md** (35 KB)
   - Comprehensive provider comparison
   - Local model specifications
   - Integration complexity assessment
   - Multi-provider strategy deep-dive

2. **provider-comparison-matrix.csv** (2 KB)
   - Quick reference table
   - All metrics at a glance
   - Easy for spreadsheet analysis

3. **multi-provider-implementation.py** (12 KB)
   - Production-ready code
   - 5 complete examples
   - LiteLLM integration
   - Health checks, stats, cost tracking

4. **SETUP_MULTI_PROVIDER.md** (10 KB)
   - Step-by-step setup guide
   - Per-provider instructions
   - Troubleshooting section
   - Testing procedures

5. **requirements-providers.txt** (1 KB)
   - All necessary dependencies
   - Optional packages explained

6. **.env.providers.example** (2 KB)
   - Configuration template
   - Environment variable guide

---

## Next Steps

1. **Immediate (Now):**
   - Create `.env` from template
   - Sign up for Groq API (5 minutes)
   - Add key to `.env`

2. **Short-term (Today):**
   - Test Groq connection
   - Sign up for Cerebras
   - Install Ollama

3. **Medium-term (This week):**
   - Integrate `multi-provider-implementation.py`
   - Deploy health checks
   - Set up cost monitoring

4. **Long-term (Ongoing):**
   - Monitor usage patterns
   - Optimize provider selection
   - Add new providers as needed

---

## Support & Resources

- **Groq Docs:** https://console.groq.com/docs
- **Cerebras:** https://inference-docs.cerebras.ai
- **Together.ai:** https://docs.together.ai
- **Ollama:** https://ollama.ai
- **LiteLLM:** https://docs.litellm.ai

---

## Conclusion

**For intent-mail, we recommend:**
1. **Primary:** Groq API (free tier, fastest)
2. **Fallback:** Cerebras (free tier, most tokens)
3. **Offline:** Ollama + Phi-3:mini (always available)
4. **Framework:** LiteLLM (handles routing)

**Total cost: $0/month** (all free tiers)
**Setup time: 2-8 hours** (MVP to production)
**Risk level: Low** (multiple providers, local fallback)

This multi-provider approach ensures reliability, speed, cost-effectiveness, and offline capability for intent-mail.
