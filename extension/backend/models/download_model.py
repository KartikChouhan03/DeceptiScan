"""
download_model.py - DeceptiScan Model Weights Management Script

Since fine-tuned transformer weights (model.safetensors ~738 MB) exceed GitHub's
100 MB single-file limit, this utility verifies local presence and provides
automated download support from external hosting (Hugging Face Hub / Release Mirrors).
"""

import os
import sys
import argparse

MODEL_SUBDIR = "deberta-v3-detector"
EXPECTED_FILES = [
    "config.json",
    "model.safetensors",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "spm.model"
]


def check_and_download(dest_dir: str = None, repo_id: str = None):
    current_dir = os.path.dirname(os.path.abspath(__file__))
    target_dir = dest_dir or os.path.join(current_dir, MODEL_SUBDIR)
    os.makedirs(target_dir, exist_ok=True)

    print("=" * 65)
    print(" DECEPTISCAN MODEL WEIGHTS VERIFIER & DOWNLOADER")
    print("=" * 65)
    print(f"Target Model Directory: {target_dir}")

    # Check existing files
    missing_files = []
    for fname in EXPECTED_FILES:
        fpath = os.path.join(target_dir, fname)
        if os.path.exists(fpath):
            size_mb = os.path.getsize(fpath) / (1024 * 1024)
            print(f"  [OK] {fname:<25} ({size_mb:.2f} MB)")
        else:
            print(f"  [MISSING] {fname}")
            missing_files.append(fname)

    if not missing_files:
        print("\nAll model weights and tokenizer assets are present and ready!")
        print("FastAPI backend inference can be started without issues.")
        return True

    print(f"\nWarning: {len(missing_files)} required model file(s) are missing.")

    # Attempt download via huggingface_hub if repo_id provided
    default_repo = repo_id or "kartikchouhan03/deceptiscan-deberta-v3"
    print(f"\nAttempting download from Hugging Face Hub repository: '{default_repo}'...")

    try:
        from huggingface_hub import snapshot_download
        snapshot_download(
            repo_id=default_repo,
            local_dir=target_dir,
            local_dir_use_symlinks=False
        )
        print("Model downloaded successfully!")
        return True
    except Exception as exc:
        print(f"\nCould not automatically pull from Hugging Face Hub ({exc}).")
        print("\n" + "=" * 65)
        print(" MANUAL INSTALLATION INSTRUCTIONS:")
        print("=" * 65)
        print("1. Download the fine-tuned model archive from:")
        print("   - Hugging Face: https://huggingface.co/kartikchouhan03/deceptiscan-deberta-v3")
        print("   - Or Cloud Storage / Google Drive mirror link specified by the author.")
        print(f"2. Extract the model files directly into:")
        print(f"   {target_dir}")
        print("3. Ensure 'model.safetensors' (~738 MB) is placed inside that directory.")
        print("4. Re-run this script to verify: python download_model.py")
        print("=" * 65)
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Check and download DeceptiScan DeBERTa-v3 model weights.")
    parser.add_argument("--repo_id", type=str, default=None, help="Hugging Face repository ID")
    parser.add_argument("--dest_dir", type=str, default=None, help="Local directory destination")
    args = parser.parse_args()

    success = check_and_download(dest_dir=args.dest_dir, repo_id=args.repo_id)
    sys.exit(0 if success else 1)
