# DeceptiScan 🛡️🔍

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENCE)
[![Platform](https://img.shields.io/badge/platform-Chrome%20|%20Edge%20|%20Brave-lightgrey.svg)](#)
[![Tech Stack](https://img.shields.io/badge/tech--stack-FastAPI%20|%20React%20|%20Plasmo-blueviolet.svg)](#)
[![Model](https://img.shields.io/badge/NLP-DeBERTa--v3--Detector-orange.svg)](#)

**DeceptiScan** is a premium, AI-powered browser extension and machine learning platform designed to detect fake, AI-generated, and manipulative product reviews on e-commerce sites in real-time. By bridging a **React + Plasmo** extension frontend with a **FastAPI + PyTorch (DeBERTa-v3)** inference backend, DeceptiScan calculates an actionable Trust Score, details review patterns, and provides explainable AI insights for safer shopping.

---

## 🌟 Key Features

### 💻 Premium Dashboard
*   **Intuitive UI**: A sleek dark/light theme-adaptive pop-up window built with glassmorphism design principles.
*   **Trust Score Gauge**: Visualizes seller/product reliability using an animated circular gauge.
*   **Tabbed Analytics**:
    *   **Overview**: Summary of scraped reviews, product metadata, and final sentiment rating.
    *   **Reviews**: Labeled feed of reviews (marked as *Genuine*, *Suspicious*, or *Highly Fake*) with prediction confidence percentages.
    *   **Signals**: Breakdowns of warning triggers (such as review count discrepancies or abnormal distributions).
    *   **Settings**: Adjustable connection settings (e.g., configuring local/remote server endpoints).

### 🕷️ Smart Scraper (Anti-Bot & Dynamic)
*   **Deep Scrape**: Asynchronously crawls up to 5 paginated pages of reviews directly from Amazon product listings.
*   **Anti-Detection Jitter**: Employs randomized delay intervals (700ms - 1500ms) and cookie-integrated fetch requests to query pages without triggering CAPTCHAs or IP blocks.
*   **DOM Parsing**: Parses raw HTML dynamically without relying on brittle selector dependencies, collecting reviewer details, ratings, titles, and body texts.

### 🧠 Fine-Tuned NLP Classification Backend
*   **Primary Classifier**: Houses a fine-tuned DeBERTa-v3 sequence classification transformer model optimized on over 72,000 labeled review datasets.
*   **Multi-Core & GPU Acceleration**: Automatically routes inference tasks to PyTorch CUDA cores for lightning-fast inference (< 200ms per batch).
*   **Explainable Trust Score**: Weighs classification confidence alongside rating distributions and suspicious reviewer behaviors to output a single, comprehensive percentage.

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph Browser Extension [Frontend & Scraper]
        A[Amazon Product Page] -->|Injects| B(amazon.ts Content Script)
        B -->|Background Scrape| C{DOM Parser & Fetcher}
        C -->|Reviews JSON| D[popup.tsx Dashboard]
        D -->|CORS HTTP POST /analyze| E[FastAPI Gateway]
    end

    subgraph Backend Server [Inference API]
        E -->|Processes Request| F[Analyzer Service]
        F -->|Batch Inputs| G[DeBERTa-v3 Transformer Model]
        G -->|Predictions & Confidences| H[Trust Score Engine]
        H -->|Generates Report| F
        F -->|JSON Response| D
    end
```

---

## 📂 Project Structure

```ascii
Deceptiscan/
├── .github/                       # GitHub actions pipelines
│   └── workflow/                  # CI/CD test automation for backend and extension
├── LICENCE                        # MIT License
├── README.MD                      # Project Documentation
├── github_upload_guide.md         # Upload & Repository Management Guide
└── extension/                     # Chrome Extension Workspace
    ├── assets/                    # Static image resources and extension icon
    ├── contents/                  # Content scripts (Amazon scraper injection)
    ├── lib/                       # Utility scripts & API request handlers
    ├── popup.tsx                  # Main dashboard React popup UI code
    ├── tsconfig.json              # TypeScript compilation setup
    └── backend/                   # FastAPI NLP Inference API
        ├── app/                   
        │   ├── main.py            # FastAPI Entry Point (Uvicorn Gateway)
        │   ├── api/routes/        # Endpoint routes (Analyze, Health, Reviews)
        │   ├── core/              # Global configurations & constants
        │   ├── schemas/           # Pydantic Request & Response models
        │   └── services/          # Inference orchestration & Trust Score calculations
        ├── training/              # Training scripts and evaluation Jupyter Notebooks
        ├── requirements.txt       # Python Dependencies list
        └── s.DockerFile           # Backend container build instructions
```

---

## 🚀 Getting Started

Follow these instructions to install, build, and run the complete DeceptiScan suite locally.

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18 or higher recommended)
*   [Python 3.10+](https://www.python.org/)
*   Google Chrome (or any Chromium-based browser)

---

### Step 1: Install & Launch the Extension (Frontend)

1.  Navigate into the extension directory:
    ```bash
    cd extension
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the Plasmo developer development server:
    ```bash
    npm run dev
    ```
4.  Open Google Chrome and go to `chrome://extensions/`.
5.  Enable **Developer mode** using the toggle switch in the top-right corner.
6.  Click **Load unpacked** in the top-left and select the directory:
    `Deceptiscan/extension/build/chrome-mv3-dev`
7.  The DeceptiScan icon will now appear in your extension toolbar!

---

### Step 2: Set Up & Launch the Inference Server (Backend)

1.  Navigate to the backend directory:
    ```bash
    cd extension/backend
    ```
2.  Create and activate a virtual environment:
    ```bash
    python -m venv .venv

    # On Windows (PowerShell/CMD)
    .venv\Scripts\activate

    # On macOS/Linux
    source .venv/bin/activate
    ```
3.  Install the backend Python dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  **Download and Place Model Weights**:
    Since model weights (~738 MB) exceed GitHub's 100 MB single-file upload limit, use the automated downloader or place the weights manually:
    ```bash
    python models/download_model.py
    ```
    *(This verifies that `model.safetensors`, `config.json`, `tokenizer.json`, etc., are present in `extension/backend/models/deberta-v3-detector/`)*.
5.  Start the FastAPI Server:
    ```bash
    python app/main.py
    ```
    The server will startup at `http://localhost:8000`. You can test it by visiting the Swagger Docs at `http://localhost:8000/docs`.

---

## 📊 Dataset & Model Details

For detailed data provenance, licensing, and filtration math, see the [Dataset Documentation](extension/backend/dataset/README.md).

### Data Sources & Labeling
*   **Kaggle Fake Reviews Corpus (Salminen et al., 2022)**: 40,432 labeled reviews (`CG` = Computer-Generated fake mapped to `1`, `OR` = Original genuine mapped to `0`).
*   **Cleaned Public Amazon Reviews Corpus**: 32,467 real-world reviews labeled via heuristic flags (`fake_review_product`, `reviewer_classified_fake`, `review_is_removed_by_amazon`).
*   **Raw Merged Corpus**: 72,877 labeled samples.

### Dataset Cleaning & Split Accounting (1,220 Record Resolution)
During text normalization (lowercasing, regex punctuation removal, whitespace collapse), **1,220 noisy records were filtered out**:
*   14 empty / whitespace-only entries.
*   220 post-normalization duplicates.
*   986 extreme short-noise reviews (< 4 words).
*   **Cleaned Modeling Corpus**: **71,657 reviews** ($72,877 - 1,220 = 71,657$).
*   **Training Split (80% Stratified)**: **57,325 reviews** (`train.csv`)
*   **Testing Split (20% Stratified)**: **14,332 reviews** (`test.csv`)
*   *Reproduce with:* `python training/prepare_dataset.py`

### Verified Performance Benchmarks
For complete classification reports and confusion matrices, see the [Evaluation Report](extension/backend/training/EVALUATION_REPORT.md).

| Metric | TF-IDF + XGBoost Baseline | Fine-Tuned DeBERTa-v3 | Net Gain |
|---|---|---|---|
| **Test Accuracy** | 70.63% | **86.74%** | **+16.11%** |
| **Test F1 Score** | 76.69% | **89.22%** | **+12.53%** |
| **Precision (Fake)** | 71.82% | **85.35%** | **+13.53%** |
| **Recall (Fake)** | 82.27% | **93.45%** | **+11.18%** |
| **Inference Latency** | < 1 ms | **1.91 ms / review (batch 8)** | Real-Time Capable |

*   **Training Log Evidence**: Checkpoint metrics and full step-by-step logs are preserved in `extension/backend/training/results/checkpoint-14332/trainer_state.json` and `training_metrics.json`.
*   **Baseline Reproducibility**: `python training/baseline_xgboost.py`
*   **Latency Benchmark**: `python training/benchmark_latency.py`

---

## 🛡️ License

Distributed under the MIT License. See [LICENCE](LICENCE) for details.
