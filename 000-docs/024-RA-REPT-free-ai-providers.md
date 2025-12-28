# Free and Low-Cost AI API Providers Research

**Research Date:** December 27, 2025
**Objective:** Evaluate free/low-cost multi-model AI providers and local small models for intent-mail integration

---

## Executive Summary

This research identifies 6 cloud API providers and 6 local model options suitable for free or cost-efficient multi-model AI inference. **Groq API** emerges as the top free tier option with exceptional speed (280-1200 tokens/sec), while **Together.ai** offers best free credits ($25) with 200+ models. For local deployment, **Qwen2.5:0.5B** and **Llama3.2:1B** provide the optimal balance of resource efficiency and capability.

A multi-provider fallback strategy using LiteLLM or LLMSwap is recommended to ensure reliability and cost optimization.

---

## Part 1: Cloud API Provider Comparison

### 1. Groq API

**Status:** RECOMMENDED - Fastest free tier option

| Category | Details |
|----------|---------|
| **Free Tier** | 14,400 requests/day; No credit card required |
| **Rate Limits** | Varies by model: ~1,000 req/day or 500K tokens/day per model |
| **Speed** | 280-1200 tokens/sec (best-in-class performance) |
| **Supported Models** | Llama 3.1/3.3/4, Llama Guard 4, Mixtral, Gemma, GPT-OSS, Qwen3, specialized models |
| **Inference Speed Benchmarks** | Llama 3.3 70B: 280 t/s; Llama 3.1 8B: 560 t/s; Mixtral: 430+ t/s; Gemma 7B: 814 t/s |
| **Context Window** | 131,072 tokens (competitive) |
| **Pricing** | Per-token (paid tier): $0.05-$0.79/1M tokens input; $0.08-$0.79/1M output |
| **API Format** | OpenAI-compatible |
| **Cold Start Latency** | ~0.2 seconds (LPU advantage) |
| **Integration Complexity** | SIMPLE - Direct OpenAI API drop-in replacement |

**Strengths:**
- Extraordinary inference speed (4-18x faster than GPU competitors)
- Generous free tier without credit card
- Real-time performance for high-throughput applications
- LPU chips optimized for throughput, not latency

**Weaknesses:**
- Daily request limits (not ideal for very high-volume free use)
- Smaller model selection vs. Together.ai
- No multimodal models (vision/audio) yet

**Best For:** Real-time chat, streaming responses, high-throughput free tier experiments

---

### 2. Together.ai

**Status:** RECOMMENDED - Best free credits, largest model selection

| Category | Details |
|----------|---------|
| **Free Tier** | $25 in free credits; Llama 3.2 11B Vision FREE (unlimited) |
| **Rate Limits** | Free: 0.6 req/min (36/hr); With card: 3 req/min |
| **Models Available** | 200+ open-source models (chat, code, image, audio, embeddings) |
| **Free Models** | Llama 3.3 70B Instruct Turbo (limited), Llama 3.2 11B Vision (free) |
| **Pricing** | Per-token inference; Batch processing (50% discount); Fine-tuning available |
| **Image Generation** | FLUX models available (pay-per-megapixel) |
| **API Format** | OpenAI-compatible |
| **Multimodal** | Vision models available (Llama 3.2 11B Vision) |
| **Integration Complexity** | SIMPLE - OpenAI-compatible API |

**Strengths:**
- Highest diversity of models (200+)
- Best free multimodal option (Llama 3.2 11B Vision)
- Generous initial credits ($25)
- Supports specialized models (code, audio, embeddings)

**Weaknesses:**
- Slower inference than Groq (general-purpose hardware)
- Limited rate limits on free tier (36/hour)
- Must add card for higher limits

**Best For:** Model experimentation, multimodal applications, fine-tuning

---

### 3. Cerebras

**Status:** RECOMMENDED - Most generous free tier tokens

| Category | Details |
|----------|---------|
| **Free Tier** | 1,000,000 tokens/day FREE; No credit card required |
| **Announcement** | June 2, 2025 - API fully opened with generous free tier |
| **Supported Models** | Llama 4, Qwen3 (32B, 235B), Qwen3 Coder 480B, GPT-OSS 120B, 20B |
| **Inference Speed** | 3,000+ tokens/sec (fastest processing speed) |
| **Benchmarks** | Llama 3.1 70B: 574ms for 100 tokens (top performer) |
| **API Format** | OpenAI-compatible |
| **Certification** | SOC2/HIPAA certified |
| **Context Window** | Competitive (varies by model) |
| **Integration Complexity** | SIMPLE - OpenAI drop-in compatible |

**Strengths:**
- Most generous free tier (1M tokens/day)
- Extreme inference speed (3,000+ t/s)
- Enterprise-ready certifications
- Latest models (Qwen3, GPT-OSS)

**Weaknesses:**
- Newer provider (less established track record)
- Fewer specialized models than Together.ai
- Limited documentation availability

**Best For:** High-volume free tier, large batch processing, enterprise requirements

---

### 4. Hugging Face Inference API

**Status:** CONDITIONAL - Free tier exists but vague limits

| Category | Details |
|----------|---------|
| **Free Tier** | Monthly credits (exact limit unclear, "few hundred requests/month") |
| **PRO Plan** | $9/month for 20x included inference credits |
| **Models Available** | 1000s of open-source models via Hugging Face Hub |
| **Rate Limits** | Varies by model; use billing dashboard to monitor |
| **Billing Model** | Credits-based (compute time × hardware cost) |
| **Serverless Inference** | Built-in caching, rate limiting per user/org |
| **Inference Endpoints** | Dedicated endpoints available (paid) |
| **Integration Complexity** | MODERATE - HF API or Hugging Face Inference Endpoints |

**Strengths:**
- Largest model selection (1000s of community models)
- Flexible billing model
- Integrated with model hosting ecosystem
- Community-driven model selection

**Weaknesses:**
- Vague documentation on free tier limits
- Slower inference than Groq/Cerebras
- Credit system less transparent than token-based pricing
- Higher cost post-free tier

**Best For:** Discovering niche models, experimentation, model development

---

### 5. Fireworks.ai

**Status:** NOT RECOMMENDED for free tier (minimal credits)

| Category | Details |
|----------|---------|
| **Free Tier** | $1 in starter credits only |
| **Pricing Tiers** | Developer (free), Developer Pro (pay-as-you-go) |
| **Models** | Access to various open-source and proprietary models |
| **Pricing Range** | $0.20-$0.50 per 1M tokens (mid-range cost) |
| **Fine-Tuning** | Deploying fine-tuned models to serverless is FREE |
| **Features** | Prompt caching (discount available) |
| **API Format** | OpenAI-compatible |
| **Integration Complexity** | SIMPLE - Standard OpenAI format |

**Strengths:**
- Transparent per-token pricing
- Free fine-tuned model deployment
- Prompt caching discounts
- Good for production workloads

**Weaknesses:**
- Minimal free tier ($1 only)
- Not recommended for free-tier focused projects
- Mid-range pricing compared to Groq

**Best For:** Small production deployments, fine-tuned models, cost-aware projects

---

### 6. Replicate

**Status:** NOT RECOMMENDED for free tier (limited runs)

| Category | Details |
|----------|---------|
| **Free Tier** | Limited free runs; then pay-as-you-go |
| **Pricing Model** | Per-second billing (varies by hardware) |
| **Price Range** | $0.0001/sec (CPU) to $0.0122/sec (8x H100) |
| **Hourly Equivalent** | $0.36/hr (CPU) to $43.92/hr (8x H100) |
| **Model Types** | Diverse (vision, text, audio, video) |
| **Public vs Private** | Shared pool (public) vs. dedicated (private) |
| **Strength** | Setup time free for shared instances |
| **Integration Complexity** | MODERATE - REST API, varying model interfaces |

**Strengths:**
- Diverse model marketplace
- Predictable per-second pricing
- Good for specialized/custom models

**Weaknesses:**
- Very limited free tier
- Higher overhead costs due to per-second billing
- Shared queue delays possible
- Not ideal for cost-conscious free tier use

**Best For:** Custom model deployment, marketplace browsing

---

## Cloud Provider Comparison Matrix

| Provider | Free Credits | Free Daily Tokens | Rate Limit (Free) | Speed | Model Count | Multimodal | Cost Tier | Recommendation |
|----------|--------------|-------------------|-------------------|-------|------------|-----------|-----------|-----------------|
| **Groq** | None | 500K tokens* | 14.4K req/day | 280-1200 t/s | 20+ | No | Pay-per-use | BEST |
| **Together.ai** | $25 | Unlimited (1 model) | 36/hour | ~150 t/s | 200+ | Yes | Low | BEST |
| **Cerebras** | None | 1M tokens | High | 3000+ t/s | 10+ | Yes | Pay-per-use | BEST |
| **Hugging Face** | ~Few 100 req | Unclear | Unclear | Slow | 1000+ | Yes | $9/mo | CONDITIONAL |
| **Fireworks.ai** | $1 | N/A | N/A | ~200 t/s | Varies | Yes | $0.20-0.50/M | SKIP |
| **Replicate** | Limited | N/A | Variable | Slow | Diverse | Yes | $0.0001-0.0122/sec | SKIP |

*With rate limits; effective tokens vary by model

---

## Part 2: Local Small Model Comparison

### Model Specifications & Deployment

| Model | Parameters | File Size | RAM Required | Inference Speed | Token Context | Best Use Case |
|-------|-----------|-----------|---------------|-----------------|----------------|--------------|
| **Qwen2.5-0.5B** | 0.49B | 1-2GB | 2GB VRAM; 4GB min | 9 t/s (CPU) | 32.7K tokens | Edge devices, mobile |
| **Phi-3:mini** | 3.8B | ~7GB | 4GB VRAM; 8GB optimal | 20-40 t/s | 4K/128K | Balanced efficiency |
| **Llama3.2:1B** | 1.0B | ~2GB | 2GB VRAM; 4GB+ | 15-20 t/s | 8K tokens | Lightweight chat |
| **TinyLlama** | 1.1B | ~2GB | 2GB VRAM | 15-25 t/s | 4K tokens | Fast inference |
| **SmolLM2-360M** | 0.36B | 723MB | 1GB VRAM; 6GB+ optimal | 20-30 t/s | 8K tokens | IoT, Raspberry Pi |
| **SmolVLM-256M** | 0.25B | <1GB | <1GB VRAM | 30-50 t/s | 2K tokens | Vision+language, edge |

---

### 1. Qwen2.5-0.5B (Alibaba)

**Status:** RECOMMENDED - Best for ultra-constrained devices

| Attribute | Value |
|-----------|-------|
| **Parameters** | 490M (0.49B) |
| **Architecture** | Transformer with Grouped Query Attention (GQA) |
| **Download Size** | 1-2GB |
| **VRAM Needed** | 2GB (BF16); 1GB quantized (INT4/INT8) |
| **CPU RAM** | 4GB minimum (8GB recommended) |
| **Inference Speed** | 9 tokens/sec (Ryzen 5 5600X, CPU) |
| **Context Window** | 32,768 tokens |
| **Languages** | 29+ languages (multilingual) |
| **Quantization** | INT8, INT4 supported |
| **Ollama Support** | Yes |
| **Integration** | Hugging Face Transformers, vLLM, Text Generation WebUI |

**Strengths:**
- Smallest model in comparison (fits any device)
- Surprisingly capable for size
- Excellent quantization support
- Multilingual out-of-box

**Weaknesses:**
- Slowest inference speed
- Limited reasoning capability
- CPU-only reasonable only on fast systems

**Best For:** IoT devices, embedded systems, offline mobile apps, extreme resource constraints

---

### 2. Phi-3:mini (Microsoft)

**Status:** STRONGLY RECOMMENDED - Best overall balance

| Attribute | Value |
|-----------|-------|
| **Parameters** | 3.8B |
| **Architecture** | Dense transformer, lightweight design |
| **Download Size** | ~7GB |
| **VRAM Needed** | 4GB minimum, 8GB optimal |
| **CPU RAM** | 8GB+ recommended |
| **Inference Speed** | 20-40 tokens/sec |
| **Context Window** | 4K base, 128K extended (phi3:3.8b) |
| **Capabilities** | Reasoning, math, code generation |
| **Quantization** | Widely available (GGUF) |
| **Ollama Support** | Yes (phi3:mini) |
| **Benchmark** | Top performer in <4B category |

**Strengths:**
- Best reasoning for size
- Good inference speed
- Excellent quantization availability
- Strong math/code capabilities
- Extended context variant available

**Weaknesses:**
- Larger than Qwen2.5, TinyLlama
- Requires decent CPU or GPU

**Best For:** Desktop applications, reasoning tasks, code completion, math problems

---

### 3. Llama3.2:1B (Meta)

**Status:** RECOMMENDED - Good all-around option

| Attribute | Value |
|-----------|-------|
| **Parameters** | 1.0B |
| **Architecture** | Standard transformer, lightweight |
| **Download Size** | ~2GB |
| **VRAM Needed** | 2GB VRAM |
| **CPU RAM** | 4GB+ |
| **Inference Speed** | 15-20 tokens/sec |
| **Context Window** | 8,192 tokens |
| **Languages** | English, German, French, Italian, Portuguese, Hindi, Spanish, Thai |
| **Capabilities** | Chat, retrieval, summarization |
| **Quantization** | Full support |
| **Ollama Support** | Yes (llama3.2:1b) |
| **Official Models** | Always-on pricing via Replicate/Together |

**Strengths:**
- Meta's brand trust
- Good performance at 1B scale
- Multilingual support
- Small footprint
- Official model support

**Weaknesses:**
- Slower than Phi-3
- Smaller context than Phi-3
- No code specialization

**Best For:** Lightweight production deployments, multilingual chat, summarization

---

### 4. TinyLlama

**Status:** RECOMMENDED - Fastest small model

| Attribute | Value |
|-----------|-------|
| **Parameters** | 1.1B |
| **Architecture** | Optimized transformer |
| **Training Data** | 3 trillion tokens |
| **Download Size** | ~2GB |
| **VRAM Needed** | 2GB |
| **CPU RAM** | 4GB+ |
| **Inference Speed** | 15-25 tokens/sec (very fast) |
| **Context Window** | 4K tokens |
| **Quantization** | Full support |
| **Ollama Support** | Yes (tinyllama) |

**Strengths:**
- Extremely fast inference
- Compact size
- Good quality for size
- Optimized training

**Weaknesses:**
- Smaller context than Llama3.2
- Less established than Meta's Llama

**Best For:** Real-time applications, resource-constrained servers, speed-critical tasks

---

### 5. SmolLM2-360M (Hugging Face)

**Status:** RECOMMENDED - Smallest viable option

| Attribute | Value |
|-----------|-------|
| **Parameters** | 360M (0.36B) |
| **Variants** | 360M, 1.7B also available |
| **Memory Footprint** | 723.56MB model weights |
| **VRAM Needed** | <1GB (can run on Raspberry Pi 4) |
| **CPU RAM** | 4GB (Raspberry Pi 4), 6GB+ preferred |
| **Target Devices** | Smartphones (iPhone 15), IoT, embedded |
| **Inference Speed** | 20-30 tokens/sec |
| **Context Window** | 8K tokens |
| **Quantization** | GGUF format available |
| **Deployment** | WebGPU (browser), local CPU/GPU |
| **Ollama Support** | Community supported |

**Strengths:**
- Smallest model available
- Runs on consumer devices
- WebGPU browser inference
- Good for edge deployment

**Weaknesses:**
- Very basic capabilities
- Slowest processing
- Limited context

**Best For:** Browser-based AI, Raspberry Pi projects, extreme edge cases

---

### 6. SmolVLM-256M (Hugging Face Vision-Language)

**Status:** RECOMMENDED FOR VISION - Only small vision model

| Attribute | Value |
|-----------|-------|
| **Parameters** | 256M (vision + language) |
| **Modalities** | Image + Text input, Text output |
| **VRAM Needed** | <1GB GPU RAM for single image |
| **File Size** | Very small (<1GB) |
| **Use Case** | Image understanding on edge devices |
| **Frameworks** | Hugging Face Transformers, PyTorch, TensorFlow |
| **Inference Speed** | Real-time on consumer hardware |

**Strengths:**
- Only small vision-language model available
- Extreme resource efficiency
- Multi-image support
- Good image understanding

**Weaknesses:**
- Narrower capability scope
- Less established than text-only models

**Best For:** Edge vision applications, image classification, on-device visual understanding

---

## Part 3: Local Deployment Options

### Ollama Framework

**Installation:** Ultra-simple one-command install
```bash
curl -fsSL https://ollama.ai/install.sh | sh
# Or download from https://ollama.ai/download
```

**Quick Start:**
```bash
ollama run phi3:mini          # 3.8B model, best all-around
ollama run llama3.2:1b        # 1B lightweight option
ollama run tinyllama          # Speed-optimized 1.1B
ollama run qwen2.5:0.5b       # Ultra-compact option
```

**Features:**
- Automatic quantization selection
- Built-in web interface (localhost:11434)
- OpenAI-compatible API
- GPU detection (NVIDIA, Metal, ROCm)
- Model sharing via ollama.com/library

**Strengths:**
- Easiest local deployment
- No configuration needed
- Auto GPU optimization
- Active community

---

### Llamafile Framework (Mozilla)

**Installation:** Download single executable from HuggingFace

**Usage:**
```bash
# Download llamafile (e.g., Llama-3.2-1B-Instruct-llamafile)
chmod +x Llama-3.2-1B-Instruct-llamafile
./Llama-3.2-1B-Instruct-llamafile  # Starts HTTP server

# Then curl localhost:8080 for API
curl http://localhost:8080/completion -d '{"prompt":"Hello"}'
```

**Key Features:**
- Single-file executable (no installation)
- Cross-platform: Linux, macOS, Windows, FreeBSD
- Cross-architecture: AMD64 and ARM64
- Quantized models built-in
- Web UI included

**Benchmarks:**
- LLaVA: 55 tokens/sec (M2 Mac)
- Q6_K quantization: Best quality/speed balance
- Ultra-portable for offline/USB deployment

**Strengths:**
- Zero installation friction
- USB-portable AI
- Cosmopolitan Libc "fat binary"
- Perfect for demos

**Weaknesses:**
- Larger file sizes than quantized models
- No real-time model switching

---

## Part 4: Integration Complexity Assessment

### API Integration Complexity

#### Easy (OpenAI-Compatible)
**Groq, Together.ai, Cerebras, Fireworks.ai**

Direct drop-in replacement:
```python
from openai import OpenAI

# Works with ANY OpenAI-compatible endpoint
client = OpenAI(api_key="your_key", base_url="https://api.groq.com/openai/v1")
response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[{"role": "user", "content": "Hello"}]
)
```

**Complexity Score:** 1/10 (trivial)

---

#### Moderate (Custom Endpoints)
**Hugging Face Inference API, Replicate**

Requires custom wrappers or API calls:
```python
# Hugging Face Inference API
import requests

headers = {"Authorization": f"Bearer {HF_TOKEN}"}
response = requests.post(
    "https://api-inference.huggingface.co/models/meta-llama/Llama-2-7b-chat",
    headers=headers,
    json={"inputs": "Hello"}
)
```

**Complexity Score:** 5/10 (moderate wrapper needed)

---

#### Simple (Local)
**Ollama, Llamafile**

Local API servers via HTTP:
```python
import requests

# Ollama API (compatible with OpenAI format)
response = requests.post(
    "http://localhost:11434/api/generate",
    json={"model": "phi3:mini", "prompt": "Hello"}
)

# Or use OpenAI client (OpenAI-compatible mode)
from openai import OpenAI
client = OpenAI(api_key="ollama", base_url="http://localhost:11434/v1")
```

**Complexity Score:** 2/10 (local HTTP server)

---

## Part 5: Multi-Provider Fallback Strategy

### Recommended Architecture

```
User Request
    ↓
[LiteLLM Router]
    ↓
Primary:   Groq API (fastest, 280-1200 t/s)
Fallback1: Cerebras (1M tokens/day free)
Fallback2: Together.ai ($25 credits + 11B Vision free)
Fallback3: Local Ollama (Phi-3:mini or Llama3.2:1B)
Fallback4: Human timeout/error handler
```

### Implementation Options

#### Option 1: LiteLLM (Recommended)

**Why LiteLLM:**
- Supports 100+ LLM APIs
- Built-in retry/fallback logic
- OpenAI-compatible routing
- 8ms P95 latency
- Cost tracking per request

**Install:**
```bash
pip install litellm
```

**Configuration:**
```python
from litellm import Router

model_list = [
    {
        "model_name": "gpt-3.5",
        "litellm_params": {
            "model": "groq/llama-3.3-70b-versatile",
            "api_key": "groq_key",
            "api_base": "https://api.groq.com/openai/v1"
        }
    },
    {
        "model_name": "gpt-3.5",
        "litellm_params": {
            "model": "together_ai/meta-llama/Llama-3.3-70B-Instruct-Turbo",
            "api_key": "together_key"
        }
    },
    {
        "model_name": "gpt-3.5",
        "litellm_params": {
            "model": "cerebras/llama-3.1-70b",
            "api_key": "cerebras_key"
        }
    }
]

router = Router(model_list=model_list)

# Automatic failover if Groq fails
response = router.completion(
    model="gpt-3.5",
    messages=[{"role": "user", "content": "Hello"}],
    timeout=10
)
```

**Strengths:**
- Unified interface
- Automatic fallback
- Cost tracking
- Observability
- Battle-tested

---

#### Option 2: LLMSwap

**Why LLMSwap:**
- Simpler than LiteLLM
- Focused on provider switching
- 50-90% cost savings via caching
- 8 providers supported

**Install:**
```bash
pip install llmswap
```

**Usage:**
```python
from llmswap import LLMSwap

client = LLMSwap(
    providers={
        "groq": {"api_key": "..."},
        "together": {"api_key": "..."},
        "cerebras": {"api_key": "..."}
    }
)

# Auto-switches on failure
response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[{"role": "user", "content": "Hello"}]
)
```

**Strengths:**
- Simpler API
- Built-in caching
- Good for cost optimization

---

#### Option 3: Local Fallback Layer

**When to use local:**
- API provider down
- Rate limits exceeded
- Cost control
- Privacy requirements
- Offline functionality

**Implementation:**
```python
import json
from openai import OpenAI, APIConnectionError, RateLimitError

def get_ai_response(prompt, model="llama-3.3-70b"):
    providers = [
        # Primary: Groq (fastest)
        {
            "name": "groq",
            "client": OpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1"),
            "model": "llama-3.3-70b-versatile"
        },
        # Fallback 1: Cerebras
        {
            "name": "cerebras",
            "client": OpenAI(api_key=cerebras_key, base_url="https://api.cerebras.ai/v1"),
            "model": "llama-3.1-70b"
        },
        # Fallback 2: Local Ollama
        {
            "name": "local",
            "client": OpenAI(api_key="ollama", base_url="http://localhost:11434/v1"),
            "model": "phi3:mini"
        }
    ]

    for provider in providers:
        try:
            response = provider["client"].chat.completions.create(
                model=provider["model"],
                messages=[{"role": "user", "content": prompt}],
                timeout=10
            )
            return {
                "content": response.choices[0].message.content,
                "provider": provider["name"]
            }
        except (APIConnectionError, RateLimitError) as e:
            print(f"{provider['name']} failed, trying next...")
            continue

    raise Exception("All providers exhausted")

# Usage
result = get_ai_response("What is intent mail?")
print(f"Response: {result['content']}")
print(f"Provider used: {result['provider']}")
```

---

### Best Practices

**1. Health Checks**
```python
# Periodically health-check providers
import asyncio

async def check_provider_health(provider_name, test_prompt="hi"):
    # Quick test to see if provider is responsive
    try:
        response = await call_provider(provider_name, test_prompt, timeout=5)
        return True
    except:
        return False

# Run every 5 minutes
asyncio.run(check_provider_health("groq"))
```

**2. Rate Limit Awareness**
```python
# Track usage per provider
usage_tracker = {
    "groq": {"requests": 0, "daily_limit": 14400},
    "together": {"requests": 0, "hourly_limit": 36},
    "cerebras": {"tokens": 0, "daily_limit": 1000000}
}
```

**3. Cost Optimization**
```python
# Use cheapest free tier first
cost_ranking = {
    "cerebras": {"free_tokens": 1000000, "cost": 0},
    "together": {"free_credits": 25, "cost": 0.01},  # per request
    "groq": {"free_requests": 14400, "cost": 0.05},  # estimated
    "ollama_local": {"cost": 0}  # no cloud cost
}
```

**4. Error Handling**
```python
from retry import retry

@retry(tries=3, delay=1, exponential=2)  # exponential backoff
def call_api_with_retry(provider, prompt):
    return provider.call(prompt)
```

---

## Part 6: Intent-Mail Integration Recommendations

### Recommended Setup for intent-mail

**Tier 1 (Production):**
- Primary: Groq API (fastest, free tier)
- Backup: Cerebras (1M tokens/day free, SOC2 certified)
- Queue depth: 100 pending requests

**Tier 2 (Cost Control):**
- Use Together.ai for experimentation
- Leverage $25 free credits for R&D
- Use Llama 3.2 11B Vision for multimodal needs

**Tier 3 (Offline/Privacy):**
- Phi-3:mini via Ollama (always available, instant)
- SmolLM2-360M for ultra-lightweight edge
- Llamafile for portable deployment

**Tier 4 (Extreme Constraints):**
- Qwen2.5:0.5B for embedded systems
- SmolVLM-256M for vision + language on edge

---

### Implementation Path

**Phase 1 (MVP):**
1. Set up Groq API (1 line of code, OpenAI-compatible)
2. Minimal fallback to local Ollama (phi3:mini)
3. Simple try/except wrapper

**Phase 2 (Production):**
1. Integrate LiteLLM Router
2. Add Cerebras as secondary free tier
3. Implement health checks
4. Add cost tracking

**Phase 3 (Resilience):**
1. Multiple local model options
2. Rate limit management
3. Observability/logging
4. A/B testing different providers

---

## Sources & References

- [Groq API Documentation](https://console.groq.com/docs/models)
- [Groq Rate Limits](https://console.groq.com/docs/rate-limits)
- [Together.ai Models](https://www.together.ai/models)
- [Together.ai Pricing](https://www.together.ai/pricing)
- [Cerebras Inference API](https://inference-docs.cerebras.ai/introduction)
- [Cerebras Blog - API Launch](https://www.cerebras.ai/blog/introducing-cerebras-inference-ai-at-instant-speed)
- [Hugging Face Pricing](https://huggingface.co/pricing)
- [Hugging Face Hub Rate Limits](https://huggingface.co/docs/hub/en/rate-limits)
- [Fireworks.ai Pricing](https://fireworks.ai/pricing)
- [Replicate Pricing](https://replicate.com/pricing)
- [Qwen2.5-0.5B Specifications](https://www.hardware-corner.net/llm-database/Qwen/)
- [Ollama Library](https://ollama.com/library)
- [Llamafile GitHub](https://github.com/mozilla-ai/llamafile)
- [SmolLM3 Documentation](https://huggingface.co/blog/smollm3)
- [LiteLLM Documentation](https://docs.litellm.ai/)
- [LLMSwap GitHub](https://github.com/sreenathmmenon/llmswap)
- [Multi-Provider Fallback Strategy - Medium](https://medium.com/@tombastaner/beyond-model-fallbacks-building-provider-level-resilience-for-ai-systems-e1d00f3b016d)
