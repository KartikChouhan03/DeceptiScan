export interface AnalysisResult {
  score: number
  risk: string
  signals: string[]
}

export default function analyzeReviews(
  reviews: string[],
  rating: string,
  reviewCount: string
): AnalysisResult {
  let score = 100

  const signals: string[] = []

  // Few reviews scraped
  if (reviews.length < 5) {
    score -= 10

    signals.push(
      "Very few reviews available"
    )
  }

  // Duplicate reviews
  const uniqueReviews = new Set(
    reviews.map((r) =>
      r.toLowerCase().trim()
    )
  )

  if (
    uniqueReviews.size <
    reviews.length
  ) {
    score -= 20

    signals.push(
      "Duplicate review content detected"
    )
  }

  // Low effort reviews
  const shortReviews =
    reviews.filter(
      (review) =>
        review.split(" ").length < 8
    )

  if (
    shortReviews.length >
    reviews.length * 0.4
  ) {
    score -= 15

    signals.push(
      "Low effort review patterns"
    )
  }

  // Suspiciously high rating
  const numericRating =
    parseFloat(rating)

  if (
    !isNaN(numericRating) &&
    numericRating >= 4.8 &&
    reviews.length > 5
  ) {
    score -= 5

    signals.push(
      "Extremely positive sentiment"
    )
  }

  // Review count analysis
  const reviewCountNumber =
    parseInt(
      reviewCount.replace(
        /[^0-9]/g,
        ""
      )
    )

  if (
    !isNaN(reviewCountNumber) &&
    reviewCountNumber > 10000
  ) {
    signals.push(
      "Large review volume detected"
    )
  }

  // Length similarity detection
  const lengths = reviews.map(
    (review) =>
      review.split(" ").length
  )

  if (lengths.length > 3) {
    const avgLength =
      lengths.reduce(
        (a, b) => a + b,
        0
      ) / lengths.length

    const similarLengths =
      lengths.filter(
        (len) =>
          Math.abs(
            len - avgLength
          ) < 5
      )

    if (
      similarLengths.length >
      reviews.length * 0.8
    ) {
      score -= 10

      signals.push(
        "Highly uniform review lengths"
      )
    }
  }

  // Marketing language detection
  const marketingWords = [
    "amazing",
    "perfect",
    "best ever",
    "must buy",
    "life changing",
    "highly recommend",
    "excellent product"
  ]

  let marketingHits = 0

  reviews.forEach((review) => {
    const lower =
      review.toLowerCase()

    marketingWords.forEach(
      (word) => {
        if (
          lower.includes(word)
        ) {
          marketingHits++
        }
      }
    )
  })

  if (
    marketingHits >
    reviews.length
  ) {
    score -= 10

    signals.push(
      "Promotional language patterns"
    )
  }

  // Excessive punctuation
  const exclamationReviews =
    reviews.filter(
      (review) =>
        (review.match(/!/g) || [])
          .length > 3
    )

  if (
    exclamationReviews.length >
    reviews.length * 0.3
  ) {
    score -= 5

    signals.push(
      "Excessive emotional language"
    )
  }

  // ALL CAPS detection
  const capsReviews =
    reviews.filter((review) => {
      const words =
        review.split(" ")

      const capsWords =
        words.filter(
          (word) =>
            word.length > 3 &&
            word ===
              word.toUpperCase()
        )

      return (
        capsWords.length > 3
      )
    })

  if (
    capsReviews.length >
    reviews.length * 0.3
  ) {
    score -= 5

    signals.push(
      "Aggressive promotional wording"
    )
  }

  score = Math.max(
    0,
    Math.min(100, score)
  )

  let risk = "Low Risk"

  if (score < 80) {
    risk = "Medium Risk"
  }

  if (score < 60) {
    risk = "High Risk"
  }

  if (signals.length === 0) {
    signals.push(
      "No suspicious patterns detected"
    )
  }

  return {
    score,
    risk,
    signals
  }
}