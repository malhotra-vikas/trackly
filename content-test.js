console.log("Trackly: Content script loaded on:", window.location.href)

// Check if we're on Amazon
if (window.location.hostname.includes("amazon.com")) {
    console.log("Trackly: On Amazon page")

    // Create visual indicator
    const indicator = document.createElement("div")
    indicator.textContent = "Dotti Loaded!"
    indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #D9CFC5;
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
                indicator.textContent = "Dotti Connected!"
                indicator.style.background = "#10B981"
            } else {
                console.log("Trackly: No background response")
                indicator.textContent = "Dotti Error"
                indicator.style.background = "#EF4444"
            }
        })
    }

    // Remove indicator after 5 seconds
    setTimeout(() => {
        if (indicator.parentNode) {
            indicator.remove()
        }
    }, 5000)

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
    } else {
        console.log("Trackly: No ASIN found in URL")
    }
} else {
    console.log("Trackly: Not on Amazon page")
}
