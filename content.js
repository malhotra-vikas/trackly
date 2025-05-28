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

    // Create Trackly button immediately
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

// Function to create the Trackly button - SIMPLIFIED
function createTracklyButton(asin) {
  console.log("Trackly: Creating button for ASIN:", asin)

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
    font-family: Arial, sans-serif;
  `

  // Add click handler
  toggleButton.addEventListener("click", () => {
    alert(`Trackly button clicked for ASIN: ${asin}`)
  })

  // Add to page after a delay
  setTimeout(() => {
    document.body.appendChild(toggleButton)
    console.log("Trackly: Button added to page")
  }, 3000)
}

console.log("Trackly: Content script ready")
