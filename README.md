# Gemini-RI: Advanced Gemini CLI with Reusable Intelligence & Sub-Agent Orchestration

> **⚠️ Note:** This project is an independent fork of the original [Google Gemini CLI](https://github.com/google-gemini/gemini-cli). It is maintained by [Hassan Irshad](https://github.com/hassanirshad-1) and includes the "Reusable Intelligence" (RI) framework.

**Gemini-RI** extends the powerful Gemini CLI with **Reusable Intelligence**, enabling you to delegate complex tasks to specialized, isolated sub-agents. It keeps your main context clean while experts handle the details.

## 🚀 Key Differences

| Feature | Standard Gemini CLI | Gemini-RI (This Fork) |
| :--- | :--- | :--- |
| **Agent Model** | Single conversational agent | **Orchestrator + Sub-Agents** |
| **Context Management** | One shared history (overflow prone) | **Isolated Contexts per Agent** |
| **Skill Discovery** | N/A | **Tiered (Global `~/.gemini/skills` & Local `./.gemini/skills`)** |
| **Customization** | System Prompt | **Domain-Specific Experts (YAML/Markdown)** |
| **Delegation** | Manual | **Automatic Semantic Routing** |

## 📦 Installation

Since the package is currently in beta, the recommended way to install is directly from GitHub:

```bash
npm install -g git+https://github.com/hassanirshad-1/Gemini-cli-plus.git
```

Alternatively, you can run it instantly without installation:

```bash
npx github:hassanirshad-1/Gemini-cli-plus
```

## 🤖 Quick Start: Reusable Intelligence

### 1. Create a Sub-Agent
Create a folder named `.gemini/skills` in your project root or `~/.gemini/skills` globally.
Add a markdown file, e.g., `grader.md`:

```markdown
---
name: grader
description: Grades academic essays based on strict criteria.
---

You are a strict academic grader. 
Your goal is to evaluate the input text for grammar, clarity, and argumentation.
Output ONLY the final grade and a brief summary.
```

### 2. Run the Expert
Start the CLI:

```bash
geminiplus
```

```bash
gemini-ri
```

Then, you can either explicitly call the agent or let the orchestrator find it:

**Explicit Call:**
```text
/agents run grader "The quick brown fox jumps over the lazy dog."
```

**Natural Language Delegation:**
```text
> Please grade this essay: "The quick brown fox..."
```
*(Gemini-RI will automatically detect the "grader" skill and delegate the task)*

## 📚 Documentation

For standard Gemini CLI features (file operations, shell commands, etc.), please refer to the [original documentation](https://geminicli.com/docs/).

## 🤝 Contributing

We welcome contributions!
- Report bugs and suggest features on [GitHub](https://github.com/hassanirshad-1/Gemini-cli-plus).
- Submit pull requests to improve the RI framework.

## 📄 License

Apache License 2.0 - [Hassan Irshad](https://github.com/hassanirshad-1) & Google