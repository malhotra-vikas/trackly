import { Chart } from "@/components/ui/chart"
// Analytics dashboard script

// Target values (replace with your actual targets)
const TARGETS = {
  totalInstalls: 1000,
  newUsers30Days: 300,
  priceChartEngagement: 60, // percentage
  aiInsightEngagement: 40, // percentage
  productsWatchlisted: 5000,
}

// Initialize dashboard
async function initDashboard() {
  // Try to get data from Supabase first
  try {
    if (window.tracklySupabase) {
      const supabaseData = await window.tracklySupabase.getAnalyticsFromSupabase()
      if (supabaseData && supabaseData.metrics) {
        renderDashboard(supabaseData)
        return
      }
    }
  } catch (error) {
    console.error("Error fetching data from Supabase:", error)
    // Fall back to local data
  }

  // Fall back to local data
  if (window.tracklyAnalytics) {
    const analytics = await window.tracklyAnalytics.getAnalytics()
    const rates = window.tracklyAnalytics.calculateEngagementRates(analytics)
    renderDashboard({ metrics: analytics.metrics, events: analytics.events, rates })
  } else {
    console.error("Analytics not available")
  }
}

function renderDashboard(data) {
  const { metrics, events, rates } = data

  // If rates not provided, calculate them
  const engagementRates =
    rates ||
    (window.tracklyAnalytics
      ? window.tracklyAnalytics.calculateEngagementRates({ metrics })
      : {
        priceChartEngagementRate: "0.00",
        aiInsightEngagementRate: "0.00",
        productToChartViewRate: "0.00",
      })

  // Convert uniqueProductsWatchlisted back to a Set if it's an array
  if (Array.isArray(metrics.uniqueProductsWatchlisted)) {
    metrics.uniqueProductsWatchlistedCount =
      metrics.uniqueProductsWatchlistedCount || metrics.uniqueProductsWatchlisted.length
  } else if (metrics.uniqueProductsWatchlisted instanceof Set) {
    metrics.uniqueProductsWatchlistedCount = metrics.uniqueProductsWatchlisted.size
  }

  // Update installation metrics
  document.getElementById("total-installs").textContent = metrics.totalInstalls
  document.getElementById("new-users").textContent = metrics.newUsersLast30Days

  // Update price chart metrics
  document.getElementById("price-chart-rate").textContent = `${engagementRates.productToChartViewRate}%`
  document.getElementById("price-chart-engagement").textContent = `${engagementRates.priceChartEngagementRate}%`

  // Update AI insight metrics
  document.getElementById("ai-insight-views").textContent = metrics.aiInsightViews
  document.getElementById("ai-insight-engagement").textContent = `${engagementRates.aiInsightEngagementRate}%`

  // Update watchlist metrics
  document.getElementById("products-watchlisted").textContent = metrics.productsWatchlisted
  document.getElementById("unique-products").textContent = metrics.uniqueProductsWatchlistedCount || 0

  // Update progress bars
  updateProgressBar("installs-progress", "installs-progress-value", metrics.totalInstalls, TARGETS.totalInstalls)

  updateProgressBar(
    "chart-progress",
    "chart-progress-value",
    Number.parseFloat(engagementRates.priceChartEngagementRate),
    TARGETS.priceChartEngagement,
  )

  updateProgressBar(
    "ai-progress",
    "ai-progress-value",
    Number.parseFloat(engagementRates.aiInsightEngagementRate),
    TARGETS.aiInsightEngagement,
  )

  updateProgressBar(
    "watchlist-progress",
    "watchlist-progress-value",
    metrics.uniqueProductsWatchlistedCount || 0,
    TARGETS.productsWatchlisted,
  )

  // Render activity chart
  renderActivityChart(events)
}

// Update progress bar
function updateProgressBar(barId, valueId, current, target) {
  const percentage = Math.min(Math.round((current / target) * 100), 100)
  document.getElementById(barId).style.width = `${percentage}%`
  document.getElementById(valueId).textContent = `${percentage}%`

  // Change color based on progress
  const bar = document.getElementById(barId)
  if (percentage < 30) {
    bar.style.backgroundColor = "#ef4444" // red
  } else if (percentage < 70) {
    bar.style.backgroundColor = "#f59e0b" // yellow/orange
  } else {
    bar.style.backgroundColor = "#10b981" // green
  }
}

// Render activity chart
function renderActivityChart(events) {
  // Group events by day
  const eventsByDay = {}
  const now = new Date()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Initialize all days with zero counts
  for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0]
    eventsByDay[dateStr] = {
      productViews: 0,
      chartViews: 0,
      aiInteractions: 0,
      watchlistAdds: 0,
    }
  }

  // Count events by day and type
  events.forEach((event) => {
    const eventDate = new Date(event.timestamp)
    if (eventDate >= thirtyDaysAgo) {
      const dateStr = eventDate.toISOString().split("T")[0]

      if (event.category === "product" && event.action === "view") {
        eventsByDay[dateStr].productViews++
      } else if (event.category === "priceChart" && event.action === "view") {
        eventsByDay[dateStr].chartViews++
      } else if (event.category === "aiInsight" && event.action === "interact") {
        eventsByDay[dateStr].aiInteractions++
      } else if (event.category === "watchlist" && event.action === "add") {
        eventsByDay[dateStr].watchlistAdds++
      }
    }
  })

  // Prepare data for chart
  const labels = Object.keys(eventsByDay).sort()
  const productViewsData = labels.map((date) => eventsByDay[date].productViews)
  const chartViewsData = labels.map((date) => eventsByDay[date].chartViews)
  const aiInteractionsData = labels.map((date) => eventsByDay[date].aiInteractions)
  const watchlistAddsData = labels.map((date) => eventsByDay[date].watchlistAdds)

  // Format labels to be more readable
  const formattedLabels = labels.map((date) => {
    const [year, month, day] = date.split("-")
    return `${month}/${day}`
  })

  // Create chart
  const ctx = document.getElementById("activity-chart").getContext("2d")
  new Chart(ctx, {
    type: "line",
    data: {
      labels: formattedLabels,
      datasets: [
        {
          label: "Product Views",
          data: productViewsData,
          borderColor: "#4f46e5",
          backgroundColor: "rgba(79, 70, 229, 0.1)",
          tension: 0.1,
        },
        {
          label: "Chart Views",
          data: chartViewsData,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          tension: 0.1,
        },
        {
          label: "AI Interactions",
          data: aiInteractionsData,
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.1)",
          tension: 0.1,
        },
        {
          label: "Watchlist Adds",
          data: watchlistAddsData,
          borderColor: "#ef4444",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          tension: 0.1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
        },
        tooltip: {
          mode: "index",
          intersect: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
        },
      },
    },
  })
}

// Initialize dashboard when page loads
document.addEventListener("DOMContentLoaded", () => {
  // Load Chart.js
  const script = document.createElement("script")
  script.src = "https://cdn.jsdelivr.net/npm/chart.js"
  script.onload = () => {
    console.log("Chart.js loaded")
    initDashboard()
  }
  document.head.appendChild(script)
})
