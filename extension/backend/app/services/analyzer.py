import os
import torch
import numpy as np
from transformers import AutoTokenizer, AutoModelForSequenceClassification

class DebertaDetector:
    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Resolve path relative to this file's location
        # This file is at: backend/app/services/analyzer.py
        current_file_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.dirname(os.path.dirname(current_file_dir))
        self.model_dir = os.path.join(backend_dir, "models", "deberta-v3-detector")
        
        if not os.path.exists(self.model_dir):
            raise FileNotFoundError(
                f"DeBERTa model directory not found at: {self.model_dir}.\n"
                "Please run 'python extension/backend/models/download_model.py' to download or verify weights."
            )
            
        print(f"Loading DeBERTa-v3 tokenizer and model from: {self.model_dir} on device: {self.device}")
        
        # Load the tokenizer and sequence classification model
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_dir)
        self.model = AutoModelForSequenceClassification.from_pretrained(self.model_dir, weights_only=False)
        self.model.to(self.device)
        self.model.eval()
        print("Model and tokenizer loaded successfully.")

    def predict(self, texts: list[str], batch_size: int = 16) -> list[dict]:
        results = []
        if not texts:
            return results
            
        # Run inference in true batches to leverage multi-core/GPU parallelization
        with torch.no_grad():
            for i in range(0, len(texts), batch_size):
                batch_texts = texts[i : i + batch_size]
                inputs = self.tokenizer(
                    batch_texts,
                    padding=True,
                    truncation=True,
                    max_length=128,
                    return_tensors="pt"
                ).to(self.device)
                
                outputs = self.model(**inputs)
                probs = torch.softmax(outputs.logits, dim=-1).cpu().numpy()
                pred_classes = np.argmax(probs, axis=1)
                
                for idx, pred_class in enumerate(pred_classes):
                    conf = float(probs[idx][pred_class])
                    results.append({
                        "is_fake": int(pred_class) == 1,
                        "confidence": conf,
                        "genuine_prob": float(probs[idx][0]),
                        "fake_prob": float(probs[idx][1])
                    })
        return results
