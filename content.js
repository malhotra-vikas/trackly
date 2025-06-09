// Content script for Trackly - Enhanced ASIN extraction with indicators and overlay

console.log("Trackly: Content script loaded on:", window.location.href)

// Check if we're on Amazon
if (window.location.hostname.includes("amazon.com")) {
  console.log("Trackly: On Amazon page")

  // Create visual indicator
  const indicator = document.createElement("div")
  indicator.textContent = "Dottie Loaded!"
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
        indicator.textContent = "Dottie Connected!"
        indicator.style.background = "#10B981"
      } else {
        console.log("Trackly: No background response")
        indicator.textContent = "Dottie Error"
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
    }, 1000)

    // Create Trackly button
    createTracklyButton(asin)
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

async function getKeys() {
  return await chrome.storage.local.get([
    "supabaseUrl",
    "supabaseKey",
    "keepaKey",
    "openAIApiKey",
    "firebaseApiKey",
    "firebaseAppId",
    "firebaseAuthDomain",
    "firebaseMeasurementId",
    "firebaseMessagingSenderId",
    "firebaseProjectId",
    "firebaseStorageBucketId"
  ])
}

async function callOpenAI(asin, title, price, priceHistory) {
  const lowest = Math.min(...priceHistory).toFixed(2);
  const highest = Math.max(...priceHistory).toFixed(2);

  const prompt = `The user is thinking about purchasing the product with Amazon ASIN: ${asin}. 
    The title of this product is "${title}". The product is currently listed for sale at $${price}.
    Here is the last 12 month price history for this product: ${JSON.stringify(priceHistory)}.
    In the last 12 months, the lowest price for the item is $${lowest}.
    In the last 12 months, the higest price for the item is $${highest}.
    
    Deal Signal is Green if the current price is ≤ 10% above the lowest.
    Deal Signal is Yellow if the current proce is > 10% above the lowest but ≤ 70% of the highest
    Deal Signal is Red if the current price is > 70% of the highest
    
    Analyze this data as an Expert Shopper and give me your recommendation in 20 words or less to describe if this is the right time to buy or shoud the user wait to make a purchase.
    The recomemndation tone needs to be Calm, smart, and clear — no jargon, no hype, no hyperbole.
    Some sample recommendations are "Current Proce seems great, recommend buying", 
    "Current price seems high, considering the recent proce choppiness and the last 12 months of lowest and highest prices",
    "Current price seems very high. Recommend waiting, unless you need this now", etc
    
    `

  try {
    const keys = await getKeys();
    console.log("Trackly: AI Prompt ", prompt)
    console.log("Trackly: AI Prompt Runing with A{I Key ", keys.openAIApiKey)

    if (!keys.openAIApiKey) throw new Error("OpenAI key missing");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${keys.openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Trackly: OpenAI response error:", errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Trackly: AI Response", data);
    return data.choices?.[0]?.message?.content || "No AI recommendation available.";
  } catch (err) {
    console.error("Trackly: AI call failed", err);
    return "No AI recommendation available. Try again later or rely on price history.";
  }
}

// Function to extract product details
function extractProductDetails(asin) {
  console.log("Trackly: Extracting product details for ASIN:", asin)

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
      console.log("Trackly: Title found:", title.substring(0, 50) + "...")
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
        console.log("Trackly: Price found:", price)
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
      console.log("Trackly: Image found:", imageUrl.substring(0, 50) + "...")
      break
    }
  }

  const productDetails = {
    asin,
    title: title || `Product ${asin}`,
    price: price || 0,
    imageUrl,
    url: window.location.href,
  }

  console.log("Trackly: Product details extracted:", productDetails)
  return productDetails
}

// Function to create the Trackly button
function createTracklyButton(asin) {
  console.log("Trackly: Creating button for ASIN:", asin)

  // Create toggle button
  const toggleButton = document.createElement("button")
  toggleButton.id = "trackly-toggle-button"
  toggleButton.textContent = `Dottie (${asin})`
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

  // Add to page after a delay
  setTimeout(() => {
    document.body.appendChild(toggleButton)
    console.log("Trackly: Button added to page")
  }, 2000)
}

// Function to create and toggle the overlay
function toggleOverlay(asin) {
  console.log("Trackly: Toggle overlay called for ASIN:", asin)

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
      bottom: 80px;
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

    // Add error handler for iframe
    iframe.onerror = (error) => {
      console.error("Trackly: Iframe error:", error)
    }

    overlayContainer.appendChild(iframe)
    document.body.appendChild(overlayContainer)

    // Update button
    toggleButton.textContent = "Close Dottie"
    toggleButton.style.backgroundColor = "#EF4444"

    // Send product details to iframe when loaded
    iframe.addEventListener("load", () => {
      console.log("Trackly: Iframe loaded, sending product details")
      const productDetails = extractProductDetails(asin)

      // Try fetching cached price history first
      chrome.runtime.sendMessage({ type: "GET_PRICE_HISTORY", asin }, async (response) => {
        console.log("Trackly: Fetching Cached price history ", response)

        if (response && response.success) {
          productDetails.priceHistory = response.data
          console.log("Trackly: Cached price history added to productDetails")
        } else {
          console.warn("Trackly: No cached price history found")
        }

        console.log("Trackly: Before calling AI ")

        const aiRecommendation = await callOpenAI(asin, productDetails.title, productDetails.price, productDetails.priceHistory)
        console.log("Trackly:  AI Recommendation ", aiRecommendation)


        if (aiRecommendation) {
          productDetails.buyRecommendation = aiRecommendation
        }

        setTimeout(() => {
          try {
            console.log("Trackly: Sending product details to iframe ", productDetails)
            iframe.contentWindow.postMessage(
              {
                type: "PRODUCT_DETAILS",
                productDetails,
              },
              "*",
            )
          } catch (error) {
            console.error("Trackly: Error sending message to iframe:", error)
          }
        }, 500)
      })

    })

    console.log("Trackly: Overlay created")
  } else {
    // Toggle existing overlay
    if (overlayContainer.style.display === "none") {
      overlayContainer.style.display = "block"
      toggleButton.textContent = "Close Dottie"
      toggleButton.style.backgroundColor = "#EF4444"
      console.log("Trackly: Overlay shown")
    } else {
      overlayContainer.style.display = "none"
      toggleButton.textContent = `Dottie (${asin})`
      toggleButton.style.backgroundColor = "#4F46E5"
      console.log("Trackly: Overlay hidden")
    }
  }
}

// Listen for messages from the iframe
window.addEventListener("message", (event) => {
  // Make sure the message is from our iframe
  if (event.source !== document.getElementById("trackly-iframe")?.contentWindow) return

  const { type, data } = event.data
  console.log("Trackly: Received message from iframe:", type)

  if (type === "CLOSE_OVERLAY") {
    const overlayContainer = document.getElementById("trackly-overlay-container")
    const toggleButton = document.getElementById("trackly-toggle-button")

    if (overlayContainer) {
      overlayContainer.style.display = "none"
    }

    if (toggleButton) {
      const asinMatch = window.location.href.match(/\/dp\/([A-Z0-9]{10})/)
      const asin = asinMatch ? asinMatch[1] : null
      toggleButton.textContent = asin ? `Dottie (${asin})` : "Dottie"
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

console.log("Trackly: Content script ready")
