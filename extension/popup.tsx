import { useEffect, useState } from "react"
import {
  ShieldCheck,
  AlertTriangle,
  Search,
  FileText,
  Cpu,
  ServerCrash,
  RefreshCw,
  Settings,
  List,
  BarChart2,
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
  Sun,
  Moon
} from "lucide-react"
import axios from "axios"
import analyzeReviews from "~lib/reviewAnalyzer"

// Theme Configurations
const darkTheme = {
  bg: "linear-gradient(135deg, #0B0F19 0%, #030712 100%)",
  cardBg: "rgba(30, 41, 59, 0.4)",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  textPrimary: "#F1F5F9",
  textSecondary: "#94A3B8",
  teal: "#0D9488",
  tealGlow: "0 0 12px rgba(13, 148, 136, 0.3)",
  red: "#EF4444",
  amber: "#F59E0B",
  inputBg: "rgba(15, 23, 42, 0.6)",
  headerBg: "rgba(15, 23, 42, 0.4)",
  tabActiveColor: "#0D9488"
}

const lightTheme = {
  bg: "linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)",
  cardBg: "rgba(255, 255, 255, 0.75)",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  teal: "#0D9488",
  tealGlow: "0 0 8px rgba(13, 148, 136, 0.2)",
  red: "#EF4444",
  amber: "#D97706",
  inputBg: "rgba(255, 255, 255, 0.9)",
  headerBg: "rgba(255, 255, 255, 0.5)",
  tabActiveColor: "#0D9488"
}

interface ReviewDetail {
  text: string
  is_fake: boolean
  confidence: number
  genuine_prob: number
  fake_prob: number
}

function IndexPopup() {
  const [product, setProduct] = useState("Loading Product...")
  const [site, setSite] = useState("Detecting...")
  const [rating, setRating] = useState("Loading...")
  const [reviewCount, setReviewCount] = useState("Loading...")
  const [reviews, setReviews] = useState<string[]>([])
  
  // Custom states for upgraded features
  const [activeTab, setActiveTab] = useState<"overview" | "reviews" | "signals" | "settings">("overview")
  const [apiUrl, setApiUrl] = useState("http://127.0.0.1:8000")
  const [isApiConnected, setIsApiConnected] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [reviewsFilter, setReviewsFilter] = useState<"all" | "fake" | "genuine">("all")
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark")
  const [isScraping, setIsScraping] = useState(false)
  
  const [modelResult, setModelResult] = useState<{
    score: number
    risk: string
    fakeCount: number
    details: ReviewDetail[]
    isAiPowered: boolean
  } | null>(null)

  const theme = themeMode === "dark" ? darkTheme : lightTheme

  // Normalize target URL (strip trailing slashes, whitespace)
  const normalizeUrl = (rawUrl: string): string => {
    let clean = (rawUrl || "http://127.0.0.1:8000").trim()
    return clean.replace(/\/+$/, "")
  }

  // Load and test connection with automatic 127.0.0.1 / localhost fallback
  const checkConnection = async (targetUrl: string): Promise<boolean> => {
    const cleanUrl = normalizeUrl(targetUrl)
    const urlsToTry = [cleanUrl]
    if (cleanUrl.includes("localhost")) {
      urlsToTry.push(cleanUrl.replace("localhost", "127.0.0.1"))
    } else if (cleanUrl.includes("127.0.0.1")) {
      urlsToTry.push(cleanUrl.replace("127.0.0.1", "localhost"))
    }

    for (const url of urlsToTry) {
      try {
        const response = await fetch(`${url}/api/health`, {
          method: "GET",
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(3000)
        })
        if (response.ok) {
          const data = await response.json()
          if (data?.status === "healthy") {
            setIsApiConnected(true)
            if (url !== cleanUrl) {
              setApiUrl(url)
              if (typeof chrome !== "undefined" && chrome.storage?.local) {
                chrome.storage.local.set({ apiUrl: url })
              }
            }
            return true
          }
        }
      } catch (err) {
        // try alternative url candidate
      }
    }
    setIsApiConnected(false)
    return false
  }

  // Request prediction from FastAPI backend
  const runModelAnalysis = async (reviewsToAnalyze: string[], targetUrl: string) => {
    if (!reviewsToAnalyze || reviewsToAnalyze.length === 0) {
      setIsAnalyzing(false)
      return
    }
    setIsAnalyzing(true)

    const cleanUrl = normalizeUrl(targetUrl)
    const isOnline = await checkConnection(cleanUrl)
    if (!isOnline) {
      setIsAnalyzing(false)
      setModelResult({
        score: 0,
        risk: "",
        fakeCount: 0,
        details: [],
        isAiPowered: false
      })
      return
    }

    try {
      const response = await fetch(`${cleanUrl}/api/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ reviews: reviewsToAnalyze }),
        signal: AbortSignal.timeout(30000)
      })

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`)
      }

      const { score, risk, fake_count, details } = await response.json()
      setModelResult({
        score,
        risk,
        fakeCount: fake_count,
        details: details || [],
        isAiPowered: true
      })
    } catch (error) {
      console.error("[DeceptiScan] AI inference request failed, utilizing heuristic fallback:", error)
      setModelResult({
        score: 0,
        risk: "",
        fakeCount: 0,
        details: [],
        isAiPowered: false
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Helper to strip Amazon site/review prefixes from titles
  const cleanProductName = (name: string): string => {
    if (!name) return ""
    let clean = name.trim()
    clean = clean.replace(/^Amazon\.[a-z.]+\s*[-:|]\s*Customer reviews\s*[-:|]\s*/i, "")
    clean = clean.replace(/^Customer reviews\s*[-:|]\s*/i, "")
    clean = clean.replace(/^Amazon\.[a-z.]+\s*[-:|]\s*/i, "")
    clean = clean.replace(/\s*[-:|]\s*Amazon\.[a-z.]+$/i, "")
    clean = clean.replace(/\s*[-:|]\s*Online Shopping.*$/i, "")
    return clean.trim() || name.trim()
  }

  // Scrape page dynamically via message parsing
  const handleReload = () => {
    if (typeof chrome === "undefined" || !chrome.tabs) return
    setIsScraping(true)
    setIsAnalyzing(true)

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs?.[0]
      if (!activeTab?.id) {
        setIsScraping(false)
        setIsAnalyzing(false)
        return
      }

      chrome.tabs.sendMessage(activeTab.id, { action: "scrape" }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script not running on this tab (e.g. Google, new tab, non-supported domain)
          console.warn("[DeceptiScan] Content script communication:", chrome.runtime.lastError.message)
          setProduct("No Product Found")
          setReviews([])
          setModelResult(null)
          setIsScraping(false)
          setIsAnalyzing(false)
          return
        }

        if (response && response.status === "no_product") {
          setProduct("No Product Found")
          setReviews([])
          setModelResult(null)
          setIsScraping(false)
          setIsAnalyzing(false)
          return
        }

        if (response && response.product && response.product !== "No Product Found") {
          const cleanName = cleanProductName(response.product)
          setProduct(cleanName)
          if (response.rating) setRating(response.rating)
          if (response.reviewCount) setReviewCount(response.reviewCount)
          const fetchedReviews = response.reviews || []
          setReviews(fetchedReviews)
          if (fetchedReviews.length > 0) {
            runModelAnalysis(fetchedReviews, apiUrl)
          } else {
            setIsAnalyzing(false)
          }
          setIsScraping(false)
        } else {
          // Fallback storage check
          setTimeout(() => {
            chrome.storage.local.get(
              ["currentProduct", "currentSite", "rating", "reviewCount", "reviews"],
              (result) => {
                const storedProd = result.currentProduct || "No Product Found"
                setProduct(cleanProductName(storedProd))
                if (result.currentSite) setSite(result.currentSite)
                if (result.rating) setRating(result.rating)
                if (result.reviewCount) setReviewCount(result.reviewCount)
                const fetchedReviews = result.reviews || []
                setReviews(fetchedReviews)

                if (fetchedReviews.length > 0) {
                  runModelAnalysis(fetchedReviews, apiUrl)
                } else {
                  setIsAnalyzing(false)
                }
                setIsScraping(false)
              }
            )
          }, 600)
        }
      })
    })
  }

  // Auto-scroll Amazon page down to customer reviews section to trigger lazy loading
  const handleScrollToReviews = () => {
    if (typeof chrome === "undefined" || !chrome.tabs) return
    setIsScraping(true)
    setIsAnalyzing(true)

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs?.[0]
      if (activeTab?.id) {
        chrome.tabs.sendMessage(activeTab.id, { action: "scrollToReviews" }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn("[DeceptiScan] Scroll message error:", chrome.runtime.lastError.message)
          }

          if (response && response.status === "no_product") {
            setProduct("No Product Found")
            setReviews([])
            setModelResult(null)
            setIsScraping(false)
            setIsAnalyzing(false)
            return
          }

          if (response && response.product && response.product !== "No Product Found") {
            const cleanName = cleanProductName(response.product)
            setProduct(cleanName)
            if (response.rating) setRating(response.rating)
            if (response.reviewCount) setReviewCount(response.reviewCount)
            const fetchedReviews = response.reviews || []
            setReviews(fetchedReviews)
            if (fetchedReviews.length > 0) {
              runModelAnalysis(fetchedReviews, apiUrl)
            } else {
              setIsAnalyzing(false)
            }
            setIsScraping(false)
          } else {
            setTimeout(() => {
              chrome.storage.local.get(
                ["currentProduct", "rating", "reviewCount", "reviews"],
                (result) => {
                  const fetchedReviews = result.reviews || []
                  setReviews(fetchedReviews)
                  if (fetchedReviews.length > 0) {
                    runModelAnalysis(fetchedReviews, apiUrl)
                  } else {
                    setIsAnalyzing(false)
                  }
                  setIsScraping(false)
                }
              )
            }, 1000)
          }
        })
      } else {
        setIsScraping(false)
        setIsAnalyzing(false)
      }
    })
  }

  // Load settings and active tab data from local storage
  useEffect(() => {
    try {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        setProduct("No Product Found")
        setSite("Unknown Site")
        return
      }

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs?.[0]
        const url = activeTab?.url || ""
        const isSupportedShoppingSite = url.includes("amazon.") || url.includes("myntra.com")

        chrome.storage.local.get(
          ["currentProduct", "currentSite", "rating", "reviewCount", "reviews", "apiUrl", "themeMode"],
          (result) => {
            if (chrome.runtime.lastError) {
              console.error(chrome.runtime.lastError)
              return
            }

            const savedUrl = result.apiUrl || "http://127.0.0.1:8000"
            setApiUrl(savedUrl)
            checkConnection(savedUrl)

            const savedTheme = result.themeMode || "dark"
            setThemeMode(savedTheme)

            // If active tab is definitely NOT a supported shopping site (e.g. google.com, youtube, reddit, blank)
            if (activeTab && url && !isSupportedShoppingSite) {
              setProduct("No Product Found")
              setSite("Unknown Site")
              setRating("N/A")
              setReviewCount("0")
              setReviews([])
              setModelResult(null)
              return
            }

            // On Amazon or shopping tabs, immediately trigger scrape to get live data from the tab
            handleReload()
          }
        )
      })

      // Listen for updates dynamically as user scrolls or navigates
      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        if (areaName === "local") {
          if (changes.currentProduct) {
            const raw = changes.currentProduct.newValue || "No Product Found"
            setProduct(cleanProductName(raw))
          }
          if (changes.currentSite) setSite(changes.currentSite.newValue || "Unknown Site")
          if (changes.rating) setRating(changes.rating.newValue || "N/A")
          if (changes.reviewCount) setReviewCount(changes.reviewCount.newValue || "0")
          
          if (changes.reviews) {
            const newReviews = changes.reviews.newValue || []
            setReviews(newReviews)
            
            chrome.storage.local.get(["apiUrl"], (res) => {
              const activeUrl = res.apiUrl || "http://127.0.0.1:8000"
              if (newReviews.length > 0) {
                runModelAnalysis(newReviews, activeUrl)
              } else {
                setModelResult(null)
              }
            })
          }
        }
      }

      chrome.storage.onChanged.addListener(handleStorageChange)
      return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange)
      }
    } catch (e) {
      console.error("Popup storage load crashed:", e)
    }
  }, [])

  // Local fallback heuristics
  const heuristicResult = analyzeReviews(reviews, rating, reviewCount)

  // Compute active variables
  const isAiActive = modelResult?.isAiPowered && !isAnalyzing

  const isGenericSiteTitle = (name: string) => {
    const lower = name.toLowerCase()
    return (
      lower.includes("online shopping site") ||
      lower.includes("spend less. smile more") ||
      lower === "amazon.in" ||
      lower === "amazon.com" ||
      lower === "amazon.co.uk" ||
      lower === "amazon" ||
      lower.startsWith("amazon.in: online shopping") ||
      lower.startsWith("amazon.com: online shopping")
    )
  }

  const hasProduct = Boolean(
    product &&
    product.trim().length > 0 &&
    product !== "No Product Found" &&
    product !== "Loading Product..." &&
    product !== "Unknown Site" &&
    product !== "Unknown Product" &&
    !isGenericSiteTitle(product)
  )
  const hasReviews = Boolean(reviews && reviews.length > 0)

  // When there is no product, do not compute or show any Trust Score
  const score = hasProduct
    ? (isAiActive ? modelResult.score : (hasReviews ? heuristicResult.score : null))
    : null
  const risk = hasProduct
    ? (isAiActive ? modelResult.risk : (hasReviews ? heuristicResult.risk : "Awaiting Reviews"))
    : "No Product Detected"

  const getRiskStyles = (riskLevel: string) => {
    const isDark = themeMode === "dark"
    switch (riskLevel) {
      case "High Risk":
        return { 
          color: theme.red, 
          bg: isDark ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.08)", 
          text: isDark ? "#FCA5A5" : "#7F1D1D" 
        }
      case "Medium Risk":
        return { 
          color: theme.amber, 
          bg: isDark ? "rgba(245, 158, 11, 0.15)" : "rgba(245, 158, 11, 0.08)", 
          text: isDark ? "#FDE047" : "#78350F" 
        }
      case "Awaiting Reviews":
      case "No Product Detected":
        return {
          color: theme.textSecondary,
          bg: isDark ? "rgba(148, 163, 184, 0.12)" : "rgba(148, 163, 184, 0.15)",
          text: isDark ? "#94A3B8" : "#475569"
        }
      case "Low Risk":
      default:
        return { 
          color: theme.teal, 
          bg: isDark ? "rgba(13, 148, 136, 0.15)" : "rgba(13, 148, 136, 0.08)", 
          text: isDark ? "#99F6E4" : "#115E59" 
        }
    }
  }

  const styles = getRiskStyles(risk)

  // Signals list computation
  const displaySignals = hasReviews ? [...heuristicResult.signals] : []
  if (hasProduct && isAiActive && modelResult) {
    if (modelResult.fakeCount > 0) {
      displaySignals.unshift(`${modelResult.fakeCount} review(s) flagged as suspicious by DeBERTa-v3 AI model`)
    } else {
      displaySignals.unshift("All scraped reviews passed DeBERTa-v3 AI validation")
    }
  }

  // Filtered reviews
  const filteredDetails = (modelResult?.details || []).filter((item) => {
    if (reviewsFilter === "fake") return item.is_fake
    if (reviewsFilter === "genuine") return !item.is_fake
    return true
  })

  // Save new URL to storage
  const handleSaveSettings = () => {
    const cleanUrl = normalizeUrl(apiUrl)
    setApiUrl(cleanUrl)
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ apiUrl: cleanUrl }, () => {
        checkConnection(cleanUrl)
        if (reviews.length > 0) {
          runModelAnalysis(reviews, cleanUrl)
        }
      })
    }
  }

  // Toggle UI Theme
  const handleToggleTheme = () => {
    const nextTheme = themeMode === "dark" ? "light" : "dark"
    setThemeMode(nextTheme)
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ themeMode: nextTheme })
    }
  }

  return (
    <div
      style={{
        width: "440px",
        height: "600px",
        background: theme.bg,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        color: theme.textPrimary,
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        overflow: "hidden",
        transition: "background 0.3s ease, color 0.3s ease"
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: theme.border,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: theme.headerBg,
          transition: "background 0.3s ease"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ShieldCheck size={22} color={theme.teal} style={{ filter: themeMode === "dark" ? theme.tealGlow : "none" }} />
          <h1 style={{ fontSize: "16px", fontWeight: 700, margin: 0, letterSpacing: "-0.5px" }}>
            DeceptiScan
          </h1>
        </div>

        {/* Action Controls Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          
          {/* Force Re-Scrape Button */}
          <button
            onClick={handleReload}
            disabled={isScraping}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: theme.textSecondary,
              display: "flex",
              alignItems: "center",
              borderRadius: "6px",
              transition: "background 0.2s"
            }}
            title="Reload & Re-analyze Page"
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(128,128,128,0.15)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <RefreshCw 
              size={16} 
              style={{ 
                animation: isScraping ? "spin 1s linear infinite" : "none",
                transition: "transform 0.2s"
              }} 
            />
          </button>

          {/* Theme Mode Toggle */}
          <button
            onClick={handleToggleTheme}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: theme.textSecondary,
              display: "flex",
              alignItems: "center",
              borderRadius: "6px",
              transition: "background 0.2s"
            }}
            title={themeMode === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(128,128,128,0.15)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            {themeMode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Live Network Status Indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "10px",
              background: isApiConnected ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
              padding: "3px 8px",
              borderRadius: "999px",
              border: `1px solid ${isApiConnected ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)"}`
            }}
          >
            {isApiConnected ? (
              <Wifi size={10} color="#10B981" />
            ) : (
              <WifiOff size={10} color={theme.red} />
            )}
            <span style={{ color: isApiConnected ? "#10B981" : theme.red, fontWeight: 700 }}>
              {isApiConnected ? "AI" : "Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area (Scrollable) */}
      <div
        style={{
          flex: 1,
          padding: "16px 20px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          position: "relative"
        }}
      >
        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div style={{ animation: "fadeIn 0.25s ease-out", display: "flex", flexDirection: "column", gap: "16px" }}>
            {!hasProduct ? (
              <div
                style={{
                  background: theme.cardBg,
                  border: theme.border,
                  borderRadius: "16px",
                  padding: "40px 24px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "16px",
                  transition: "background 0.3s ease"
                }}
              >
                <div
                  style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "50%",
                    background: themeMode === "dark" ? "rgba(148, 163, 184, 0.1)" : "rgba(148, 163, 184, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: theme.textSecondary
                  }}
                >
                  <Search size={28} />
                </div>

                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px 0", color: theme.textPrimary }}>
                    No Product Detected
                  </h3>
                  <p style={{ fontSize: "12px", color: theme.textSecondary, margin: 0, lineHeight: 1.5, maxWidth: "270px" }}>
                    Navigate to an Amazon product listing page to scan customer reviews and compute the Trust Score.
                  </p>
                </div>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    background: themeMode === "dark" ? "rgba(13, 148, 136, 0.1)" : "rgba(13, 148, 136, 0.08)",
                    border: `1px solid ${themeMode === "dark" ? "rgba(13, 148, 136, 0.2)" : "rgba(13, 148, 136, 0.15)"}`,
                    color: theme.teal,
                    fontSize: "11px",
                    fontWeight: 600
                  }}
                >
                  <span>Supported: Amazon product listings (/dp/...)</span>
                </div>

                <button
                  onClick={handleReload}
                  disabled={isScraping}
                  style={{
                    background: themeMode === "dark" ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)",
                    border: theme.border,
                    color: theme.textPrimary,
                    borderRadius: "8px",
                    padding: "8px 16px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginTop: "4px",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = themeMode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = themeMode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)")}
                >
                  <RefreshCw size={12} style={{ animation: isScraping ? "spin 1s linear infinite" : "none" }} />
                  Scan Current Tab
                </button>
              </div>
            ) : (
              <>
                {/* Sizing & Guidance Alert */}
                {reviews.length === 0 && (
                  <div
                    style={{
                      background: "rgba(59, 130, 246, 0.1)",
                      border: "1px solid rgba(59, 130, 246, 0.2)",
                      borderRadius: "12px",
                      padding: "12px 14px",
                      color: themeMode === "dark" ? "#93C5FD" : "#1E40AF",
                      fontSize: "12px",
                      lineHeight: 1.4,
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px"
                    }}
                  >
                    <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                      <AlertTriangle size={16} color={themeMode === "dark" ? "#60A5FA" : "#2563EB"} style={{ flexShrink: 0, marginTop: "1px" }} />
                      <div>
                        <strong>Customer reviews not loaded in DOM yet.</strong> Amazon lazily loads reviews when scrolled into view.
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginLeft: "24px" }}>
                      <button
                        onClick={handleScrollToReviews}
                        disabled={isScraping}
                        style={{
                          background: theme.teal,
                          color: "#FFFFFF",
                          border: "none",
                          borderRadius: "6px",
                          padding: "6px 10px",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px"
                        }}
                      >
                        <RefreshCw size={11} style={{ animation: isScraping ? "spin 1s linear infinite" : "none" }} />
                        Auto-Scroll & Scrape
                      </button>
                    </div>
                  </div>
                )}

                {/* Gauge Score Card */}
                <div
                  style={{
                    background: theme.cardBg,
                    border: theme.border,
                    borderRadius: "16px",
                    padding: "20px",
                    textAlign: "center",
                    position: "relative",
                    transition: "background 0.3s ease"
                  }}
                >
                  {isAnalyzing ? (
                    <div
                      style={{
                        width: "100px",
                        height: "100px",
                        borderRadius: "50%",
                        border: "6px solid rgba(255,255,255,0.03)",
                        borderTop: `6px solid ${theme.teal}`,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        margin: "0 auto 16px auto",
                        animation: "spin 1s linear infinite"
                      }}
                    >
                      <Cpu size={24} color={theme.teal} style={{ animation: "pulse 1.5s infinite" }} />
                    </div>
                  ) : (
                    <div
                      style={{
                        width: "100px",
                        height: "100px",
                        borderRadius: "50%",
                        border: `6px solid ${score !== null ? styles.color : theme.textSecondary}`,
                        boxShadow: score !== null && themeMode === "dark" ? `inset 0 0 10px ${styles.color}18, 0 0 10px ${styles.color}0c` : "none",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        margin: "0 auto 16px auto",
                        transition: "all 0.3s ease"
                      }}
                    >
                      {score !== null ? (
                        <span style={{ fontSize: "34px", fontWeight: 800, color: styles.color }}>
                          {score}%
                        </span>
                      ) : (
                        <span style={{ fontSize: "28px", fontWeight: 700, color: theme.textSecondary }}>
                          --
                        </span>
                      )}
                    </div>
                  )}

                  <h3 style={{ fontSize: "13px", color: theme.textSecondary, fontWeight: 500, margin: "0 0 8px 0" }}>
                    Product Trust Score
                  </h3>

                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "4px 14px",
                      borderRadius: "999px",
                      background: styles.bg,
                      color: styles.text,
                      fontSize: "12px",
                      fontWeight: 700,
                      letterSpacing: "0.2px",
                      transition: "all 0.3s ease"
                    }}
                  >
                    {risk}
                  </div>

                  {/* Dynamic AI / Analysis / Offline Status Indicator */}
                  {isAnalyzing ? (
                    <div
                      style={{
                        fontSize: "11px",
                        color: theme.teal,
                        marginTop: "10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px"
                      }}
                    >
                      <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} />
                      <span>Analyzing with DeBERTa-v3 AI...</span>
                    </div>
                  ) : isAiActive ? (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#10B981",
                        marginTop: "10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "5px"
                      }}
                    >
                      <CheckCircle2 size={12} color="#10B981" />
                      <span>DeBERTa-v3 AI Verified</span>
                    </div>
                  ) : reviews.length === 0 ? (
                    <div
                      style={{
                        fontSize: "11px",
                        color: theme.textSecondary,
                        marginTop: "10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "5px"
                      }}
                    >
                      <Cpu size={12} color={theme.textSecondary} />
                      <span>Click "Auto-Scroll & Scrape" to scan reviews</span>
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: "11px",
                        color: theme.amber,
                        marginTop: "10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "5px"
                      }}
                    >
                      <ServerCrash size={12} color={theme.amber} />
                      <span>Rule-based fallback (API Server offline)</span>
                    </div>
                  )}
                </div>

                {/* Product Meta Card */}
                <div
                  style={{
                    background: theme.cardBg,
                    border: theme.border,
                    borderRadius: "16px",
                    padding: "16px",
                    transition: "background 0.3s ease"
                  }}
                >
                  <span style={{ fontSize: "10px", textTransform: "uppercase", color: theme.teal, fontWeight: 700, letterSpacing: "0.5px" }}>
                    {site} Product
                  </span>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      margin: "6px 0 12px 0",
                      lineHeight: 1.4,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                    title={product}
                  >
                    {product}
                  </div>

                  {/* Stats Metrics Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                    <div style={{ background: themeMode === "dark" ? "rgba(15, 23, 42, 0.3)" : "rgba(255,255,255,0.4)", padding: "10px", borderRadius: "10px", border: theme.border }}>
                      <div style={{ fontSize: "9px", color: theme.textSecondary, marginBottom: "4px" }}>Rating</div>
                      <div style={{ fontSize: "12px", fontWeight: 700 }}>⭐ {rating.split(" ")[0]}</div>
                    </div>
                    <div style={{ background: themeMode === "dark" ? "rgba(15, 23, 42, 0.3)" : "rgba(255,255,255,0.4)", padding: "10px", borderRadius: "10px", border: theme.border }}>
                      <div style={{ fontSize: "9px", color: theme.textSecondary, marginBottom: "4px" }}>Reviews</div>
                      <div style={{ fontSize: "12px", fontWeight: 700 }}>📝 {reviewCount.split(" ")[0]}</div>
                    </div>
                    <div style={{ background: themeMode === "dark" ? "rgba(15, 23, 42, 0.3)" : "rgba(255,255,255,0.4)", padding: "10px", borderRadius: "10px", border: theme.border }}>
                      <div style={{ fontSize: "9px", color: theme.textSecondary, marginBottom: "4px" }}>Scraped</div>
                      <div style={{ fontSize: "12px", fontWeight: 700 }}>🤖 {reviews.length}</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: DETAILED REVIEWS LIST */}
        {activeTab === "reviews" && (
          <div style={{ animation: "fadeIn 0.25s ease-out", display: "flex", flexDirection: "column", gap: "12px", height: "100%" }}>
            {!hasProduct ? (
              <div style={{ textAlign: "center", padding: "48px 16px", color: theme.textSecondary }}>
                <Search size={28} style={{ marginBottom: "12px", opacity: 0.6 }} />
                <div style={{ fontSize: "13px", fontWeight: 600, color: theme.textPrimary }}>No Product Detected</div>
                <p style={{ fontSize: "11px", margin: "6px 0 0 0" }}>Open an Amazon product page to view predicted review details.</p>
              </div>
            ) : (
              <>
                {/* Filter Bar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: theme.textSecondary }}>
                    Showing {filteredDetails.length} of {modelResult?.details?.length || 0} reviews
                  </span>

                  <select
                    value={reviewsFilter}
                    onChange={(e) => setReviewsFilter(e.target.value as any)}
                    style={{
                      background: theme.inputBg,
                      color: theme.textPrimary,
                      border: "1px solid rgba(128,128,128,0.2)",
                      borderRadius: "6px",
                      padding: "4px 8px",
                      fontSize: "11px",
                      outline: "none",
                      cursor: "pointer"
                    }}
                  >
                    <option value="all">All Predictions</option>
                    <option value="fake">Fake Only</option>
                    <option value="genuine">Genuine Only</option>
                  </select>
                </div>

                {/* List */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    maxHeight: "360px",
                    overflowY: "auto",
                    paddingRight: "4px"
                  }}
                >
                  {!modelResult?.isAiPowered && !isAnalyzing ? (
                    <div style={{ textAlign: "center", padding: "40px 10px", color: theme.textSecondary }}>
                      <ServerCrash size={28} color={theme.amber} style={{ marginBottom: "12px" }} />
                      <div style={{ fontSize: "13px", fontWeight: 600 }}>Review details unavailable.</div>
                      <p style={{ fontSize: "11px", margin: "6px 0 0 0" }}>Start the FastAPI server and reload page data to request AI labels.</p>
                    </div>
                  ) : filteredDetails.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 10px", color: theme.textSecondary }}>
                      No matching reviews found.
                    </div>
                  ) : (
                    filteredDetails.map((item, index) => {
                      const percent = Math.round(item.confidence * 100)
                      return (
                        <div
                          key={index}
                          style={{
                            background: theme.cardBg,
                            border: theme.border,
                            borderRadius: "10px",
                            padding: "12px",
                            transition: "background 0.3s ease"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                color: item.is_fake ? theme.red : theme.teal,
                                background: item.is_fake ? "rgba(239, 68, 68, 0.1)" : "rgba(13, 148, 136, 0.1)",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                            >
                              {item.is_fake ? (
                                <>
                                  <XCircle size={10} />
                                  <span>Suspicious ({percent}%)</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 size={10} />
                                  <span>Trustworthy ({percent}%)</span>
                                </>
                              )}
                            </span>
                            
                            <span style={{ fontSize: "9px", color: theme.textSecondary }}>
                              #{index + 1}
                            </span>
                          </div>

                          <p style={{ margin: 0, fontSize: "11.5px", color: themeMode === "dark" ? "#CBD5E1" : "#334155", lineHeight: 1.4 }}>
                            "{item.text}"
                          </p>
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: HEURISTIC SIGNALS */}
        {activeTab === "signals" && (
          <div style={{ animation: "fadeIn 0.25s ease-out", display: "flex", flexDirection: "column", gap: "12px" }}>
            {!hasProduct ? (
              <div style={{ textAlign: "center", padding: "48px 16px", color: theme.textSecondary }}>
                <CheckCircle2 size={28} color={theme.teal} style={{ marginBottom: "12px" }} />
                <div style={{ fontSize: "13px", fontWeight: 600, color: theme.textPrimary }}>No Product Active</div>
                <p style={{ fontSize: "11px", margin: "6px 0 0 0" }}>Navigate to an Amazon product listing to detect suspicious patterns.</p>
              </div>
            ) : (
              <>
                <h3 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 4px 0", color: theme.textPrimary }}>
                  Anomalies Detected
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {displaySignals.map((signal, index) => (
                    <div
                      key={index}
                      style={{
                        background: theme.cardBg,
                        border: theme.border,
                        borderRadius: "10px",
                        padding: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        transition: "background 0.3s ease"
                      }}
                    >
                      <AlertTriangle size={16} color={theme.amber} style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: "12px", color: themeMode === "dark" ? "#CBD5E1" : "#334155" }}>{signal}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 4: SETTINGS */}
        {activeTab === "settings" && (
          <div style={{ animation: "fadeIn 0.25s ease-out", display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* Input Config */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", color: theme.textSecondary, fontWeight: 700, textTransform: "uppercase" }}>
                FastAPI Host Endpoint
              </label>

              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  style={{
                    flex: 1,
                    background: theme.inputBg,
                    border: "1px solid rgba(128,128,128,0.2)",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontSize: "13px",
                    color: theme.textPrimary,
                    outline: "none"
                  }}
                />

                <button
                  onClick={handleSaveSettings}
                  style={{
                    background: theme.teal,
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 14px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: themeMode === "dark" ? theme.tealGlow : "none"
                  }}
                >
                  Save
                </button>
              </div>
            </div>

            {/* Diagnostics Panel */}
            <div
              style={{
                background: theme.cardBg,
                border: theme.border,
                borderRadius: "12px",
                padding: "14px",
                fontSize: "12px",
                transition: "background 0.3s ease"
              }}
            >
              <h4 style={{ margin: "0 0 10px 0", fontWeight: 600 }}>Diagnostics Info</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: theme.textSecondary }}>Connection:</span>
                  <span style={{ color: isApiConnected ? "#10B981" : theme.red, fontWeight: 700 }}>
                    {isApiConnected ? "ONLINE" : "OFFLINE"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: theme.textSecondary }}>Backend Model:</span>
                  <span>DeBERTa-v3 Base</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: theme.textSecondary }}>Active Mode:</span>
                  <span>{themeMode === "dark" ? "Dark Space" : "Cyber Light"}</span>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Navigation Navbar (Sticky at bottom) */}
      <div
        style={{
          borderTop: theme.border,
          display: "flex",
          justifyContent: "space-between",
          padding: "8px 16px",
          background: theme.headerBg,
          transition: "background 0.3s ease"
        }}
      >
        <button
          onClick={() => setActiveTab("overview")}
          style={{
            background: "none",
            border: "none",
            color: activeTab === "overview" ? theme.tabActiveColor : theme.textSecondary,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            fontSize: "10px",
            fontWeight: 600,
            cursor: "pointer",
            width: "70px",
            transition: "color 0.2s"
          }}
        >
          <BarChart2 size={18} />
          Overview
        </button>

        <button
          onClick={() => setActiveTab("reviews")}
          style={{
            background: "none",
            border: "none",
            color: activeTab === "reviews" ? theme.tabActiveColor : theme.textSecondary,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            fontSize: "10px",
            fontWeight: 600,
            cursor: "pointer",
            width: "70px",
            transition: "color 0.2s"
          }}
        >
          <List size={18} />
          AI Reviews
        </button>

        <button
          onClick={() => setActiveTab("signals")}
          style={{
            background: "none",
            border: "none",
            color: activeTab === "signals" ? theme.tabActiveColor : theme.textSecondary,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            fontSize: "10px",
            fontWeight: 600,
            cursor: "pointer",
            width: "70px",
            transition: "color 0.2s"
          }}
        >
          <AlertTriangle size={18} />
          Signals
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          style={{
            background: "none",
            border: "none",
            color: activeTab === "settings" ? theme.tabActiveColor : theme.textSecondary,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            fontSize: "10px",
            fontWeight: 600,
            cursor: "pointer",
            width: "70px",
            transition: "color 0.2s"
          }}
        >
          <Settings size={18} />
          Settings
        </button>
      </div>

      {/* Embedded CSS Animations & Global HTML/Body Resets */}
      <style>{`
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: ${themeMode === "dark" ? "#030712" : "#F8FAFC"};
          overflow: hidden;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        /* Premium custom scrollbar styling */
        ::-webkit-scrollbar {
          width: 5px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(128, 128, 128, 0.2);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(128, 128, 128, 0.4);
        }
      `}</style>
    </div>
  )
}

export default IndexPopup