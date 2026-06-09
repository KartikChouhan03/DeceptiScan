# DeceptiScan

DeceptiScan is an AI-powered browser extension designed to detect fake, AI-generated, and manipulative product reviews on e-commerce platforms. The system combines browser-side review extraction, machine learning, transformer-based NLP models, and explainable AI techniques to provide users with a trust score and detailed review authenticity analysis.

## Features

* Product review scraping from Amazon product pages
* Automatic extraction of:

  * Product title
  * Product rating
  * Total review count
  * User reviews
* Fake review detection using NLP and Transformer models
* Trust Score generation
* Suspicious pattern identification
* Explainable AI insights
* Browser extension interface for real-time analysis
* Backend inference API for model serving

## Current Progress

### Browser Extension

* Amazon product detection
* Product metadata extraction
* Review extraction pipeline
* Chrome storage integration
* Interactive popup dashboard
* Trust score visualization

### Data Pipeline

* Collected and merged multiple fake review datasets
* Dataset size: 72,877 labeled reviews
* Duplicate removal
* Data cleaning and preprocessing
* Train-test split generation

### Exploratory Data Analysis

* Class distribution analysis
* Review length analysis
* Correlation analysis
* Word frequency visualization
* Statistical feature extraction

## Dataset Statistics

| Metric           | Value  |
| ---------------- | ------ |
| Total Reviews    | 72,877 |
| Fake Reviews     | 42,306 |
| Genuine Reviews  | 30,571 |
| Training Samples | 57,325 |
| Testing Samples  | 14,332 |

## Tech Stack

### Frontend

* TypeScript
* React
* Plasmo
* Lucide React

### Backend

* Python
* FastAPI

### Machine Learning

* Scikit-Learn
* XGBoost (Baseline)
* DeBERTa-v3 (Primary Model)
* Transformers
* PyTorch

### Data Science

* Pandas
* NumPy
* Matplotlib
* Seaborn

## Planned Architecture

Amazon Product Page
↓
Review Scraper
↓
FastAPI Backend
↓
DeBERTa-v3 Review Classifier
↓
Trust Score Engine
↓
Explainable AI Module
↓
Browser Extension Dashboard

## Future Work

* Fine-tuned DeBERTa-v3 model
* Reviewer behavior analysis
* Sentiment and emotion analysis
* Review similarity detection
* LLM-powered explanation engine
* Multi-platform support (Amazon, Flipkart, Walmart)
* Research paper publication
* RAG-powered review intelligence system

## Status

🚧 Active Development

Current Milestone:
Dataset Engineering & Pre-Training Pipeline Completed

Next Milestone:
DeBERTa-v3 Fine-Tuning and Model Evaluation

---

## Getting Started

Follow these steps to set up and run DeceptiScan locally.

### 1. Repository Setup
Clone the repository:
```bash
git clone https://github.com/your-username/DeceptiScan.git
cd DeceptiScan
```

### 2. Extension Setup (Frontend)
Make sure you have [Node.js](https://nodejs.org/) installed.
1. Navigate to the extension directory:
   ```bash
   cd extension
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the Plasmo development server:
   ```bash
   npm run dev
   ```
4. Load the extension in Chrome:
   - Go to `chrome://extensions/`
   - Turn on **Developer mode** (top-right toggle).
   - Click **Load unpacked** (top-left button).
   - Select the directory: `Deceptiscan/extension/build/chrome-mv3-dev` (or production build).

### 3. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd extension/backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Place your trained model folder `deberta-v3-detector` in `extension/backend/models/`. (Ensure it contains `model.safetensors`, `config.json`, etc.)
5. Run the server:
   ```bash
   python app/main.py
   ```
   The backend API will run at `http://localhost:8000`.

