# Vertex AI Code Execution Sandbox: Comparison Matrix & Capabilities

## Executive Summary

Vertex AI Agent Engine Code Execution (in preview) provides a managed, secure sandbox for AI agents to execute code without operational overhead. The sandbox maintains state across multiple executions for 14 days, supporting Python and JavaScript with configurable compute resources.

---

## 1. Code Execution Sandbox Overview

### Purpose
Enable AI agents to safely execute untrusted code while:
- Eliminating security risks
- Reducing operational complexity
- Maintaining persistent state across calls
- Supporting data-intensive workflows

### Managed Service Benefits
- No infrastructure provisioning
- Built-in isolation and sandboxing
- Automatic resource management
- Integrated with Vertex AI Agent Engine
- Works with any agent framework

---

## 2. Sandbox Capabilities Matrix

### 2.1 Core Features Comparison

| Feature | Details | Benefit |
|---------|---------|---------|
| **State Persistence** | 14 days configurable TTL | Build on previous executions |
| **File Persistence** | Maintains uploaded files | Reuse data across multiple runs |
| **Memory Isolation** | Complete process isolation | Security guarantee |
| **Language Support** | Python 3.x, JavaScript/Node.js | Broad developer access |
| **Compute Config** | 2 vCPU/1.5GB or 4 vCPU/4GB | Scalable resource allocation |
| **Output Capture** | stdout, stderr, generated files | Full execution visibility |
| **Execution Timeout** | Configurable per execution | Prevent runaway processes |

### 2.2 Runtime Options (Preview)

#### Python Runtime
```
Supported: Python 3.x
Package Manager: pip
Pre-installed: Common data science libraries (NumPy, Pandas, etc.)
```

#### JavaScript/Node.js Runtime
```
Supported: Node.js LTS
Package Manager: npm
Pre-installed: Common utilities
```

#### Machine Configurations

| Config | vCPU | RAM | Use Case |
|--------|------|-----|----------|
| **Default** | 2 | 1.5 GB | Standard computations, data analysis |
| **VCPU4_RAM4GIB** | 4 | 4 GB | Heavy processing, large datasets |

### 2.3 Limits & Constraints

| Limit | Value | Notes |
|-------|-------|-------|
| **File Size (Input)** | 100 MB | Per execution input |
| **Execution Time** | Configurable | Default varies by region |
| **State TTL** | 14 days | Configurable per sandbox |
| **Output Size** | Varies | stdout + stderr capped |
| **Disk Space** | Limited | Temporary files auto-cleaned |

---

## 3. State Management Architecture

### 3.1 Sandbox Lifecycle

```
Create Sandbox
    ↓
[State Retained for 14 Days (TTL)]
    ├→ Execute Code (Call 1)
    │   ├→ Variables persist
    │   ├→ Imported modules cached
    │   └→ File state maintained
    ├→ Execute Code (Call 2)
    │   ├→ Access to Call 1 variables
    │   ├→ Existing imports available
    │   └→ File state from previous
    └→ Execute Code (Call N)
    ↓
[TTL Expires - Sandbox Deleted]
```

### 3.2 State Persistence Details

#### Variables & Environment
```python
# First execution
def first_execution():
    global_var = 42
    data_frame = pd.read_csv("data.csv")

# Second execution (same sandbox)
def second_execution():
    # global_var and data_frame still available
    result = global_var + data_frame.sum()
    return result
```

#### Imported Modules
```python
# First execution
import numpy as np
import pandas as pd

# Second execution - no need to re-import
# np and pd are still in memory
array = np.array([1, 2, 3])  # Works directly
```

#### File State
```
Uploaded Files:
├── data.csv (persists)
├── model.pkl (persists)
└── config.json (persists)

Generated Files:
├── output.csv (persists across calls)
├── results.json (available in later calls)
└── temp_files (auto-cleaned if disk fills)
```

### 3.3 Time-to-Live (TTL) Configuration
```python
# Create sandbox with custom TTL
sandbox = code_execution.create_sandbox(
    machine_config="VCPU4_RAM4GIB",
    ttl_seconds=86400 * 7  # 7 days instead of default
)

# Sandbox auto-expires after TTL
# All state automatically cleaned up
```

---

## 4. Code Execution Workflow

### 4.1 Standard Execution Flow

```
Agent/Application
    ↓
1. Create Sandbox (or reuse existing)
2. Prepare code string
3. Include input files (optional)
4. Submit to Code Execution API
    ↓
Code Execution Service
    ├→ Validate request
    ├→ Route to Python/JS runtime
    ├→ Execute in isolated process
    ├→ Capture output (stdout, stderr)
    ├→ Collect generated files
    ├→ Save state to persistent storage
    └→ Return results
    ↓
Agent/Application
    ├→ Process results
    ├→ Make decision
    └→ (Optional) Execute again with new code
```

### 4.2 Multi-Step Data Analysis Example

```python
# Step 1: Data Loading
code_execution.execute({
    "sandbox_id": "sandbox-123",
    "code": """
import pandas as pd
df = pd.read_csv("sales_data.csv")
print(f"Loaded {len(df)} rows")
""",
    "files": ["/path/to/sales_data.csv"]
})

# Step 2: Data Analysis (df persists from Step 1)
code_execution.execute({
    "sandbox_id": "sandbox-123",
    "code": """
summary = df.groupby('category')['amount'].sum()
print(summary)
"""
})

# Step 3: Visualization (leverages df and previous analysis)
code_execution.execute({
    "sandbox_id": "sandbox-123",
    "code": """
import matplotlib.pyplot as plt
df.plot(kind='bar')
plt.savefig('analysis.png')
print('Chart saved')
"""
})
```

### 4.3 Agent Integration Pattern

```python
from vertexai.agentic import CodeExecution

code_exec = CodeExecution()

# Agent tool definition
@agent_tool
def execute_analysis(python_code: str, files: List[str] = None):
    """Execute Python code in sandbox"""
    response = code_exec.execute(
        code=python_code,
        files=files,
        sandbox_id=get_user_sandbox()  # Reuse per-user sandbox
    )
    return response.stdout

# Agent uses tool
agent_response = agent.run(
    "Analyze the sales data and create a visualization"
)
# Internally calls execute_analysis with agent-generated code
```

---

## 5. Security Architecture

### 5.1 Isolation Guarantees
```
Each Execution:
├→ Process Isolation
│   └─ Complete memory separation
├→ Network Isolation
│   └─ No external network access (default)
├→ Filesystem Isolation
│   └─ Sandbox directory only accessible
├→ Resource Limits
│   ├─ CPU quota enforcement
│   ├─ Memory limits
│   └─ Disk space quotas
└→ Timeout Enforcement
    └─ Runaway process termination
```

### 5.2 Security Best Practices

#### Input Validation
```python
# Always validate code before execution
def safe_execute(code: str, sandbox_id: str):
    # Check for dangerous patterns
    dangerous = ["import socket", "__import__", "eval"]
    if any(d in code for d in dangerous):
        return error("Dangerous operation detected")

    return code_exec.execute(code, sandbox_id)
```

#### Output Sanitization
```python
# Filter sensitive data from results
def sanitized_result(response):
    output = response.stdout
    # Remove API keys, tokens, etc.
    output = re.sub(r'(secret|token|key)=\S+', '[REDACTED]', output)
    return output
```

#### File Access Control
```python
# Limit file types allowed
allowed_extensions = ['.csv', '.json', '.pkl', '.txt']

def validate_upload(filename):
    ext = os.path.splitext(filename)[1]
    if ext not in allowed_extensions:
        raise ValueError(f"File type {ext} not allowed")
```

### 5.3 Data Security
- Uploaded files encrypted in transit (HTTPS)
- At-rest encryption available (Customer-Managed Encryption Keys)
- Data residency can be enforced (region-locked)
- No data used for model training
- Automatic cleanup on TTL expiration

---

## 6. Integration Patterns

### 6.1 As an Agent Tool
```python
# Pattern: Agent generates code, sandbox executes
class CodeInterpreterAgent(ADK):
    def __init__(self):
        self.code_exec = CodeExecution()
        self.sandbox = None

    async def process_request(self, user_request):
        if not self.sandbox:
            self.sandbox = self.code_exec.create_sandbox()

        # Agent generates code for user request
        generated_code = await self.llm.generate(
            f"Generate Python code to: {user_request}"
        )

        # Execute generated code
        result = self.code_exec.execute(
            code=generated_code,
            sandbox_id=self.sandbox.id
        )

        return result.stdout
```

### 6.2 Multi-Agent Data Processing
```python
# Pattern: Specialized agents using shared sandbox
coordinator = ADKOrchestrator()

# Agent 1: Data loader
data_loader = Agent("load_data")
data_loader.tool = code_exec_tool

# Agent 2: Analyzer
analyzer = Agent("analyze")
analyzer.tool = code_exec_tool  # Same sandbox

# Agent 3: Visualizer
visualizer = Agent("visualize")
visualizer.tool = code_exec_tool  # Same sandbox

# Workflow: Data → Analyze → Visualize (state persists)
result = coordinator.run_sequence([
    data_loader,
    analyzer,
    visualizer
])
```

### 6.3 Development-Time Testing
```python
# Pattern: Iterative code refinement
def iterative_solution(problem_description: str):
    sandbox = code_exec.create_sandbox()

    for attempt in range(1, 6):
        code = agent.generate_code(
            f"Attempt {attempt}: {problem_description}"
        )

        result = code_exec.execute(code, sandbox.id)

        if result.success and is_correct(result.output):
            return result

        # Feedback loop: show error to agent
        agent.feedback(result.stderr)

    raise Exception("Max attempts exceeded")
```

---

## 7. Regional Availability & Deployment

### 7.1 Regional Constraints
```
Code Execution Available:
├─ us-central1 (primary)
├─ Additional regions (expanding)
└─ Check current documentation for latest availability
```

### 7.2 Deployment Architecture
```
Your Application/Agent
    ↓
Vertex AI Client SDK
    ↓
Code Execution API (us-central1)
    ↓
Isolated Python/JS Runtime
    ├→ Execution Isolation
    ├→ File System
    ├→ Network (restricted)
    └→ State Storage (persistent)
```

---

## 8. Troubleshooting Guide

### 8.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| **Sandbox Creation Fails** | Missing IAM role | Add `roles/aiplatform.user` role |
| **File Not Found Error** | File not uploaded | Check file path in files array |
| **Module Import Error** | Library not installed | Install via pip in code |
| **Timeout Error** | Code takes too long | Optimize algorithm, increase resources |
| **Out of Memory** | Large data processing | Use VCPU4_RAM4GIB config |
| **Network Error** | Trying to access internet | Code Execution is air-gapped |

### 8.2 Debugging Checklist
```python
# Verify IAM permissions
gcloud auth list  # Confirm correct user/service account
gcloud projects get-iam-policy PROJECT_ID  # Check role assignment

# Test basic execution
response = code_exec.execute("print('Hello World')")
if response.success:
    print("Sandbox is working")
else:
    print("Error:", response.stderr)

# Check region availability
# Ensure code_exec client is configured for us-central1
```

---

## 9. Recommended Configuration for Intent Mail

### Sandbox Setup
```python
# Create per-user sandbox for email operations
code_exec = CodeExecution()

sandbox = code_exec.create_sandbox(
    machine_config="MACHINE_CONFIG_VCPU2_RAM1GIB",  # Standard for email
    ttl_seconds=604800  # 7 days retention
)
```

### Typical Workflow
```
1. User requests email action: "Send summary to team"
2. Agent generates Python code for email logic
3. Code Execution sandbox runs safely
4. Results returned for approval (if needed)
5. Action executed
6. Sandbox state maintained for next request
```

### Security Configuration
```python
# Restrict to email-safe operations
allowed_modules = [
    "email", "smtplib", "json", "datetime",
    "re", "base64", "urllib"
]

# Sandbox for Intent Mail
email_sandbox = code_exec.create_sandbox()

# Pass allowlist to execution
result = code_exec.execute(
    code=agent_generated_code,
    sandbox_id=email_sandbox.id,
    timeout_seconds=30  # Email ops should be fast
)
```

---

## 10. Comparison Matrix: Code Execution vs Alternatives

| Feature | Vertex AI Code Exec | Lambda | Cloud Functions | Custom Server |
|---------|---|---|---|---|
| **State Persistence** | 14 days | None (stateless) | None | Yes |
| **Setup Time** | Minimal | Minimal | Minimal | Days |
| **Language Support** | Python, JS | Many | Many | Any |
| **Security Isolation** | Managed | AWS IAM | GCP IAM | Custom |
| **Cost Model** | Usage-based | Usage-based | Usage-based | Fixed |
| **Scaling** | Automatic | Automatic | Automatic | Manual |
| **Agent Integration** | Native | API | API | API |

---

## Document Version
- **Version**: 1.0
- **Last Updated**: December 2025
- **Source**: Official Vertex AI Agent Engine documentation, Code Execution preview documentation
