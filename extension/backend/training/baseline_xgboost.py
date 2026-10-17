"""
baseline_xgboost.py - Reproducible Classical ML Baseline for DeceptiScan

This script:
1. Loads preprocessed train.csv (57,325 rows) and test.csv (14,332 rows).
2. Extracts TF-IDF n-gram features (unigrams + bigrams, sublinear TF scaling).
3. Fits an XGBoost gradient-boosted decision tree classifier.
4. Evaluates accuracy, precision, recall, F1-score, and confusion matrix on the test set.
5. Saves reproducible benchmark metrics to xgboost_baseline_metrics.json.
6. Prints a side-by-side comparison against the fine-tuned DeBERTa-v3 model.
"""

import os
import json
import time
import argparse
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    classification_report,
    confusion_matrix
)


def run_xgboost_baseline(dataset_dir: str, output_metrics_path: str):
    print("=" * 65)
    print(" DECEPTISCAN BASELINE BENCHMARK: TF-IDF + XGBOOST")
    print("=" * 65)

    train_path = os.path.join(dataset_dir, "train.csv")
    test_path = os.path.join(dataset_dir, "test.csv")

    if not os.path.exists(train_path) or not os.path.exists(test_path):
        raise FileNotFoundError(f"Datasets not found in {dataset_dir}")

    print(f"Loading training data from: {train_path}")
    train_df = pd.read_csv(train_path).dropna(subset=["text", "label"])
    train_df["text"] = train_df["text"].astype(str)
    train_df["label"] = train_df["label"].astype(int)

    print(f"Loading testing data from:  {test_path}")
    test_df = pd.read_csv(test_path).dropna(subset=["text", "label"])
    test_df["text"] = test_df["text"].astype(str)
    test_df["label"] = test_df["label"].astype(int)

    print(f"Training samples: {len(train_df):,} | Testing samples: {len(test_df):,}")

    print("\nExtracting TF-IDF features (max_features=5,000, unigrams+bigrams)...")
    tfidf = TfidfVectorizer(
        max_features=5000,
        ngram_range=(1, 2),
        stop_words="english",
        sublinear_tf=True
    )
    t0_feat = time.time()
    X_train = tfidf.fit_transform(train_df["text"])
    y_train = train_df["label"]
    X_test = tfidf.transform(test_df["text"])
    y_test = test_df["label"]
    print(f"Feature extraction completed in {time.time() - t0_feat:.2f}s")

    print("\nFitting XGBoost Classifier (n_estimators=100, max_depth=6, lr=0.1)...")
    clf = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        n_jobs=-1,
        random_state=42,
        eval_metric="logloss"
    )
    t0_train = time.time()
    clf.fit(X_train, y_train)
    training_duration = time.time() - t0_train
    print(f"Model training completed in {training_duration:.2f}s")

    print("\nEvaluating on 14,332 test samples...")
    t0_eval = time.time()
    y_pred = clf.predict(X_test)
    y_proba = clf.predict_proba(X_test)[:, 1]
    eval_duration = time.time() - t0_eval

    acc = float(accuracy_score(y_test, y_pred))
    prec, rec, f1, _ = precision_recall_fscore_support(y_test, y_pred, average="binary")
    cm = confusion_matrix(y_test, y_pred).tolist()

    print("\n" + "=" * 65)
    print(" CLASSIFICATION REPORT (XGBoost Baseline)")
    print("=" * 65)
    print(classification_report(y_test, y_pred, target_names=["Genuine (0)", "Fake (1)"], digits=4))

    print("CONFUSION MATRIX:")
    print(f"  True Negatives  (Genuine correctly identified): {cm[0][0]:,}")
    print(f"  False Positives (Genuine misclassified as Fake): {cm[0][1]:,}")
    print(f"  False Negatives (Fake misclassified as Genuine): {cm[1][0]:,}")
    print(f"  True Positives  (Fake correctly identified):    {cm[1][1]:,}")
    print("-" * 65)

    # Comparison with DeBERTa-v3
    deberta_metrics = {
        "accuracy": 0.86736,
        "f1": 0.89218,
        "precision": 0.85350,
        "recall": 0.93453,
    }

    acc_delta = (deberta_metrics['accuracy'] - acc) * 100
    f1_delta = (deberta_metrics['f1'] - f1) * 100
    prec_delta = (deberta_metrics['precision'] - prec) * 100
    rec_delta = (deberta_metrics['recall'] - rec) * 100

    print("\nMODEL PERFORMANCE COMPARISON:")
    print(f"{'Metric':<15} | {'XGBoost Baseline':<18} | {'DeBERTa-v3 (Fine-Tuned)':<25} | {'Delta':<10}")
    print("-" * 75)
    print(f"{'Accuracy':<15} | {acc*100:>16.2f}% | {deberta_metrics['accuracy']*100:>23.2f}% | {acc_delta:>+8.2f}%")
    print(f"{'F1 Score':<15} | {f1*100:>16.2f}% | {deberta_metrics['f1']*100:>23.2f}% | {f1_delta:>+8.2f}%")
    print(f"{'Precision':<15} | {prec*100:>16.2f}% | {deberta_metrics['precision']*100:>23.2f}% | {prec_delta:>+8.2f}%")
    print(f"{'Recall':<15} | {rec*100:>16.2f}% | {deberta_metrics['recall']*100:>23.2f}% | {rec_delta:>+8.2f}%")
    print("=" * 75)

    results = {
        "model_name": "TF-IDF + XGBoost Baseline",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "training_samples": len(train_df),
        "test_samples": len(test_df),
        "training_time_seconds": round(training_duration, 2),
        "evaluation_time_seconds": round(eval_duration, 4),
        "metrics": {
            "accuracy": round(acc, 5),
            "f1": round(float(f1), 5),
            "precision": round(float(prec), 5),
            "recall": round(float(rec), 5),
        },
        "confusion_matrix": {
            "true_negative": cm[0][0],
            "false_positive": cm[0][1],
            "false_negative": cm[1][0],
            "true_positive": cm[1][1],
        },
        "comparison_with_deberta_v3": {
            "deberta_accuracy": deberta_metrics["accuracy"],
            "deberta_f1": deberta_metrics["f1"],
            "accuracy_improvement": round(deberta_metrics["accuracy"] - acc, 5),
            "f1_improvement": round(deberta_metrics["f1"] - f1, 5)
        }
    }

    os.makedirs(os.path.dirname(output_metrics_path), exist_ok=True)
    with open(output_metrics_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"\nSaved XGBoost baseline metrics to: {output_metrics_path}")


if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_dir = os.path.abspath(os.path.join(current_dir, "..", "dataset"))
    output_path = os.path.join(current_dir, "xgboost_baseline_metrics.json")

    run_xgboost_baseline(dataset_dir, output_path)
