"""
benchmark_latency.py - Reproducible Inference Latency Benchmark for DeceptiScan

This script:
1. Loads the fine-tuned DeBERTa-v3 sequence classification model.
2. Evaluates real-world inference latency across batch sizes (1, 4, 8, 16, 32).
3. Computes mean, median (p50), 95th percentile (p95), and per-review latency.
4. Saves reproducible latency benchmark figures to latency_benchmark.json.
"""

import os
import json
import time
import torch
import numpy as np
from transformers import AutoTokenizer, AutoModelForSequenceClassification


def run_latency_benchmark(model_dir: str, output_path: str):
    print("=" * 65)
    print(" DECEPTISCAN INFERENCE LATENCY BENCHMARK")
    print("=" * 65)

    if not os.path.exists(model_dir):
        raise FileNotFoundError(f"Model directory not found at: {model_dir}")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    device_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
    print(f"Device: {device.upper()} ({device_name})")
    print(f"Loading model and tokenizer from: {model_dir}...")

    t0_load = time.time()
    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(model_dir, weights_only=False).to(device)
    model.eval()
    print(f"Model loaded in {time.time() - t0_load:.2f}s")

    sample_reviews = [
        "This product works amazing! It exceeded all my expectations, fast shipping and great quality.",
        "Terrible product. Broke within 24 hours of arrival. Refused refund from seller.",
        "Average build quality. It is okay for daily light use, but not premium.",
        "Five stars! Best purchase this month. Love the ergonomics and clean finish.",
        "Misleading description. The size is way smaller than advertised in the listing photos.",
        "Good value for money. Does what it says on the box without complications.",
        "Super fast delivery and neatly packaged. Would recommend to friends.",
        "Stopped working after a week. Completely disappointed with customer support."
    ] * 4  # 32 reviews

    # Warm-up pass
    print("\nWarming up PyTorch execution engine...")
    warmup_batch = sample_reviews[:4]
    warmup_inputs = tokenizer(warmup_batch, padding=True, truncation=True, max_length=128, return_tensors="pt").to(device)
    with torch.no_grad():
        for _ in range(5):
            _ = model(**warmup_inputs)

    batch_sizes = [1, 4, 8, 16, 32]
    num_runs = 25
    benchmark_results = {}

    print("\nBENCHMARK RUNS (25 iterations per batch size):")
    print(f"{'Batch Size':<12} | {'Total Batch (ms)':<18} | {'Per-Review (ms)':<17} | {'P95 Latency (ms)':<16}")
    print("-" * 72)

    for bsz in batch_sizes:
        batch_texts = sample_reviews[:bsz]
        inputs = tokenizer(batch_texts, padding=True, truncation=True, max_length=128, return_tensors="pt").to(device)

        times_ms = []
        with torch.no_grad():
            for _ in range(num_runs):
                if device == "cuda":
                    torch.cuda.synchronize()
                t0 = time.perf_counter()
                _ = model(**inputs)
                if device == "cuda":
                    torch.cuda.synchronize()
                t1 = time.perf_counter()
                times_ms.append((t1 - t0) * 1000.0)

        mean_batch_ms = float(np.mean(times_ms))
        median_batch_ms = float(np.median(times_ms))
        p95_batch_ms = float(np.percentile(times_ms, 95))
        per_review_ms = float(mean_batch_ms / bsz)

        benchmark_results[f"batch_{bsz}"] = {
            "batch_size": bsz,
            "mean_batch_latency_ms": round(mean_batch_ms, 2),
            "median_batch_latency_ms": round(median_batch_ms, 2),
            "p95_batch_latency_ms": round(p95_batch_ms, 2),
            "per_review_latency_ms": round(per_review_ms, 2)
        }

        print(f"{bsz:<12} | {mean_batch_ms:>15.2f} ms | {per_review_ms:>14.2f} ms | {p95_batch_ms:>13.2f} ms")

    print("=" * 72)

    summary = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "hardware": {
            "device": device,
            "gpu_name": device_name,
            "cuda_available": torch.cuda.is_available()
        },
        "model": "DeBERTa-v3-base fine-tuned sequence classifier",
        "iterations_per_batch": num_runs,
        "batch_benchmarks": benchmark_results,
        "key_takeaways": {
            "single_sample_latency_ms": benchmark_results["batch_1"]["mean_batch_latency_ms"],
            "batch_8_per_review_ms": benchmark_results["batch_8"]["per_review_latency_ms"],
            "batch_32_per_review_ms": benchmark_results["batch_32"]["per_review_latency_ms"]
        }
    }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print(f"\nSaved latency benchmark results to: {output_path}")


if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    model_dir = os.path.abspath(os.path.join(current_dir, "..", "models", "deberta-v3-detector"))
    output_path = os.path.join(current_dir, "latency_benchmark.json")

    run_latency_benchmark(model_dir, output_path)
