// Content script for Trackly - Enhanced ASIN extraction with better debugging

// Function to extract ASIN from various Amazon page types
function extractAsin() {
  const url = window.location.href
  console.log("Trackly: Extracting ASIN from URL:", url)

  // Method 1: Extract from URL patterns
  // Product detail pages: /dp/ASIN or /gp/product/ASIN
  let asinMatch = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/)
  if (asinMatch) {
    console.log("Trackly: ASIN found in URL:", asinMatch[1])
    return asinMatch[1]
  }

  // Search results and other pages with ASIN in URL parameters
  asinMatch = url.match(/[?&]asin=([A-Z0-9]{10})/)
  if (asinMatch) {
    console.log("Trackly: ASIN found in URL parameters:", asinMatch[1])
    return asinMatch[1]
  }

  // Method 2: Extract from page content
  // Look for ASIN in meta tags
  const asinMeta = document.querySelector('meta[name="keywords"]')
  if (asinMeta) {
    const content = asinMeta.getAttribute("content")
    asinMatch = content.match(/([A-Z0-9]{10})/)
    if (asinMatch) {
      console.log("Trackly: ASIN found in meta keywords:", asinMatch[1])
      return asinMatch[1]
    }
  }

  // Look for ASIN in data attributes
  const asinDataElements = document.querySelectorAll("[data-asin]")
  if (asinDataElements.length > 0) {
    const asin = asinDataElements[0].getAttribute("data-asin")
    if (asin && asin.match(/^[A-Z0-9]{10}$/)) {
      console.log("Trackly: ASIN found in data-asin attribute:", asin)
      return asin
    }
  }

  // Look for ASIN in product links on the page
  const productLinks = document.querySelectorAll('a[href*="/dp/"], a[href*="/gp/product/"]')
  if (productLinks.length > 0) {
    for (const link of productLinks) {
      const href = link.getAttribute("href")
      asinMatch = href.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/)
      if (asinMatch) {
        console.log("Trackly: ASIN found in product link:", asinMatch[1])
        return asinMatch[1]
      }
    }
  }

  // Method 3: Extract from JavaScript variables (if available)
  try {
    // Amazon sometimes stores ASIN in global variables
    if (window.ue_pti && window.ue_pti.indexOf("ASIN:") !== -1) {
      asinMatch = window.ue_pti.match(/ASIN:([A-Z0-9]{10})/)
      if (asinMatch) {
        console.log("Trackly: ASIN found in ue_pti:", asinMatch[1])
        return asinMatch[1]
      }
    }

    // Check for other Amazon global variables
    if (window.P && window.P.register) {
      // Sometimes ASIN is in P.register calls
      const scripts = document.querySelectorAll("script")
      for (const script of scripts) {
        if (script.textContent && script.textContent.includes("P.register")) {
          asinMatch = script.textContent.match(/"asin":"([A-Z0-9]{10})"/)
          if (asinMatch) {
            console.log("Trackly: ASIN found in P.register:", asinMatch[1])
            return asinMatch[1]
          }
        }
      }
    }
  } catch (error) {
    console.log("Trackly: Error accessing window variables:", error)
  }

  // Method 4: Extract from form inputs (for pages with hidden ASIN fields)
  const asinInputs = document.querySelectorAll('input[name*="asin"], input[value*="ASIN"]')
  if (asinInputs.length > 0) {
    for (const input of asinInputs) {
      const value = input.value
      asinMatch = value.match(/([A-Z0-9]{10})/)
      if (asinMatch) {
        console.log("Trackly: ASIN found in form input:", asinMatch[1])
        return asinMatch[1]
      }
    }
  }

  // Method 5: Look for ASIN in JSON-LD structured data
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]')
  for (const script of jsonLdScripts) {
    try {
      const data = JSON.parse(script.textContent)
      if (data.sku && data.sku.match(/^[A-Z0-9]{10}$/)) {
        console.log("Trackly: ASIN found in JSON-LD sku:", data.sku)
        return data.sku
      }
      if (data.productID && data.productID.match(/^[A-Z0-9]{10}$/)) {
        console.log("Trackly: ASIN found in JSON-LD productID:", data.productID)
        return data.productID
      }
    } catch (error) {
      // Ignore JSON parsing errors
    }
  }

  console.log("Trackly: No ASIN found on this page")
  return null
}

// Function to extract multiple ASINs from a page (useful for search results, lists, etc.)
function extractAllAsins() {
  const asins = new Set()
  const url = window.location.href

  // Extract from URL
  const mainAsin = extractAsin()
  if (mainAsin) {
    asins.add(mainAsin)
  }

  // Extract from all product links on the page
  const productLinks = document.querySelectorAll('a[href*="/dp/"], a[href*="/gp/product/"]')
  productLinks.forEach((link) => {
    const href = link.getAttribute("href")
    const asinMatch = href.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/)
    if (asinMatch) {
      asins.add(asinMatch[1])
    }
  })

  // Extract from data attributes
  const asinDataElements = document.querySelectorAll("[data-asin]")
  asinDataElements.forEach((element) => {
    const asin = element.getAttribute("data-asin")
    if (asin && asin.match(/^[A-Z0-9]{10}$/)) {
      asins.add(asin)
    }
  })

  // Extract from data-product-id attributes (common in Amazon)
  const productIdElements = document.querySelectorAll("[data-product-id]")
  productIdElements.forEach((element) => {
    const productId = element.getAttribute("data-product-id")
    if (productId && productId.match(/^[A-Z0-9]{10}$/)) {
      asins.add(productId)
    }
  })

  return Array.from(asins)
}

// Detect different types of Amazon pages
function getPageType() {
  const url = window.location.href
  const pathname = window.location.pathname

  if (pathname.includes("/dp/") || pathname.includes("/gp/product/")) {
    return "product"
  } else if (pathname.includes("/s/") || url.includes("k=") || url.includes("field-keywords=")) {
    return "search"
  } else if (pathname.includes("/gp/bestsellers/")) {
    return "bestsellers"
  } else if (pathname.includes("/gp/new-releases/")) {
    return "new-releases"
  } else if (pathname.includes("/gp/movers-and-shakers/")) {
    return "movers-shakers"
  } else if (pathname.includes("/gp/most-wished-for/")) {
    return "wishlist"
  } else if (pathname.includes("/gp/cart/")) {
    return "cart"
  } else if (pathname.includes("/gp/aws/cart/")) {
    return "cart"
  } else if (pathname.includes("/hz/wishlist/")) {
    return "wishlist"
  } else if (pathname.includes("/gp/browse.html")) {
    return "browse"
  } else if (pathname.includes("/stores/")) {
    return "store"
  }

  return "other"
}

// Check if we're on an Amazon domain
function isAmazonPage() {
  return (
    window.location.hostname.includes("amazon.com") ||
    window.location.hostname.includes("amazon.") ||
    window.location.hostname.includes("amzn.")
  )
}

// Detect if we're on a product page specifically
function isProductPage() {
  return getPageType() === "product"
}

// Extract product details from the page (enhanced)
function extractProductDetails() {
  const asin = extractAsin()

  // Try multiple selectors for title
  let title = null
  const titleSelectors = [
    "#productTitle",
    ".product-title",
    '[data-automation-id="product-title"]',
    "h1.a-size-large",
    "h1 span",
  ]

  for (const selector of titleSelectors) {
    const element = document.querySelector(selector)
    if (element && element.textContent.trim()) {
      title = element.textContent.trim()
      break
    }
  }

  // Try multiple selectors for price
  let price = null
  const priceSelectors = [
    ".a-price .a-offscreen",
    ".a-price-whole",
    '[data-automation-id="product-price"]',
    ".a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen",
    ".a-price-range .a-offscreen",
  ]

  for (const selector of priceSelectors) {
    const element = document.querySelector(selector)
    if (element && element.textContent) {
      const priceText = element.textContent
      const priceMatch = priceText.match(/[\d,]+\.?\d*/)
      if (priceMatch) {
        price = Number.parseFloat(priceMatch[0].replace(/,/g, ""))
        break
      }
    }
  }

  // Try multiple selectors for image
  let imageUrl = null
  const imageSelectors = [
    "#landingImage",
    "#imgBlkFront",
    ".a-dynamic-image",
    '[data-automation-id="product-image"]',
    ".s-image",
  ]

  for (const selector of imageSelectors) {
    const element = document.querySelector(selector)
    if (element && element.src) {
      imageUrl = element.src
      break
    }
  }

  return {
    asin,
    title,
    price,
    imageUrl,
    url: window.location.href,
    pageType: getPageType(),
  }
}

// Enhanced function to create and inject the Trackly overlay
function injectTracklyOverlay() {
  console.log("Trackly: injectTracklyOverlay called")

  // Check if we're on an Amazon page
  if (!isAmazonPage()) {
    console.log("Trackly: Not on Amazon page")
    return
  }

  const asin = extractAsin()
  const pageType = getPageType()

  console.log("Trackly: Page analysis:", {
    asin,
    pageType,
    url: window.location.href,
  })

  // Track page visit with ASIN information
  if (window.tracklyAnalytics) {
    window.tracklyAnalytics.trackEvent("page", "visit", {
      asin: asin || "none",
      pageType,
      url: window.location.href,
      hasAsin: !!asin,
    })

    // If it's a product page, track product view
    if (pageType === "product" && asin) {
      window.tracklyAnalytics.trackEvent("product", "view", {
        asin,
        url: window.location.href,
      })
    }

    // If it's a search page, track search with found ASINs
    if (pageType === "search") {
      const allAsins = extractAllAsins()
      window.tracklyAnalytics.trackEvent("search", "view", {
        asinCount: allAsins.length,
        asins: allAsins.slice(0, 10), // Track first 10 ASINs
        url: window.location.href,
      })
    }
  }

  // Check if overlay already exists
  if (document.getElementById("trackly-overlay-container")) {
    console.log("Trackly: Overlay already exists")
    return
  }

  // Create overlay container
  const overlayContainer = document.createElement("div")
  overlayContainer.id = "trackly-overlay-container"
  overlayContainer.style.position = "fixed"
  overlayContainer.style.bottom = "20px"
  overlayContainer.style.right = "20px"
  overlayContainer.style.zIndex = "9999"

  // Create iframe for the app
  const iframe = document.createElement("iframe")
  iframe.id = "trackly-iframe"
  iframe.src = window.chrome.runtime.getURL("app.html")
  iframe.style.width = "350px"
  iframe.style.height = "450px"
  iframe.style.border = "none"
  iframe.style.borderRadius = "12px"
  iframe.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)"

  overlayContainer.appendChild(iframe)
  document.body.appendChild(overlayContainer)

  // Create toggle button with ASIN info
  const toggleButton = document.createElement("button")
  toggleButton.id = "trackly-toggle-button"
  toggleButton.textContent = asin ? `Trackly (${asin})` : "Trackly"
  toggleButton.style.position = "fixed"
  toggleButton.style.bottom = "20px"
  toggleButton.style.right = "20px"
  toggleButton.style.zIndex = "10000"
  toggleButton.style.padding = "8px 16px"
  toggleButton.style.backgroundColor = asin ? "#4F46E5" : "#6B7280"
  toggleButton.style.color = "white"
  toggleButton.style.border = "none"
  toggleButton.style.borderRadius = "20px"
  toggleButton.style.fontWeight = "bold"
  toggleButton.style.cursor = "pointer"
  toggleButton.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.15)"
  toggleButton.style.fontSize = "12px"
  toggleButton.style.maxWidth = "200px"
  toggleButton.style.overflow = "hidden"
  toggleButton.style.textOverflow = "ellipsis"
  toggleButton.style.whiteSpace = "nowrap"

  toggleButton.addEventListener("click", () => {
    if (overlayContainer.style.display === "none") {
      overlayContainer.style.display = "block"
      toggleButton.textContent = "Close Trackly"
    } else {
      overlayContainer.style.display = "none"
      toggleButton.textContent = asin ? `Trackly (${asin})` : "Trackly"
    }
  })

  document.body.appendChild(toggleButton)

  // Initially hide the overlay
  overlayContainer.style.display = "none"

  console.log("Trackly: Overlay injected successfully")

  // Send product details to the iframe when it's loaded
  iframe.addEventListener("load", () => {
    console.log("Trackly: Iframe loaded, sending product details")
    const productDetails = extractProductDetails()
    iframe.contentWindow.postMessage(
      {
        type: "PRODUCT_DETAILS",
        productDetails,
      },
      "*",
    )
  })
}

// Function to monitor for dynamic content changes (for SPAs)
function observePageChanges() {
  let currentUrl = window.location.href
  let currentAsin = extractAsin()

  // Create a mutation observer to watch for changes
  const observer = new MutationObserver((mutations) => {
    // Check if URL changed (for single-page app navigation)
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href
      console.log("Trackly: URL changed, re-extracting ASIN")

      // Remove existing overlay
      const existingOverlay = document.getElementById("trackly-overlay-container")
      const existingButton = document.getElementById("trackly-toggle-button")
      if (existingOverlay) existingOverlay.remove()
      if (existingButton) existingButton.remove()

      // Re-inject overlay after a short delay
      setTimeout(injectTracklyOverlay, 1000)
    }

    // Check if ASIN changed on the same page
    const newAsin = extractAsin()
    if (newAsin !== currentAsin) {
      currentAsin = newAsin
      console.log("Trackly: ASIN changed to", newAsin)

      // Update button text
      const button = document.getElementById("trackly-toggle-button")
      if (button) {
        button.textContent = newAsin ? `Trackly (${newAsin})` : "Trackly"
        button.style.backgroundColor = newAsin ? "#4F46E5" : "#6B7280"
      }

      // Send updated product details to iframe
      const iframe = document.getElementById("trackly-iframe")
      if (iframe && iframe.contentWindow) {
        const productDetails = extractProductDetails()
        iframe.contentWindow.postMessage(
          {
            type: "PRODUCT_DETAILS",
            productDetails,
          },
          "*",
        )
      }
    }
  })

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-asin", "href"],
  })
}

// Listen for messages from the iframe
window.addEventListener("message", (event) => {
  // Make sure the message is from our iframe
  if (event.source !== document.getElementById("trackly-iframe")?.contentWindow) return

  const { type, data } = event.data

  if (type === "RESIZE_IFRAME") {
    const iframe = document.getElementById("trackly-iframe")
    if (iframe) {
      iframe.style.width = `${data.width}px`
      iframe.style.height = `${data.height}px`
    }
  }

  if (type === "REQUEST_ASIN") {
    // Send current ASIN to iframe
    const asin = extractAsin()
    const productDetails = extractProductDetails()
    event.source.postMessage(
      {
        type: "ASIN_RESPONSE",
        asin,
        productDetails,
      },
      "*",
    )
  }
})

// Debug function to log extracted information
function debugExtraction() {
  const asin = extractAsin()
  const allAsins = extractAllAsins()
  const pageType = getPageType()
  const productDetails = extractProductDetails()

  console.log("Trackly Debug Info:", {
    url: window.location.href,
    asin,
    allAsins,
    pageType,
    productDetails,
  })

  return {
    url: window.location.href,
    asin,
    allAsins,
    pageType,
    productDetails,
  }
}

// Initialize when the page is loaded
function initializeTrackly() {
  console.log("Trackly: Initializing on", window.location.href)

  // Extract and log ASIN information
  const debugInfo = debugExtraction()
  console.log("Trackly: Debug info:", debugInfo)

  // Inject overlay
  injectTracklyOverlay()

  // Start observing for changes
  observePageChanges()
}

// Initialize when the page is fully loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeTrackly)
} else {
  initializeTrackly()
}

// Also initialize when the page is fully loaded (for dynamic content)
window.addEventListener("load", () => {
  // Re-run after a delay to catch dynamically loaded content
  setTimeout(initializeTrackly, 2000)
})

// Export functions for debugging
window.tracklyDebug = {
  extractAsin,
  extractAllAsins,
  getPageType,
  extractProductDetails,
  debugExtraction,
}

console.log("Trackly: Content script loaded")
