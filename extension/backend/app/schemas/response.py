from pydantic import BaseModel
from typing import List

class ReviewDetail(BaseModel):
    text: str
    is_fake: bool
    confidence: float
    genuine_prob: float
    fake_prob: float

class AnalyzeResponse(BaseModel):
    score: int
    risk: str
    fake_count: int
    total_reviews: int
    details: List[ReviewDetail]
