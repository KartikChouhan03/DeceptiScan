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
            raise FileNotFoundError(f"DeBERTa model directory not found at: {self.model_dir}")
            
        print(f"Loading DeBERTa-v3 tokenizer and model from: {self.model_dir} on device: {self.device}")
        
        # Load the tokenizer and sequence classification model
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_dir)
        self.model = AutoModelForSequenceClassification.from_pretrained(self.model_dir, weights_only=False)
        self.model.to(self.device)
        self.model.eval()
        print("Model and tokenizer loaded successfully.")

    def predict(self, texts: list[str]) -> list[dict]:
        results = []
        if not texts:
            return results
            
        # Run inference in evaluation mode without tracking gradients
        with torch.no_grad():
            for text in texts:
                inputs = self.tokenizer(
                    text,
                    padding=True,
                    truncation=True,
                    max_length=128,
                    return_tensors="pt"
                ).to(self.device)
                
                outputs = self.model(**inputs)
                probs = torch.softmax(outputs.logits, dim=-1).cpu().numpy()[0]
                pred_class = int(np.argmax(probs))
                confidence = float(probs[pred_class])
                
                results.append({
                    "is_fake": pred_class == 1,
                    "confidence": confidence,
                    "genuine_prob": float(probs[0]),
                    "fake_prob": float(probs[1])
                })
        return results
