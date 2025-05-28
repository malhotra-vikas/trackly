// Content script for Trackly - Enhanced ASIN extraction with indicators and overlay

console.log("Trackly: Content script loaded on:", window.location.href)

// Check if we're on Amazon
if (window.location.hostname.includes("amazon.com")) {
  console.log("Trackly: On Amazon page")

  // Create visual indicator
  const indicator = document.createElement("div")
  indicator.textContent = "Trackly Loaded!"
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #4F46E5;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    z-index: 99999;
    font-family: Arial, sans-serif;
    font-size: 12px;
    font-weight: bold;
  `

  document.body.appendChild(indicator)

  // Test background communication
  const chrome = window.chrome // Declare the chrome variable
  if (chrome && chrome.runtime) {
    chrome.runtime.sendMessage({ type: "PING" }, (response) => {
      if (response) {
        console.log("Trackly: Background responded:", response)
        indicator.textContent = "Trackly Connected!"
        indicator.style.background = "#10B981"
      } else {
        console.log("Trackly: No background response")
        indicator.textContent = "Trackly Error"
        indicator.style.background = "#EF4444"
      }
    })
  }

  // Extract ASIN from URL
  const asinMatch = window.location.href.match(/\/dp\/([A-Z0-9]{10})/)
  if (asinMatch) {
    const asin = asinMatch[1]
    console.log("Trackly: ASIN found:", asin)

    // Update indicator with ASIN
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.textContent = `ASIN: ${asin}`
      }
    }, 2000)

    // Create Trackly button after ASIN is detected
    setTimeout(() => {
      createTracklyButton(asin)
    }, 3000)
  } else {
    console.log("Trackly: No ASIN found in URL")
  }

  // Remove indicator after 5 seconds
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.remove()
    }
  }, 5000)
} else {
  console.log("Trackly: Not on Amazon page")
}

// Function to extract product details
function extractProductDetails(asin) {
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
    title: title || `Product ${asin}`,
    price,
    imageUrl,
    url: window.location.href,
  }
}

// Function to create the Trackly button
function createTracklyButton(asin) {
  console.log("Trackly: Creating button for ASIN:", asin)

  // Check if button already exists
  if (document.getElementById("trackly-toggle-button")) {
    console.log("Trackly: Button already exists")
    return
  }

  // Create toggle button
  const toggleButton = document.createElement("button")
  toggleButton.id = "trackly-toggle-button"
  toggleButton.textContent = `Trackly (${asin})`
  toggleButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    padding: 8px 16px;
    background-color: #4F46E5;
    color: white;
    border: none;
    border-radius: 20px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    font-size: 12px;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: Arial, sans-serif;
    transition: all 0.2s ease;
  `

  // Add hover effect
  toggleButton.addEventListener("mouseenter", () => {
    toggleButton.style.transform = "translateY(-2px)"
    toggleButton.style.backgroundColor = "#4338CA"
  })

  toggleButton.addEventListener("mouseleave", () => {
    toggleButton.style.transform = "translateY(0)"
    toggleButton.style.backgroundColor = "#4F46E5"
  })

  // Add click handler
  toggleButton.addEventListener("click", () => {
    console.log("Trackly: Button clicked")
    toggleOverlay(asin)
  })

  document.body.appendChild(toggleButton)
  console.log("Trackly: Button created successfully")
}

// Function to create and toggle the overlay
function toggleOverlay(asin) {
  const chrome = window.chrome
  let overlayContainer = document.getElementById("trackly-overlay-container")
  const toggleButton = document.getElementById("trackly-toggle-button")

  if (!overlayContainer) {
    console.log("Trackly: Creating overlay")

    // Create overlay container
    overlayContainer = document.createElement("div")
    overlayContainer.id = "trackly-overlay-container"
    overlayContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      display: block;
    `

    // Create iframe for the app
    const iframe = document.createElement("iframe")
    iframe.id = "trackly-iframe"
    iframe.src = chrome.runtime.getURL("app.html")
    iframe.style.cssText = `
      width: 350px;
      height: 450px;
      border: none;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      background: white;
    `

    overlayContainer.appendChild(iframe)
    document.body.appendChild(overlayContainer)

    // Update button
    toggleButton.textContent = "Close Trackly"
    toggleButton.style.backgroundColor = "#EF4444"

    // Send product details to iframe when loaded
    iframe.addEventListener("load", () => {
      console.log("Trackly: Iframe loaded, sending product details")
      const productDetails = extractProductDetails(asin)
      console.log("Trackly: Product details:", productDetails)

      iframe.contentWindow.postMessage(
        {
          type: "PRODUCT_DETAILS",
          productDetails,
        },
        "*",
      )
    })

    console.log("Trackly: Overlay created")
  } else {
    // Toggle existing overlay
    if (overlayContainer.style.display === "none") {
      overlayContainer.style.display = "block"
      toggleButton.textContent = "Close Trackly"
      toggleButton.style.backgroundColor = "#EF4444"
    } else {
      overlayContainer.style.display = "none"
      toggleButton.textContent = `Trackly (${asin})`
      toggleButton.style.backgroundColor = "#4F46E5"
    }
  }
}

// Listen for messages from the iframe
window.addEventListener("message", (event) => {
  // Make sure the message is from our iframe
  if (event.source !== document.getElementById("trackly-iframe")?.contentWindow) return

  const { type, data } = event.data

  if (type === "CLOSE_OVERLAY") {
    const overlayContainer = document.getElementById("trackly-overlay-container")
    const toggleButton = document.getElementById("trackly-toggle-button")

    if (overlayContainer) {
      overlayContainer.style.display = "none"
    }

    if (toggleButton) {
      const asinMatch = window.location.href.match(/\/dp\/([A-Z0-9]{10})/)
      const asin = asinMatch ? asinMatch[1] : null
      toggleButton.textContent = asin ? `Trackly (${asin})` : "Trackly"
      toggleButton.style.backgroundColor = "#4F46E5"
    }
  }

  if (type === "RESIZE_IFRAME") {
    const iframe = document.getElementById("trackly-iframe")
    if (iframe) {
      iframe.style.width = `${data.width}px`
      iframe.style.height = `${data.height}px`
    }
  }
})

// Export debug functions
window.tracklyDebug = {
  extractProductDetails,
  createTracklyButton,
  toggleOverlay,
}

console.log("Trackly: Content script ready")
