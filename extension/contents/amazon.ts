import type { PlasmoCSConfig } from "plasmo"
import analyzeReviews from "~lib/reviewAnalyzer"

export const config: PlasmoCSConfig = {
  matches: [
    "https://www.amazon.com/*",
    "https://www.amazon.in/*",
    "https://www.amazon.co.uk/*",
    "https://www.amazon.ca/*",
    "https://www.myntra.com/*"
  ]
}

console.log("[DeceptiScan] Amazon content script loaded on:", window.location.href)

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function getASIN(url: string): string | null {
  // 1. Direct hidden input on Amazon product pages
  const inputAsin = (document.querySelector('input#ASIN, input[name="ASIN"]') as HTMLInputElement)?.value
  if (inputAsin && inputAsin.trim().length === 10) {
    return inputAsin.trim()
  }

  // 2. data-asin attribute on main container
  const dataAsin = document.querySelector('[data-asin]')?.getAttribute('data-asin')
  if (dataAsin && dataAsin.trim().length === 10) {
    return dataAsin.trim()
  }

  // 3. Regex URL extraction specifically matching standard Amazon ASIN patterns
  const match = url.match(/(?:dp|gp\/product|product-reviews|asin)\/([A-Z0-9]{10})/i) ||
                url.match(/\/([A-Z0-9]{10})(?:[/?]|$)/i)
  return match ? match[1] : null
}

function extractAllOnPageReviews(): string[] {
  const reviewsSet = new Set<string>()

  // Selector group A: Structured review blocks
  const reviewCards = document.querySelectorAll(
    '[data-hook="review"], div[id^="customer_review-"], .celwidget[id^="customer_review"]'
  )

  reviewCards.forEach((card) => {
    const bodyEl = card.querySelector(
      '[data-hook="review-body"] span:not(.cr-original-review-content), [data-hook="review-body"], .review-text-content span, .review-text-content, [data-hook="review-collapsed"]'
    )
    const text = bodyEl?.textContent?.trim()
    if (text && text.length > 15 && !text.startsWith("The media could not be loaded") && !text.includes("helpful votes")) {
      reviewsSet.add(text)
    }
  })

  // Selector group B: Direct review-body selectors across the DOM
  if (reviewsSet.size < 5) {
    const directBodies = document.querySelectorAll(
      '[data-hook="review-body"] span, [data-hook="review-body"], div.review-text-content, [data-hook="review-collapsed"]'
    )
    directBodies.forEach((node) => {
      const text = node.textContent?.trim()
      if (text && text.length > 15 && !text.startsWith("The media could not be loaded") && !text.includes("helpful votes")) {
        reviewsSet.add(text)
      }
    })
  }

  return Array.from(reviewsSet)
}

async function fetchFromReviewsPage(existingReviews: string[]): Promise<string[]> {
  const allReviews = [...existingReviews]
  const asin = getASIN(window.location.href)
  if (!asin) return allReviews

  // Check if page has a valid "See all reviews" link containing the true URL with proper product slug
  const seeAllLink = document.querySelector(
    'a[data-hook="see-all-reviews-link-foot"], a#dp-summary-see-all-reviews, a.a-link-emphasis[href*="product-reviews"], a[href*="/product-reviews/"]'
  ) as HTMLAnchorElement | null

  let baseUrl = ""
  if (seeAllLink && seeAllLink.href) {
    baseUrl = seeAllLink.href.split("?")[0]
  } else {
    baseUrl = `${window.location.origin}/product-reviews/${asin}`
  }

  try {
    for (let page = 1; page <= 3; page++) {
      const pageUrl = `${baseUrl}?reviewerType=all_reviews&sortBy=recent&pageNumber=${page}`
      console.log(`[DeceptiScan] Fetching reviews from: ${pageUrl}`)

      const response = await fetch(pageUrl, {
        headers: { "Accept": "text/html" }
      })

      if (!response.ok) {
        console.log(`[DeceptiScan] Reviews page ${page} returned status ${response.status}. Stopping fetch.`)
        break
      }

      const html = await response.text()
      if (html.includes("robot check") || html.includes("api-services-support@amazon.com")) {
        console.log("[DeceptiScan] Amazon bot verification detected on background fetch.")
        break
      }

      const doc = new DOMParser().parseFromString(html, "text/html")
      const nodes = doc.querySelectorAll('[data-hook="review-body"] span, [data-hook="review-body"]')
      const pageReviews: string[] = []

      nodes.forEach((node) => {
        const text = node.textContent?.trim()
        if (text && text.length > 15 && !text.startsWith("The media could not be loaded")) {
          pageReviews.push(text)
        }
      })

      if (pageReviews.length === 0) break

      pageReviews.forEach((r) => {
        if (!allReviews.includes(r)) allReviews.push(r)
      })

      if (page < 3) await delay(800 + Math.random() * 500)
    }
  } catch (err) {
    console.warn("[DeceptiScan] Background fetch encountered network block, using on-page reviews:", err)
  }

  return allReviews
}

function saveToStorage(
  productName: string,
  rating: string,
  reviewCount: string,
  reviews: string[]
) {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      currentProduct: productName,
      currentSite: "Amazon",
      rating,
      reviewCount,
      reviews
    }, () => {
      console.log(`[DeceptiScan] Saved product metadata and ${reviews.length} reviews to storage.`)
    })
  }
}

function cleanTitle(raw: string): string {
  if (!raw) return ""
  let clean = raw.trim()
  // Clean "Amazon.<domain>: Customer reviews: <title>" or "Amazon.<domain> : Customer reviews: <title>"
  clean = clean.replace(/^Amazon\.[a-z.]+\s*[-:|]\s*Customer reviews\s*[-:|]\s*/i, "")
  clean = clean.replace(/^Customer reviews\s*[-:|]\s*/i, "")
  clean = clean.replace(/^Amazon\.[a-z.]+\s*[-:|]\s*/i, "")
  clean = clean.replace(/\s*[-:|]\s*Amazon\.[a-z.]+$/i, "")
  clean = clean.replace(/\s*[-:|]\s*Online Shopping.*$/i, "")
  return clean.trim()
}

function isAmazonProductOrReviewsPage(): boolean {
  const pathname = window.location.pathname.toLowerCase()
  const href = window.location.href.toLowerCase()
  const isUrl =
    pathname.includes("/dp/") ||
    pathname.includes("/gp/product/") ||
    pathname.includes("/product-reviews") ||
    pathname.includes("/customer-reviews") ||
    pathname.includes("/review") ||
    pathname.includes("/reviews") ||
    href.includes("reviewertype=") ||
    Boolean(getASIN(window.location.href))

  const hasReviewElements = Boolean(
    document.querySelector(
      '[data-hook="review"], [data-hook="review-body"], #cm_cr-review_list, #customerReviews, #reviewsMedley, #reviews-medley-footer'
    )
  )

  const hasProductElements = Boolean(
    document.querySelector(
      '#productTitle, [data-hook="product-link"], h1#title, #cm_cr-product_info, [data-hook="cr-product-header"]'
    )
  )

  return isUrl || hasReviewElements || hasProductElements
}

// Injected CSS animations for the inline badge
function injectBadgeStyles() {
  if (document.getElementById("deceptiscan-badge-styles")) return
  const style = document.createElement("style")
  style.id = "deceptiscan-badge-styles"
  style.textContent = `
    @keyframes deceptiscan-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.35; transform: scale(0.85); }
    }
  `
  document.head?.appendChild(style)
}

// Render or update the in-page inline DeceptiScan Trust Badge
function renderInlineBadge(
  score: number | null,
  risk: string,
  isAi: boolean,
  isLoading: boolean,
  reviewsCount: number
) {
  if (!isAmazonProductOrReviewsPage()) {
    const existing = document.getElementById("deceptiscan-inline-badge")
    if (existing) existing.remove()
    return
  }

  injectBadgeStyles()

  // Target anchors on Amazon product & review pages
  const targetContainer =
    document.querySelector("#averageCustomerReviews_feature_div") ||
    document.querySelector("#averageCustomerReviews") ||
    document.querySelector("#acrCustomerReviewText")?.parentElement ||
    document.querySelector('[data-hook="rating-out-of-text"]')?.parentElement ||
    document.querySelector("#cm_cr_product_info") ||
    document.querySelector("#cm_cr-product_info") ||
    document.querySelector("#titleSection") ||
    document.querySelector("#title_feature_div")

  if (!targetContainer) return

  let badge = document.getElementById("deceptiscan-inline-badge")
  if (!badge) {
    badge = document.createElement("div")
    badge.id = "deceptiscan-inline-badge"
    
    // Inject right next to Amazon's star rating link or review count
    const anchorLink = targetContainer.querySelector("#acrCustomerReviewLink, .a-declarative, #acrCustomerReviewText, [data-hook=\"rating-out-of-text\"], .a-icon-alt")
    if (anchorLink && anchorLink.parentElement === targetContainer && anchorLink.nextSibling) {
      targetContainer.insertBefore(badge, anchorLink.nextSibling)
    } else {
      targetContainer.appendChild(badge)
    }
  }

  // Determine colors based on risk
  let riskColor = "#0D9488" // Teal
  let riskBg = "rgba(13, 148, 136, 0.16)"
  let riskLabel = "Low Risk"

  if (risk === "High Risk") {
    riskColor = "#EF4444"
    riskBg = "rgba(239, 68, 68, 0.16)"
    riskLabel = "High Risk"
  } else if (risk === "Medium Risk") {
    riskColor = "#F59E0B"
    riskBg = "rgba(245, 158, 11, 0.16)"
    riskLabel = "Medium Risk"
  } else if (risk === "Awaiting Reviews" || score === null) {
    riskColor = "#94A3B8"
    riskBg = "rgba(148, 163, 184, 0.16)"
    riskLabel = "Awaiting Reviews"
  }

  badge.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 3px 10px;
    margin: 2px 0 2px 10px;
    vertical-align: middle;
    background: #0B0F19;
    color: #F8FAFC;
    border: 1px solid ${riskColor}60;
    border-radius: 999px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    transition: all 0.2s ease;
    z-index: 999;
    user-select: none;
  `

  badge.onmouseenter = () => {
    badge!.style.transform = "translateY(-1px)"
    badge!.style.boxShadow = `0 4px 14px ${riskColor}35`
    badge!.style.borderColor = riskColor
  }
  badge.onmouseleave = () => {
    badge!.style.transform = "none"
    badge!.style.boxShadow = "0 2px 8px rgba(0,0,0,0.25)"
    badge!.style.borderColor = `${riskColor}60`
  }

  badge.onclick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const target = document.querySelector("#customerReviews, #cm_cr-review_list, #reviewsMedley")
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
    } else {
      window.scrollBy({ top: 1200, behavior: "smooth" })
    }
  }

  const shieldIcon = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${riskColor}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  `

  if (isLoading) {
    badge.innerHTML = `
      ${shieldIcon}
      <span style="color: #94A3B8; font-weight: 500;">DeceptiScan:</span>
      <span style="color: #38BDF8; display: inline-flex; align-items: center; gap: 4px;">
        <span style="display:inline-block; width:5px; height:5px; border-radius:50%; background:#38BDF8; animation: deceptiscan-pulse 1s infinite;"></span>
        Analyzing AI...
      </span>
    `
    return
  }

  if (score === null || reviewsCount === 0) {
    badge.innerHTML = `
      ${shieldIcon}
      <span style="color: #CBD5E1; font-weight: 500;">DeceptiScan AI:</span>
      <span style="background: ${riskBg}; color: ${riskColor}; padding: 1px 6px; border-radius: 4px; font-size: 10px;">
        Click to Scan Reviews
      </span>
    `
    badge.title = "No customer reviews loaded in DOM yet. Click to scroll down and scan reviews."
    return
  }

  badge.innerHTML = `
    ${shieldIcon}
    <span style="color: #CBD5E1; font-weight: 500;">DeceptiScan</span>
    <span style="background: ${riskBg}; color: ${riskColor}; padding: 1px 7px; border-radius: 6px; font-weight: 700; font-size: 11px;">
      ${score}% ${isAi ? "AI" : ""}
    </span>
    <span style="color: ${riskColor}; font-size: 10.5px; font-weight: 600;">
      ${riskLabel}
    </span>
  `
  badge.title = `${score}% Trust Score (${riskLabel}) based on ${reviewsCount} reviews analyzed with ${isAi ? "DeBERTa-v3 AI" : "Heuristic"} analysis. Click to jump to reviews.`
}

// Request prediction from FastAPI backend for the inline badge
async function updateBadgeWithAi(reviews: string[]) {
  if (!reviews || reviews.length === 0) return

  let apiUrl = "http://127.0.0.1:8000"
  try {
    const res = await new Promise<any>((resolve) => {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["apiUrl"], resolve)
      } else {
        resolve(null)
      }
    })
    if (res?.apiUrl) apiUrl = res.apiUrl
  } catch (e) {}

  const endpoints = [apiUrl]
  if (apiUrl.includes("127.0.0.1")) endpoints.push(apiUrl.replace("127.0.0.1", "localhost"))
  else if (apiUrl.includes("localhost")) endpoints.push(apiUrl.replace("localhost", "127.0.0.1"))

  let aiResult: { score: number; risk: string } | null = null

  for (const ep of endpoints) {
    try {
      const response = await fetch(`${ep}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ reviews }),
        signal: AbortSignal.timeout(8000)
      })
      if (response.ok) {
        aiResult = await response.json()
        break
      }
    } catch (e) {}
  }

  if (aiResult) {
    renderInlineBadge(aiResult.score, aiResult.risk, true, false, reviews.length)
  } else {
    const hr = analyzeReviews(reviews, "Unknown", "0")
    renderInlineBadge(hr.score, hr.risk, false, false, reviews.length)
  }
}

async function extractProductDetails(): Promise<{
  productName: string
  rating: string
  reviewCount: string
  reviews: string[]
}> {
  if (!isAmazonProductOrReviewsPage()) {
    saveToStorage("No Product Found", "N/A", "0", [])
    renderInlineBadge(null, "No Product", false, false, 0)
    return { productName: "No Product Found", rating: "N/A", reviewCount: "0", reviews: [] }
  }

  // Product Name
  let titleEl =
    document.querySelector("#productTitle") ||
    document.querySelector('[data-hook="product-link"]') ||
    document.querySelector('#cm_cr-product_info a.a-link-normal') ||
    document.querySelector('[data-hook="cr-product-header"] a') ||
    document.querySelector('.product-title a') ||
    document.querySelector('.product-title') ||
    document.querySelector("h1#title")

  let productName = titleEl?.textContent?.trim() || ""
  if (!productName || productName.length === 0) {
    productName = cleanTitle(document.title)
  } else {
    productName = cleanTitle(productName)
  }

  if (!productName) {
    productName = cleanTitle(document.title) || "Unknown Product"
  }

  // Rating
  const rating =
    document.querySelector(".a-icon-alt")?.textContent?.trim() ||
    document.querySelector('[data-hook="rating-out-of-text"]')?.textContent?.trim() ||
    "Unknown"

  // Review Count
  let reviewCount = "0"
  const productPageReviewCount = document.querySelector("#acrCustomerReviewText")?.textContent?.trim()
  if (productPageReviewCount) {
    reviewCount = productPageReviewCount
  } else {
    const reviewPageMatch = document.body.innerText.match(/([\d,]+)\s+global ratings/i)
    if (reviewPageMatch) {
      reviewCount = `${reviewPageMatch[1]} global ratings`
    } else {
      const totalCountEl = document.querySelector('[data-hook="total-review-count"]')
      if (totalCountEl?.textContent) {
        reviewCount = totalCountEl.textContent.trim()
      }
    }
  }

  // 1. Initial on-page review extraction
  let reviews = extractAllOnPageReviews()

  // 2. If 0 reviews found, try fetching or scrolling
  if (reviews.length === 0) {
    reviews = await fetchFromReviewsPage(reviews)
  }

  // Save whatever we found
  saveToStorage(productName, rating, reviewCount, reviews)

  // Update In-Page Inline Rating Badge
  if (reviews.length > 0) {
    const initialHeuristic = analyzeReviews(reviews, rating, reviewCount)
    renderInlineBadge(initialHeuristic.score, initialHeuristic.risk, false, false, reviews.length)
    updateBadgeWithAi(reviews)
  } else {
    renderInlineBadge(null, "Awaiting Reviews", false, false, 0)
  }

  return { productName, rating, reviewCount, reviews }
}

// Handler for popup messages
async function handleScrapeMessage(action: string) {
  if (!isAmazonProductOrReviewsPage()) {
    saveToStorage("No Product Found", "N/A", "0", [])
    renderInlineBadge(null, "No Product", false, false, 0)
    return {
      status: "no_product",
      product: "No Product Found",
      rating: "N/A",
      reviewCount: "0",
      reviews: []
    }
  }

  if (action === "scrollToReviews") {
    const reviewSection = document.querySelector(
      '#customerReviews, #reviews-medley-footer, #cm-cr-dp-review-list, [data-hook="reviews-medley-footer"], #reviewsMedley, #cm_cr-review_list'
    )
    if (reviewSection) {
      reviewSection.scrollIntoView({ behavior: "smooth", block: "center" })
      await delay(900) // allow Amazon AJAX to inject reviews
    } else {
      window.scrollBy({ top: 1200, behavior: "smooth" })
      await delay(900)
    }
  }

  const result = await extractProductDetails()

  // If still 0 after scrolling, try one more on-page extraction pass
  if (result.reviews.length === 0) {
    const secondPass = extractAllOnPageReviews()
    if (secondPass.length > 0) {
      result.reviews = secondPass
      saveToStorage(result.productName, result.rating, result.reviewCount, secondPass)
    } else {
      const fetched = await fetchFromReviewsPage([])
      if (fetched.length > 0) {
        result.reviews = fetched
        saveToStorage(result.productName, result.rating, result.reviewCount, fetched)
      }
    }
  }

  // If we have fewer than 15 reviews, try fetching more from next review pages
  if (result.reviews.length > 0 && result.reviews.length < 15) {
    const extra = await fetchFromReviewsPage(result.reviews)
    if (extra.length > result.reviews.length) {
      result.reviews = extra
      saveToStorage(result.productName, result.rating, result.reviewCount, extra)
    }
  }

  // Update badge with final reviews count
  if (result.reviews.length > 0) {
    updateBadgeWithAi(result.reviews)
  } else {
    renderInlineBadge(null, "Awaiting Reviews", false, false, 0)
  }

  return {
    status: "success",
    product: result.productName,
    rating: result.rating,
    reviewCount: result.reviewCount,
    reviews: result.reviews
  }
}

// Initial detection on load
if (document.readyState === "complete" || document.readyState === "interactive") {
  extractProductDetails()
} else {
  window.addEventListener("DOMContentLoaded", () => extractProductDetails())
}

// Debounced scroll listener
let scrollTimeout: any = null
window.addEventListener("scroll", () => {
  if (scrollTimeout) clearTimeout(scrollTimeout)
  scrollTimeout = setTimeout(() => {
    const onPage = extractAllOnPageReviews()
    if (onPage.length > 0) {
      chrome.storage.local.get(["reviews", "currentProduct", "rating", "reviewCount"], (data) => {
        const existing = data.reviews || []
        if (onPage.length > existing.length) {
          saveToStorage(data.currentProduct || document.title, data.rating || "", data.reviewCount || "", onPage)
          updateBadgeWithAi(onPage)
        }
      })
    }
  }, 800)
}, { passive: true })

// Message listener for popup commands
if (typeof chrome !== "undefined" && chrome.runtime) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scrape" || request.action === "scrollToReviews") {
      handleScrapeMessage(request.action).then((res) => {
        sendResponse(res)
      })
      return true // Keep message port open for async response
    }
  })
}

// Ensure badge stays anchored even during Amazon dynamic React client-side updates
setInterval(() => {
  if (isAmazonProductOrReviewsPage() && !document.getElementById("deceptiscan-inline-badge")) {
    const reviews = extractAllOnPageReviews()
    if (reviews.length > 0) {
      const hr = analyzeReviews(reviews, "Unknown", "0")
      renderInlineBadge(hr.score, hr.risk, false, false, reviews.length)
      updateBadgeWithAi(reviews)
    } else {
      renderInlineBadge(null, "Awaiting Reviews", false, false, 0)
    }
  }
}, 3500)

export {}