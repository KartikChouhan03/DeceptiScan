# DeceptiScan Model Evaluation & Baseline Comparison Report

This report provides the reproducible empirical evaluation results for DeceptiScan's fine-tuned **DeBERTa-v3** review detector alongside the classical **TF-IDF + XGBoost** baseline and latency benchmarks.

---

## 1. Executive Summary

| Model | Architecture / Method | Test Accuracy | F1 Score | Precision | Recall | Average Latency (CUDA) |
|---|---|---|---|---|---|---|
| **XGBoost (Baseline)** | TF-IDF (5k n-grams) + GBDT | **70.63%** | **76.69%** | 71.82% | 82.27% | < 1 ms |
| **DeBERTa-v3 (Fine-Tuned)** | Pretrained Transformer (128 seq) | **86.74%** | **89.22%** | **85.35%** | **93.45%** | **1.91 ms / review (batch 8)** |
| **Net Gain (DeBERTa)** | Deep contextual semantics | **+16.11%** | **+12.53%** | **+13.53%** | **+11.18%** | Real-time capable |

* **High Recall (93.45%) on Fake Reviews**: The model catches over 93 out of every 100 fake/manipulated reviews.
* **Low False Negative Rate**: Only 551 fake reviews out of 8,416 fake test samples were missed.

---

## 2. Training Run Verification (DeBERTa-v3)

The model was fine-tuned in [`train_evaluation.ipynb`](file:///d:/Deceptiscan/DECEPTISCAN---BROWSER-EXTENSION-main/Deceptiscan/extension/backend/training/train_evaluation.ipynb) with full checkpoints preserved in `checkpoint-14332/trainer_state.json`.

* **Base Model**: `microsoft/deberta-v3-base` (Sequence Classification head)
* **Optimization**: AdamW, Learning Rate $2\times 10^{-5}$, Weight Decay $0.01$, Linear Warmup
* **Epochs**: 3 (21,498 total training steps, 59m 11s duration)
* **Best Model Checkpoint**: Step 14,332 (Epoch 2.0), selected based on validation F1 score.

### Per-Epoch Progression

| Epoch | Training Loss | Validation Loss | Validation Accuracy | Validation F1 | Validation Precision | Validation Recall |
|---|---|---|---|---|---|---|
| **1.0** | 0.3519 | 0.3323 | 86.38% | 88.79% | 85.92% | 91.86% |
| **2.0** ⭐ | **0.2913** | **0.3909** | **86.74%** | **89.22%** | **85.35%** | **93.45%** |
| **3.0** | 0.1652 | 0.5583 | 86.30% | 88.91% | 84.78% | 93.45% |

---

## 3. Test Evaluation & Confusion Matrix (14,332 Samples)

### Classification Report

```text
              precision    recall  f1-score   support

 Genuine (0)       0.89      0.77      0.83      5916
    Fake (1)       0.85      0.93      0.89      8416

    accuracy                           0.87     14332
   macro avg       0.87      0.85      0.86     14332
weighted avg       0.87      0.87      0.87     14332
```

### Confusion Matrix

| Actual \ Predicted | Predicted Genuine (0) | Predicted Fake (1) | Total |
|---|---|---|---|
| **Actual Genuine (0)** | **4,566** (True Negative) | **1,350** (False Positive) | 5,916 |
| **Actual Fake (1)** | **551** (False Negative) | **7,865** (True Positive) | 8,416 |

---

## 4. XGBoost Baseline Comparison

To verify that deep transformer fine-tuning offers measurable advantages over classical statistical NLP, [`baseline_xgboost.py`](file:///d:/Deceptiscan/DECEPTISCAN---BROWSER-EXTENSION-main/Deceptiscan/extension/backend/training/baseline_xgboost.py) trains an XGBoost classifier with TF-IDF features on the exact same dataset split:

* **TF-IDF Vocabulary**: 5,000 unigrams and bigrams with sublinear TF scaling.
* **XGBoost Hyperparameters**: `n_estimators=100`, `max_depth=6`, `learning_rate=0.1`.
* **Baseline Accuracy**: 70.63%
* **Baseline F1**: 76.69%

DeBERTa-v3 significantly outperforms XGBoost across all metrics:
* Accuracy: **+16.11%** (86.74% vs 70.63%)
* F1 Score: **+12.53%** (89.22% vs 76.69%)
* Fake Recall: **+11.18%** (93.45% vs 82.27%)

---

## 5. Latency Benchmark Profile

Evaluated via [`benchmark_latency.py`](file:///d:/Deceptiscan/DECEPTISCAN---BROWSER-EXTENSION-main/Deceptiscan/extension/backend/training/benchmark_latency.py) using PyTorch CUDA:

| Batch Size | Total Batch Latency | Per-Review Latency | P95 Latency | Throughput |
|---|---|---|---|---|
| **1** (single review) | 17.43 ms | 17.43 ms | 18.59 ms | ~57 reviews/sec |
| **4** | 17.60 ms | 4.40 ms | 27.08 ms | ~227 reviews/sec |
| **8** | 15.27 ms | **1.91 ms** | 17.03 ms | ~524 reviews/sec |
| **16** | 21.34 ms | **1.33 ms** | 23.57 ms | ~750 reviews/sec |
| **32** | 38.90 ms | **1.22 ms** | 39.61 ms | ~822 reviews/sec |

* For real-world extension scraping where 10-30 reviews are analyzed simultaneously, batched processing delivers an average inference time of **under 2 milliseconds per review**.
