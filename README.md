# 🚀 CRAG: Corrective Retrieval-Augmented Generation Pipeline

![CRAG Hero](./assets/hero.png)

## 📌 Overview

**CRAG** is a high-performance **Corrective Retrieval-Augmented Generation** system designed to provide accurate, reliable, and verifiable answers to complex queries. By leveraging a state-of-the-art **LangGraph** orchestration, CRAG ensures that information is not only retrieved but also evaluated for relevance and correctness in real-time.

When local retrieval falls short, the pipeline autonomously performs web searches to augment the knowledge base, ensuring the final answer is always grounded in the best available data.

---

## ✨ Key Features

- 🧠 **Dynamic Evaluation**: Every retrieved chunk is scored for relevance. Incorrect or ambiguous retrievals trigger an automated web-search fallback.
- 🔍 **Multi-Source Ingestion**: Ingest knowledge from PDFs, live web pages, and YouTube video transcripts.
- 🏗️ **LangGraph Orchestration**: A robust state-machine architecture that manages complex branching logic (Retrieve → Evaluate → Rewrite → Search → Refine → Generate).
- ⚡ **Lightning Fast Inference**: Powered by **Groq** and the **Llama 3.3 70B** model.
- 🎨 **Modern Interactive UI**: A React-based interface featuring a live graph visualizer to track the AI's "thought process" step-by-step.

---

## 🏗️ Technical Workflow & Architecture

The CRAG system is architected to handle diverse data sources with a robust ingestion-to-inference pipeline.

### 📥 Ingestion & Storage Pipeline (Internal)
The ingestion layer transforms unstructured data into structured knowledge using a multi-stage process:

1.  **Extraction**: PDF (Docling/PyMuPDF), Web (Crawl4AI), Audio (Whisper), YouTube (Transcripts).
2.  **Transformation**: Recursive Character Text Splitting for context-aware chunking.
3.  **Vectorization**: Sentence Transformers generating 768-dim embeddings.
4.  **Indexing**: High-performance upserts into a persistent **Qdrant** collection.

### 🔄 Retrieval & Reasoning (CRAG Logic)
![Internal Workflow](./assets/internal_workflow.png)


![Workflow](./assets/mermaid-drawing.svg)

![Workflow2](./assets/agent_nodes.svg)

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | FastAPI, Python 3.10+ |
| **Orchestration** | LangGraph, LangChain |
| **LLM Inference** | Groq (Llama 3.3 70B Versatile) |
| **Vector DB** | Qdrant (Local Persistent Store) |
| **Search API** | Tavily Search |
| **Frontend** | React, Vite, Tailwind CSS |
| **Ingestion** | PyMuPDF4LLM, Docling, BeautifulSoup4 |

---

## 🚀 Getting Started

### 1️⃣ Backend Setup
```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate # or .venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn main:app --reload
```

### 2️⃣ Frontend Setup
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

---

## 🔮 Future Improvements

- [ ] **Dynamic Thresholding**: Implement RL-based threshold adjustment for the document evaluator.
- [ ] **Agentic Tools**: Allow the pipeline to use specialized tools (e.g., Code Executor, Calculator) during the `Refine` phase.
- [ ] **User Sessions**: Add persistent database storage for user chat history and uploaded document collections.
- [ ] **Hybrid Search**: Integrate BM25 (keyword-based) search along with semantic vector search for improved retrieval.
- [ ] **WebSocket Streaming**: Real-time token streaming for faster perceived response times in the UI.

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">Made with ❤️ for the GenAI Community</p>
