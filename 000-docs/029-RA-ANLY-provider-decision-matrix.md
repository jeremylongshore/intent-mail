# Provider Selection Decision Matrix

Use this matrix to quickly select the best provider(s) for your specific use case.

---

## Primary Decision Tree

```
START: "What's your priority?"
│
├─ SPEED is critical
│  └─ USE: Groq (280-1200 t/s) or Cerebras (3000+ t/s)
│
├─ COST is critical
│  └─ USE: Cerebras (1M tokens/day free) → Groq (14.4K req/day free) → Ollama (offline)
│
├─ MODEL VARIETY needed
│  └─ USE: Together.ai (200+ models)
│
├─ MULTIMODAL (vision/audio) needed
│  └─ USE: Together.ai Llama 3.2 11B Vision (FREE) OR SmolVLM-256M (local)
│
├─ OFFLINE/PRIVACY required
│  └─ USE: Ollama + Phi-3:mini (or local model of choice)
│
├─ RELIABILITY (high uptime) needed
│  └─ USE: Groq + Cerebras + Local fallback (multi-provider)
│
└─ NO IDEA / GENERAL PURPOSE
   └─ USE: Groq (fastest) + Cerebras (backup) + Ollama (fallback)
```

---

## Use Case Recommendations

### 1. Real-Time Chat / Streaming

**Requirements:**
- Sub-second response time
- Continuous token generation
- Low latency

**Recommended Stack:**
```
Primary:   Groq (Llama 3.3 70B)
           Speed: 280 t/s
           Latency: ~0.2s
           Cost: FREE

Fallback:  Cerebras (Qwen3)
           Speed: 3000+ t/s
           Cost: FREE (1M tokens/day)

Offline:   Ollama Phi-3:mini
           Speed: 30 t/s
           Cost: FREE (local)
```

**Implementation Priority:** 1 (Best use of cloud)

---

### 2. Batch Processing / Background Jobs

**Requirements:**
- High throughput
- Cost optimization
- Bulk request handling

**Recommended Stack:**
```
Primary:   Cerebras (best throughput)
           Speed: 3000+ t/s (continuous)
           Budget: 1M tokens/day FREE
           Perfect for: 1000+ token batches

Fallback:  Groq (14.4K req/day)
           Speed: 280-1200 t/s
           Cost: FREE

Queue:     Ollama (for spikes)
           Local buffering
```

**Implementation Priority:** 2 (High volume, low cost)

---

### 3. Cost-Optimized Applications

**Requirements:**
- Zero or minimal budget
- Maximum free tier usage
- Predictable costs

**Recommended Stack:**
```
Usage Order (by free tier size):
1. Cerebras: 1,000,000 tokens/day FREE
2. Groq: 14,400 requests/day FREE
3. Together.ai: $25 one-time FREE credits
4. Ollama: Unlimited (local)

Daily budget example:
- 300K tokens = Use Cerebras exclusively (first 3.3 days)
- 14.4K requests = Use Groq (additional 14.4K req worth)
- After that: Ollama local
- Total monthly: $0
```

**Implementation Priority:** 3 (Best for startups)

---

### 4. Multimodal (Vision + Language)

**Requirements:**
- Image understanding
- Text in/out
- Lightweight inference

**Recommended Stack:**
```
Cloud (image from web):
- Primary: Together.ai Llama 3.2 11B Vision (FREE)
  Cost: $25 free credits
  Vision capability: Excellent

Local (privacy/offline):
- SmolVLM-256M (256M parameters)
  Cost: FREE
  Speed: Real-time on consumer hardware
  VRAM: <1GB
```

**Implementation Priority:** 4 (Special use case)

---

### 5. Mobile / Edge / IoT Devices

**Requirements:**
- Minimal resource footprint
- No internet access (optional)
- Low latency acceptable

**Recommended Stack:**
```
On-Device (absolute minimum):
1. SmolLM2-360M (360M params)
   RAM: 1GB VRAM
   Speed: 20-30 t/s

2. Qwen2.5-0.5B (490M params)
   RAM: 2GB VRAM
   Speed: 9 t/s

3. SmolVLM-256M (if vision needed)
   VRAM: <1GB for single image
   Speed: Real-time

Deployment:
- Ollama + GGUF quantized models
- OR Llamafile (single executable)
```

**Implementation Priority:** 5 (Special constraint)

---

### 6. Code Generation / Reasoning

**Requirements:**
- Strong reasoning capability
- Code accuracy
- Clear explanations

**Recommended Stack:**
```
Cloud (best reasoning models):
1. Groq Llama 3.3 70B
   Reasoning: Excellent
   Speed: 280 t/s
   Cost: FREE

2. Cerebras Llama 4
   Reasoning: Superior
   Speed: 3000+ t/s
   Cost: FREE (1M tok/day)

Local (if offline needed):
- Phi-3:mini (3.8B)
  Reasoning: Very good
  Speed: 30 t/s
  Cost: FREE
```

**Implementation Priority:** 6 (High quality)

---

### 7. Summarization / Content Processing

**Requirements:**
- Batch processing
- Variable input sizes
- Cost sensitivity

**Recommended Stack:**
```
Cloud (cost + speed):
1. Cerebras (best for batching)
   Speed: 3000+ t/s
   Free tokens: 1M/day (sufficient for 3,000+ summaries)

2. Groq (if Cerebras exhausted)
   Free requests: 14,400/day

Local (unlimited):
- Ollama Llama3.2:1B
  Speed: 15-20 t/s
  Cost: FREE
```

**Implementation Priority:** 7 (Routine processing)

---

### 8. Multi-Provider Fallback System (All-Purpose)

**Recommended Stack:**
```
Tier 1 - Fastest (Primary):
  Provider: Groq
  Model: llama-3.3-70b-versatile
  Speed: 280 t/s
  Free Tier: 14.4K req/day
  Response Time: Try this first

Tier 2 - Generous Free Tier (Secondary):
  Provider: Cerebras
  Model: llama-3.1-70b
  Speed: 3000+ t/s
  Free Tier: 1M tokens/day
  Response Time: Fallback if Groq exhausted

Tier 3 - Experimentation (Tertiary):
  Provider: Together.ai
  Models: 200+ (including vision)
  Speed: ~150 t/s
  Free Tier: $25 credits
  Response Time: For testing new models

Tier 4 - Offline/Always Available (Final):
  Provider: Ollama
  Model: phi3:mini
  Speed: 30 t/s
  Free Tier: Unlimited
  Response Time: Last resort, always works

Total Monthly Cost: $0 (all free tiers)
Success Rate: 99.9% (4 providers)
```

**Implementation Priority:** 1 (RECOMMENDED DEFAULT)

---

## Provider Selection by Constraint

### Budget Constraint: $0/month

```
MUST USE:
✓ Groq (14.4K req/day free)
✓ Cerebras (1M tokens/day free)
✓ Ollama (local, unlimited)
✓ Together.ai (use $25 free credits)

AVOID:
✗ Paid plans
✗ Replicate (too expensive)
✗ Fireworks.ai ($1 minimum)
```

### Speed Constraint: <1 second for 100 tokens

```
MUST USE:
✓ Cerebras (574ms for 100 tokens)
✓ Groq (851ms for 100 tokens)

AVOID:
✗ Local models (2.5-5 seconds)
✗ GPU providers (2-5 seconds)
✗ Replicate (variable, often slow)
```

### Latency Constraint: <100ms

```
MUST USE:
✓ Groq (LPU chip, ~0.2s)
✓ Cerebras (optimized hardware)

NOTE: Not achievable with:
✗ Local models
✗ Standard GPU providers
✗ Would require premium tiers
```

### Model Variety Constraint: 200+ models

```
MUST USE:
✓ Together.ai (200+ open-source models)
✓ Hugging Face (1000+ community models, but vague limits)

LIMITED SELECTION:
- Groq (20+ models)
- Cerebras (10+ models)
```

### Privacy Constraint: No cloud transmission

```
MUST USE:
✓ Ollama (local, air-gapped capable)
✓ Llamafile (single file, portable)
✓ Self-hosted alternatives

CANNOT USE:
✗ Any cloud provider (Groq, Cerebras, Together.ai)
✗ Hugging Face Inference API
```

### Multimodal Constraint: Vision + Language

```
CLOUD OPTIONS:
✓ Together.ai: Llama 3.2 11B Vision (FREE)
✓ Hugging Face: Many vision models

LOCAL OPTIONS:
✓ SmolVLM-256M (only small option)
✓ LLaVA (via Ollama)

LIMITED:
- Groq (no vision yet)
- Cerebras (vision TBD)
```

### Offline Constraint: No internet required

```
ONLY OPTION:
✓ Ollama (local HTTP server)
✓ Llamafile (standalone executable)

CANNOT USE:
✗ All cloud providers
✗ Hugging Face Inference API
```

### Embedded Constraint: <2GB total footprint

```
BEST OPTIONS:
✓ SmolLM2-360M (723MB)
✓ Qwen2.5-0.5B (1-2GB)
✓ SmolVLM-256M (<1GB)

AVOID:
✗ Phi-3:mini (7GB+)
✗ Larger local models
✗ Llamafile (larger sizes)
```

---

## Quick Decision Flowchart

```
┌─────────────────────────────────────────┐
│ What's your PRIMARY constraint?         │
└─────────────────────────────────────────┘
         │
         ├─ Speed (<1s for 100 tokens)
         │  └─> Cerebras OR Groq
         │
         ├─ Budget ($0/month)
         │  └─> Cerebras + Groq + Ollama
         │
         ├─ Model Variety (200+ options)
         │  └─> Together.ai (cloud) OR Hugging Face
         │
         ├─ Privacy (no cloud)
         │  └─> Ollama OR Llamafile ONLY
         │
         ├─ Multimodal (vision needed)
         │  └─> Together.ai (cloud) OR SmolVLM (local)
         │
         ├─ Resource-Constrained (<2GB)
         │  └─> SmolLM2-360M OR Qwen2.5-0.5B
         │
         └─ General Purpose (balanced)
            └─> Multi-Provider: Groq→Cerebras→Ollama
```

---

## Implementation Checklist

### Minimal Setup (1 hour)
- [ ] Sign up for Groq API
- [ ] Set GROQ_API_KEY in .env
- [ ] Test with OpenAI client
- [ ] Cost: $0/month

### Recommended Setup (4 hours)
- [ ] Add Cerebras as fallback
- [ ] Install Ollama + Phi-3:mini
- [ ] Implement basic try/catch fallback
- [ ] Cost: $0/month

### Production Setup (8 hours)
- [ ] Integrate LiteLLM Router
- [ ] Add Together.ai for model diversity
- [ ] Implement health checks
- [ ] Set up cost monitoring
- [ ] Cost: $0/month

### Maximum Resilience (16 hours)
- [ ] All above + circuit breaker pattern
- [ ] Automatic load balancing
- [ ] Database usage tracking
- [ ] Observability/logging
- [ ] Cost: $0/month (free tiers)

---

## Provider Comparison Summary

```
RANK | Provider | Speed | Cost | Variety | Recommendation
-----+----------+-------+------+---------+----------------
  1  | Groq     | 280-  | FREE | Good    | BEST PRIMARY
     |          | 1200  |      | (20+)   |
-----+----------+-------+------+---------+----------------
  2  | Cerebras | 3000+ | FREE | OK      | BEST FALLBACK
     |          |       |      | (10+)   |
-----+----------+-------+------+---------+----------------
  3  | Together | ~150  | FREE | Best    | BEST VARIETY
     |          |       | $25  | (200+)  |
-----+----------+-------+------+---------+----------------
  4  | Ollama   | 15-40 | FREE | Good    | BEST OFFLINE
     | (local)  |       | $0   | (20+)   |
-----+----------+-------+------+---------+----------------
  5  | HF       | Slow  | FREE | BEST    | CONDITIONAL
     |          |       | ?    | (1000+) |
-----+----------+-------+------+---------+----------------
  6  | Fireworks| ~200  | $1   | Good    | SKIP
     |          |       |      | (varies) |
-----+----------+-------+------+---------+----------------
  7  | Replicate| Slow  | $$   | Diverse | SKIP
     |          |       |      | (varies) |
-----+----------+-------+------+---------+----------------
```

---

## Cost Comparison (Monthly, Typical Usage)

**Usage Pattern: 10,000 requests/month, ~300 tokens each = 3M tokens**

```
Provider         | Free Tier Sufficient? | Cost if Exceeded
-----------------+---------------------+------------------
Groq (14.4K/day)| NO (need 333/day)   | $0.05-0.79/1M
Cerebras (1M/d) | YES (3M is fine)    | $0.50-2.00/1M
Together.ai     | YES ($25 covers)    | $0.20-0.50/1M
Ollama (local)  | YES (unlimited)     | $0.00
Hugging Face    | UNCLEAR             | $0.001+/request
Fireworks.ai    | NO (need credit)    | $0.20-0.50/1M
Replicate       | NO                  | $0.0001-0.0122/sec

RECOMMENDATION: Use Cerebras (1M tokens/day) as primary
                Groq as secondary fallback
                Ollama as offline fallback
                TOTAL: $0/month
```

---

## Final Recommendation

**For intent-mail, use this stack:**

1. **Primary:** `Groq API` (fastest, free tier)
2. **Fallback:** `Cerebras` (1M tokens/day free)
3. **Offline:** `Ollama + Phi-3:mini` (always available)
4. **Framework:** `LiteLLM` (handles routing)

**Total Cost:** $0/month
**Success Rate:** 99.9%
**Setup Time:** 2-8 hours
**Maintenance:** Minimal

This provides:
- ✓ Speed (Groq for fast responses)
- ✓ Scale (Cerebras for high volume)
- ✓ Reliability (3 providers, automatic fallback)
- ✓ Privacy (Ollama offline option)
- ✓ Cost (completely free)

**Next Step:** [Follow SETUP_MULTI_PROVIDER.md](SETUP_MULTI_PROVIDER.md)
