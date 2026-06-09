from pydantic import BaseModel
from typing import List

class AnalyzeRequest(BaseModel):
    reviews: List[str]
