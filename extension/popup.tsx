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

  // Load and test connection
  const checkConnection = async (targetUrl: string) => {
    try {
      const response = await axios.get(`${targetUrl}/api/health`, { timeout: 2000 })
      if (response.data?.status === "healthy") {
        setIsApiConnected(true)
        return true
      }
      setIsApiConnected(false)
      return false
    } catch {
      setIsApiConnected(false)
      return false
    }
  }

  // Request prediction from FastAPI
  const runModelAnalysis = async (reviewsToAnalyze: string[], targetUrl: string) => {
    if (!reviewsToAnalyze || reviewsToAnalyze.length === 0) return
    setIsAnalyzing(true)
    
    // Check connection first
    const isOnline = await checkConnection(targetUrl)
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
      const response = await axios.post(`${targetUrl}/api/analyze`, {
        reviews: reviewsToAnalyze
      }, { timeout: 12000 })
      
      const { score, risk, fake_count, details } = response.data
      setModelResult({
        score,
        risk,
        fakeCount: fake_count,
        details: details || [],
        isAiPowered: true
      })
    } catch (error) {
      console.error("AI inference request failed, utilizing heuristic fallback:", error)
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

  // Scrape page dynamically via message parsing
  const handleReload = () => {
    if (typeof chrome === "undefined" || !chrome.tabs) return
    setIsScraping(true)
    setIsAnalyzing(true)
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "scrape" }, (response) => {
          // Allow some time for content scripts to execute and write to storage
          setTimeout(() => {
            chrome.storage.local.get(
              ["currentProduct", "currentSite", "rating", "reviewCount", "reviews"],
              (result) => {
                setProduct(result.currentProduct || "No Product Found")
                setSite(result.currentSite || "Unknown Site")
                setRating(result.rating || "N/A")
                setReviewCount(result.reviewCount || "0")
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
          }, 1200)
        })
      } else {
        setIsScraping(false)
        setIsAnalyzing(false)
      }
    })
  }

  // Load settings and data from local storage
  useEffect(() => {
    try {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        setProduct("No Product Found")
        setSite("Unknown Site")
        return
      }

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

          setProduct(result.currentProduct || "No Product Found")
          setSite(result.currentSite || "Unknown Site")
          setRating(result.rating || "N/A")
          setReviewCount(result.reviewCount || "0")

          const fetchedReviews = result.reviews || []
          setReviews(fetchedReviews)

          if (fetchedReviews.length > 0) {
            runModelAnalysis(fetchedReviews, savedUrl)
          }
        }
      )

      // Listen for updates dynamically as user scrolls
      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        if (areaName === "local") {
          if (changes.currentProduct) setProduct(changes.currentProduct.newValue || "No Product Found")
          if (changes.currentSite) setSite(changes.currentSite.newValue || "Unknown Site")
          if (changes.rating) setRating(changes.rating.newValue || "N/A")
          if (changes.reviewCount) setReviewCount(changes.reviewCount.newValue || "0")
          
          if (changes.reviews) {
            const newReviews = changes.reviews.newValue || []
            setReviews(newReviews)
            
            // Re-fetch custom apiUrl config to ensure consistency
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
  const score = isAiActive ? modelResult.score : heuristicResult.score
  const risk = isAiActive ? modelResult.risk : heuristicResult.risk

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
  const displaySignals = [...heuristicResult.signals]
  if (isAiActive && modelResult) {
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
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ apiUrl }, () => {
        checkConnection(apiUrl)
        if (reviews.length > 0) {
          runModelAnalysis(reviews, apiUrl)
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
                  gap: "8px",
                  alignItems: "flex-start"
                }}
              >
                <AlertTriangle size={16} color={themeMode === "dark" ? "#60A5FA" : "#2563EB"} style={{ flexShrink: 0, marginTop: "1px" }} />
                <div>
                  <strong>No reviews scraped yet.</strong> Scroll down the Amazon page to load customer reviews, or click the reload button 🔄 above.
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
                    border: `6px solid ${styles.color}`,
                    boxShadow: themeMode === "dark" ? `inset 0 0 10px ${styles.color}18, 0 0 10px ${styles.color}0c` : "none",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    margin: "0 auto 16px auto",
                    transition: "all 0.3s ease"
                  }}
                >
                  <span style={{ fontSize: "34px", fontWeight: 800, color: styles.color }}>
                    {score}%
                  </span>
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

              {/* Quick AI Backup warning */}
              {!isAiActive && (
                <div
                  style={{
                    fontSize: "10px",
                    color: theme.amber,
                    marginTop: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px"
                  }}
                >
                  <ServerCrash size={11} />
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
          </div>
        )}

        {/* TAB 2: DETAILED REVIEWS LIST */}
        {activeTab === "reviews" && (
          <div style={{ animation: "fadeIn 0.25s ease-out", display: "flex", flexDirection: "column", gap: "12px", height: "100%" }}>
            
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
          </div>
        )}

        {/* TAB 3: HEURISTIC SIGNALS */}
        {activeTab === "signals" && (
          <div style={{ animation: "fadeIn 0.25s ease-out", display: "flex", flexDirection: "column", gap: "12px" }}>
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

            {/* Help instructions */}
            <div style={{ fontSize: "11px", color: theme.textSecondary, lineHeight: 1.4 }}>
              <strong>Setup Instructions:</strong> Ensure your local python environment is active and running the backend script (`python app/main.py`) before saving.
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