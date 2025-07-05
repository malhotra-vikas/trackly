// This file includes the Supabase JavaScript client from CDN
// It will be loaded before our supabase-client.js file

; (() => {
    // Create a script element
    const script = document.createElement("script")
    script.onload = () => {
        console.log("Supabase client loaded")
        // Create a global variable for the Supabase client
        window.supabaseClient = window.supabase // Declare the variable before using it
    }
    script.onerror = () => {
        console.error("Failed to load Supabase client")
    }

    // Append the script to the document
    document.head.appendChild(script)
})()
