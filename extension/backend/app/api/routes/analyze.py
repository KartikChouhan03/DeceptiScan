from fastapi import APIRouter, HTTPException
from app.schemas.review import AnalyzeRequest
from app.schemas.response import AnalyzeResponse, ReviewDetail
from app.services.analyzer import DebertaDetector

router = APIRouter()

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_reviews(request: AnalyzeRequest):
    try:
        # Load prediction model singleton
        detector = DebertaDetector.get_instance()
        predictions = detector.predict(request.reviews)
        
        # Calculate summary metrics
        fake_count = sum(1 for p in predictions if p["is_fake"])
        total = len(request.reviews)
        
        # Calculate trust score (percentage of genuine reviews)
        if total > 0:
            score = int(((total - fake_count) / total) * 100)
        else:
            score = 100
            
        # Determine aggregate risk levels
        risk = "Low Risk"
        if score < 80:
            risk = "Medium Risk"
        if score < 60:
            risk = "High Risk"
            
        # Compile response details mapping predictions to their respective text snippets
        details = [
            ReviewDetail(
                text=text[:150] + "..." if len(text) > 150 else text,
                is_fake=pred["is_fake"],
                confidence=pred["confidence"],
                genuine_prob=pred["genuine_prob"],
                fake_prob=pred["fake_prob"]
            )
            for text, pred in zip(request.reviews, predictions)
        ]
        
        return AnalyzeResponse(
            score=score,
            risk=risk,
            fake_count=fake_count,
            total_reviews=total,
            details=details
        )
    except Exception as e:
        print(f"Error in /analyze route: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
