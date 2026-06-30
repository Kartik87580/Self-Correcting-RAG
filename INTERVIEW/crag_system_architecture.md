# 🧠 CRAG: End-to-End System Architecture

This document provides a comprehensive, step-by-step visual and technical walkthrough of the **Corrective Retrieval-Augmented Generation (CRAG)** system. It is designed to be highly intuitive, clear, and ready to print, share, or use for presentations and interviews.

---

## 🗺️ 1. End-to-End System Block Diagram

This diagram visualizes how the different layers (Frontend, API/Backend, Ingestion Pipeline, Vector Database, and LangGraph Engine) interconnect.

```mermaid
graph TD
    %% Styling Definitions for Premium Theme (Light & Dark Compatible)
    classDef client fill:#1e1b4b,stroke:#818cf8,color:#f8fafc,stroke-width:2px;
    classDef backend fill:#0f172a,stroke:#38bdf8,color:#f8fafc,stroke-width:2px;
    classDef Ingest fill:#022c22,stroke:#34d399,color:#f8fafc,stroke-width:2px;
    classDef qdrant fill:#581c87,stroke:#c084fc,color:#f8fafc,stroke-width:2px;
    classDef router fill:#7c2d12,stroke:#f97316,color:#f8fafc,stroke-width:2px;
    classDef nodeStep fill:#1f2937,stroke:#9ca3af,color:#f8fafc,stroke-width:1px;
    classDef startEnd fill:#334155,stroke:#64748b,color:#f8fafc,stroke-width:1.5px;

    %% SUBGRAPH A: Offline Ingestion Pipeline (Data Preparation)
    subgraph INGESTION["📥 A. OFFLINE DOCUMENT INGESTION PIPELINE"]
        direction TB
        A1[\"1. Diverse Input Sources<br/>(PDFs, Web URLs, Audio, YouTube Video URLs)\" /]
        A2["2. Extraction Layer<br/>• PyMuPDF4LLM (Digital PDFs)<br/>• Docling OCR (Scanned PDFs)<br/>• Crawl4AI (Web URLs)<br/>• Groq Whisper (Audio)<br/>• YouTube Transcript API"]
        A3["3. Text Preprocessing<br/>• Strip HTML tags & whitespaces<br/>• Standardize structure to Markdown"]
        A4["4. Recursive Chunking<br/>• RecursiveCharacterTextSplitter<br/>• Size: 500 chars | Overlap: 75 chars"]
        A5["5. FastEmbed Vectorization<br/>• Model: bge-small-en-v1.5<br/>• Generates 384-d float vectors"]
        A6[("6. Qdrant Vector Store<br/>• Store UUID, 384-d vector<br/>• Payload: original text chunk")]

        A1 --> A2
        A2 --> A3
        A3 --> A4
        A4 --> A5
        A5 --> A6
    end

    %% SUBGRAPH B: User Interface & Backend Gateway
    subgraph GATEWAY["💻 B. USER INTERFACE & API GATEWAY"]
        direction LR
        B1["React (Vite) Frontend<br/>• Q&A Panel (Chat)<br/>• Document Upload Dashboard<br/>• D3.js Live LangGraph Visualizer"]
        B2["FastAPI Backend (main.py)<br/>• /ingest endpoint (Trigger Pipeline)<br/>• /query endpoint (Stream Graph State)<br/>• /graph endpoints (Fetch Node Detail)"]
        
        B1 <-->|HTTPS API / JSON Payloads| B2
    end

    %% SUBGRAPH C: LangGraph Stateful Corrective RAG Engine (Execution Loop)
    subgraph ENGINE["⚙️ C. LANGGRAPH CORRECTIVE RAG STATE MACHINE"]
        direction TB
        C_START(["Start Agent Loop"])
        C1["7. Retrieve Node<br/>• Generate query embedding (384-d)<br/>• Query Qdrant for top-3 chunks"]
        C2["8. Document Evaluator Node<br/>• LLM-as-a-Judge (Groq Llama 3.3)<br/>• Score each chunk in [0.0 - 1.0]"]
        C3{"9. Relevance Router<br/>(Check score thresholds)"}
        
        %% Correct Branch
        C4_CORRECT["10a. Correct Path<br/>• Use local good chunks<br/>• Skip web search fallback"]
        
        %% Ambiguous / Incorrect Branch
        C4_REWRITE["10b. Rewrite Node<br/>• LLM reformulates query<br/>• Optimize search keywords"]
        C5_WEB["11. Web Search Node<br/>• Tavily Search API Query<br/>• Retrieve clean web snippets"]
        
        C6_REFINE["12. Context Refine Node<br/>• Split context into sentences<br/>• LLM filters noise (Keep/Drop)"]
        C7_GEN["13. Grounded Generator Node<br/>• Groq LLM (Llama 3.3 70B)<br/>• Constraint: 'I don't know' fallback"]
        C_END(["End Agent Loop"])

        C_START --> C1
        C1 --> C2
        C2 --> C3
        
        %% Routing decisions
        C3 -->|Score > 0.7| C4_CORRECT
        C3 -->|Score < 0.3 (Incorrect)<br/>or 0.3 - 0.7 (Ambiguous)| C4_REWRITE
        
        C4_CORRECT --> C6_REFINE
        
        C4_REWRITE --> C5_WEB
        C5_WEB --> C6_REFINE
        
        C6_REFINE --> C7_GEN
        C7_GEN --> C_END
    end

    %% Cross-Subgraph Connections (Flow Interactions)
    B2 -->|Trigger Ingestion| A2
    B2 <==>|POST /query / Stream State| C_START
    A6 -.->|Query Match & Retrieve Chunks| C1
    C7_GEN -.->|Stream Final Answer| B2

    %% Style Classes Application
    class B1 client;
    class B2 backend;
    class A1,A2,A3,A4,A5 Ingest;
    class A6 qdrant;
    class C3 router;
    class C_START,C_END startEnd;
    class C1,C2,C4_CORRECT,C4_REWRITE,C5_WEB,C6_REFINE,C7_GEN nodeStep;
```

---

## 🔄 2. LangGraph Execution Flow & Decision Paths

This diagram provides a step-by-step representation of the state transformations and conditional paths executed by the LangGraph engine for a single query.

```mermaid
graph TD
    %% Define Nodes and Shapes
    Start([1. User Query Entered])
    
    subgraph RETRIEVAL["🔍 RETRIEVAL STAGE"]
        QdrantQuery[2. Semantic Retrieval<br/>• Encode query to 384-d vector<br/>• Query Qdrant for top-3 chunks]
    end
    
    subgraph EVALUATION["⚖️ EVALUATION & ROUTING STAGE"]
        LlmScore[3. LLM relevance evaluator<br/>• Evaluates each chunk in parallel<br/>• Assigns score 0.0 - 1.0]
        VerdictDecision{4. Classify Verdict}
    end
    
    subgraph CORRECTION["📡 CORRECTION PATH (Incorrect/Ambiguous)"]
        RewriteQuery[5. Query Reformulator<br/>• LLM creates search keyword list<br/>• Target word count: 6 to 14 words]
        WebSearch[6. Tavily Search Engine<br/>• Fetch web sources<br/>• Extract clean text snippet]
    end
    
    subgraph REFINEMENT["⚡ CONTEXT REFINEMENT STAGE"]
        SentenceSplit[7. Knowledge Decomposer<br/>• Splits text into sentences<br/>• Evaluates each via Keep/Drop LLM]
        RefinedContext[8. Distilled Context<br/>• Unrelated details dropped<br/>• Keeps only helpful lines]
    end
    
    subgraph GENERATION["🤖 GENERATION STAGE"]
        LLMGen[9. Grounded Prompt Generation<br/>• Tutor LLM receives refined context<br/>• Strict constraint: 'I don't know' fallback]
        Response([10. Final Answer Returned to UI])
    end

    %% State Transitions
    Start --> QdrantQuery
    QdrantQuery --> LlmScore
    LlmScore --> VerdictDecision
    
    %% Branching Paths
    VerdictDecision -->|Verdict = CORRECT<br/>At least 1 chunk > 0.7| SentenceSplit
    
    VerdictDecision -->|Verdict = AMBIGUOUS<br/>Weak match 0.3 - 0.7| RewriteQuery
    VerdictDecision -->|Verdict = INCORRECT<br/>All chunks < 0.3| RewriteQuery
    
    RewriteQuery --> WebSearch
    WebSearch --> SentenceSplit
    
    SentenceSplit --> RefinedContext
    RefinedContext --> LLMGen
    LLMGen --> Response

    %% Edge Labels/Aesthetics
    linkStyle 3 stroke:#10b981,stroke-width:3px;   %% Highlight Correct Path
    linkStyle 4 stroke:#f59e0b,stroke-width:2px;   %% Ambiguous Path
    linkStyle 5 stroke:#ef4444,stroke-width:2px;   %% Incorrect Path

    %% Styling classes
    classDef stepNode fill:#1e293b,stroke:#475569,color:#f3f4f6,stroke-width:1px;
    classDef decisionNode fill:#0284c7,stroke:#38bdf8,color:#f3f4f6,stroke-width:2px;
    classDef criticalNode fill:#b91c1c,stroke:#f87171,color:#f3f4f6,stroke-width:2px;
    classDef successNode fill:#047857,stroke:#34d399,color:#f3f4f6,stroke-width:2px;
    
    class QdrantQuery,RewriteQuery,WebSearch,SentenceSplit,RefinedContext stepNode;
    class LlmScore,LLMGen stepNode;
    class VerdictDecision decisionNode;
    class Start,Response successNode;
```

---

## 📋 3. Step-by-Step System Component Walkthrough

### 📥 Phase A: The Document Ingestion & Storage Pipeline (Offline)

1. **Extraction**: The system ingestion module receives documents of various types. It chooses specialized extractors to clean format boundaries:
   - **PDF (Digital)**: Extracted via `PyMuPDF4LLM` for speed and text integrity.
   - **PDF (Scanned/Image)**: Extracted via `Docling` which runs OCR on local hardware.
   - **Audio (mp3/wav/m4a)**: Transcribed asynchronously via Groq's high-speed Whisper-Large-v3 API.
   - **Webpage URLs**: Crawled dynamically via `Crawl4AI` inside a headless Playwright browser to bypass client-side JavaScript rendering issues.
   - **YouTube URLs**: Pulls subtitles directly via the `YouTubeTranscriptApi`.
2. **Standardization**: Extracted raw texts are formatted into clean Markdown syntax and metadata tags.
3. **Recursive Chunking**: Chunks are processed using LangChain's `RecursiveCharacterTextSplitter`. To match the token window and represent small, independent thoughts, the configuration is set to **`chunk_size=500`** with a **`chunk_overlap=75`** (to maintain cross-chunk semantic integrity).
4. **Vector Embedding**: Text chunks are passed through **`FastEmbed`** using the `sentence-transformers/all-MiniLM-L6-v2` model, yielding a lightweight, high-performance **384-dimensional vector** per chunk.
5. **Storage**: The vector embeddings and corresponding texts (payloads) are written to a persistent instance of **`Qdrant Vector Database`** under the default collection namespace.

---

### 🔄 Phase B: The Real-Time CRAG Query Graph (Online)

1. **Client Request**: The React dashboard makes a POST request to `/api/query` containing the user's question.
2. **Retrieve Node**: The system generates a 384-dimensional embedding of the query and queries `Qdrant` for the top 3 semantically closest chunks based on **Cosine Similarity**.
3. **Document Evaluator Node**: An LLM-as-a-Judge chain (`doc_eval_chain`) is run via Groq (Llama 3.3 70B). It checks the query against each chunk separately and returns a structured Pydantic response `DocEvalScore(score: float, reason: str)`.
4. **Router Edge**: The graph determines the execution path based on the highest document scores:
   - **`CORRECT`** (At least one document scored $> 0.7$): The local knowledge database is trusted. The system transitions directly to the `refine` node.
   - **`INCORRECT`** (All retrieved documents scored $< 0.3$): The local knowledge is ignored. The system transitions to `rewrite_query`.
   - **`AMBIGUOUS`** (The highest score is between $0.3$ and $0.7$): The database contains weak matches. The system combines both local knowledge and external search results. It transitions to `rewrite_query`.
5. **Query Rewrite Node**: If a search fallback is triggered, the question is rewritten into search-optimized keywords via an LLM. For instance, *"What is attention in transformers?"* is rewritten to *"attention mechanism transformer neural network explained"*.
6. **Web Search Node**: The system queries the **`Tavily Search API`** using the rewritten keywords to pull the most relevant web snippets.
7. **Refine Node**: All compiled sources (local chunks, web results, or both) are combined. The system decomposes the context into individual sentences and runs a rapid LLM judge (`filter_chain` utilizing a `KeepOrDrop` schema) to strip out navigation text, boilerplate, and irrelevant sentences.
8. **Generate Node**: The LLM (Llama 3.3 70B) receives the consolidated, refined context. It generates the final grounded answer. If the context is completely empty, it outputs *"I don't know."* to prevent hallucinations.
9. **API Response**: The state transitions and final answer are returned to the React frontend where they are visualized dynamically.
