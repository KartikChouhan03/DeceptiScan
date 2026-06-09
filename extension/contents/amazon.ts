import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: [
    "https://www.amazon.com/*",
    "https://www.amazon.in/*",
    "https://www.myntra.com/*",
    
  ]
}

console.log(
  "DeceptiScan Amazon content script loaded"
)

function getASIN(url: string): string | null {
  const match = url.match(/\/([A-Z0-9]{10})(?:[/?]|$)/i);
  return match ? match[1] : null;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchReviewsFromAllReviewsPage(
  productName: string,
  rating: string,
  reviewCount: string,
  viewportReviews: string[]
) {
  const asin = getASIN(window.location.href);
  if (!asin) {
    console.log("ASIN not detected in URL, utilizing viewport reviews only.");
    saveToStorage(productName, rating, reviewCount, viewportReviews);
    return;
  }

  const allReviews: string[] = [];
  const maxPages = 5; // Query up to 5 pages of reviews (approx. 50 reviews total)
  const hostname = window.location.hostname;

  try {
    for (let page = 1; page <= maxPages; page++) {
      const reviewsUrl = `https://${hostname}/product-reviews/${asin}/ref=cm_cr_arp_d_viewopt_srt?reviewerType=all_reviews&sortBy=recent&pageNumber=${page}`;
      console.log(`Background fetching page ${page} from: ${reviewsUrl}`);
      
      const response = await fetch(reviewsUrl);
      const htmlText = await response.text();
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, "text/html");
      const reviewNodes = doc.querySelectorAll('[data-hook="review-body"]');
      
      const pageReviews = Array.from(reviewNodes)
        .map(node => node.textContent?.trim())
        .filter((text): text is string => Boolean(text));

      if (pageReviews.length === 0) {
        console.log(`Page ${page} returned 0 reviews. Breaking pagination loop.`);
        break;
      }

      allReviews.push(...pageReviews);
      console.log(`Page ${page} added ${pageReviews.length} reviews. Total reviews: ${allReviews.length}`);

      // Apply random jitter delay (700ms - 1500ms) to bypass security blocks
      if (page < maxPages) {
        const jitter = 700 + Math.random() * 800;
        await delay(jitter);
      }
    }

    const finalReviews = allReviews.length > 0 ? allReviews : viewportReviews;
    saveToStorage(productName, rating, reviewCount, finalReviews);
  } catch (error) {
    console.error("Background reviews pagination error, falling back to viewport:", error);
    saveToStorage(productName, rating, reviewCount, viewportReviews);
  }
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
      if (chrome.runtime.lastError) {
        console.error("Storage error:", chrome.runtime.lastError);
        return;
      }
      console.log(`Saved product metadata and ${reviews.length} reviews.`);
    });
  } else {
    console.error("Chrome storage API unavailable");
  }
}

function detectProduct() {
  try {
    // Product Name
    const productName =
      document
        .querySelector("#productTitle")
        ?.textContent
        ?.trim() ||

      document
        .querySelector(
          '[data-hook="product-link"]'
        )
        ?.textContent
        ?.trim() ||

      document.title;

    if (!productName) {
      console.log("Product title not found");
      return;
    }

    // Rating
    const rating =
      document
        .querySelector(".a-icon-alt")
        ?.textContent
        ?.trim() || "Unknown";

    // Review Count
    let reviewCount = "0";

    const productPageReviewCount =
      document
        .querySelector(
          "#acrCustomerReviewText"
        )
        ?.textContent
        ?.trim();

    if (productPageReviewCount) {
      reviewCount = productPageReviewCount;
    } else {
      const reviewPageMatch =
        document.body.innerText.match(
          /([\d,]+)\s+global ratings/i
        );

      if (reviewPageMatch) {
        reviewCount = `${reviewPageMatch[1]} global ratings`;
      }
    }

    // Capture viewport reviews as immediate baseline
    const reviewNodes =
      document.querySelectorAll(
        '[data-hook="review-body"]'
      );

    const viewportReviews = Array.from(reviewNodes)
      .map((node) => node.textContent?.trim())
      .filter((review): review is string => Boolean(review))
      .slice(0, 50);

    console.log("Detected Product:", productName);
    console.log("Rating:", rating);
    console.log("Review Count:", reviewCount);
    console.log("Viewport reviews found:", viewportReviews.length);

    // Trigger background fetcher
    fetchReviewsFromAllReviewsPage(productName, rating, reviewCount, viewportReviews);
  } catch (error) {
    console.error("Amazon content script error:", error);
  }
}

// Initial run
if (
  document.readyState ===
    "complete" ||
  document.readyState ===
    "interactive"
) {
  detectProduct()
} else {
  window.addEventListener(
    "DOMContentLoaded",
    detectProduct
  )
}

// Debounce helper to prevent performance issues
let debounceTimeout: any = null
function triggerDebouncedDetection() {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout)
  }
  debounceTimeout = setTimeout(() => {
    detectProduct()
  }, 1000)
}

// Monitor scrolling to catch lazy-loaded review sections
window.addEventListener("scroll", triggerDebouncedDetection, { passive: true })

// Monitor DOM mutations (useful if reviews are loaded dynamically/via AJAX)
const mutationObserver = new MutationObserver((mutations) => {
  let reviewsAdded = false
  for (const m of mutations) {
    if (m.addedNodes.length > 0) {
      reviewsAdded = true
      break
    }
  }
  if (reviewsAdded) {
    triggerDebouncedDetection()
  }
})

mutationObserver.observe(document.body, {
  childList: true,
  subtree: true
})

if (typeof chrome !== "undefined" && chrome.runtime) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scrape") {
      console.log("Re-scraping requested from popup...");
      detectProduct();
      sendResponse({ status: "success" });
    }
    return true;
  });
}

export {}