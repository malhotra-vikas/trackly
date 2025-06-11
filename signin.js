// signin.js
async function getFirebaseSecrets() {
    const { fetchSecrets } = globalThis.tracklyKeys;
    const secrets = await fetchSecrets();
    return secrets.firebaseConfig;
}

async function initFirebaseAuth() {
    try {
        const firebaseConfig = await getFirebaseSecrets();
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);

        document.getElementById("google-signin").addEventListener("click", async () => {
            const provider = new GoogleAuthProvider();
            try {
                const result = await signInWithPopup(auth, provider);
                console.log("Google sign-in success:", result.user);
                chrome.runtime.sendMessage({ type: "USER_LOGGED_IN", user: result.user });
                window.close();
            } catch (err) {
                console.error("Google sign-in failed:", err);
            }
        });

        document.getElementById("facebook-signin").addEventListener("click", async () => {
            const provider = new FacebookAuthProvider();
            try {
                const result = await signInWithPopup(auth, provider);
                console.log("Facebook sign-in success:", result.user);
                chrome.runtime.sendMessage({ type: "USER_LOGGED_IN", user: result.user });
                window.close();
            } catch (err) {
                console.error("Facebook sign-in failed:", err);
            }
        });

        console.log("Trackly: Firebase Auth initialized successfully");
    } catch (error) {
        console.error("Trackly: Failed to initialize Firebase Auth:", error);
    }
}

document.addEventListener("DOMContentLoaded", initFirebaseAuth);
