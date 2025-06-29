import { loginWithCustomToken } from './firebase-service.js';

async function getFirebaseSecrets() {
    const { fetchSecrets } = globalThis.tracklyKeys;
    const secrets = await fetchSecrets();
    return secrets.firebaseConfig;
}


document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize Firebase
        const firebaseService = window.firebaseService;
        if (!firebaseService) {
            throw new Error('Firebase service not available');
        }

        await firebaseService.initializeFirebase();
        console.log('Firebase ready');

        // Get form elements
        const signinForm = document.getElementById('signin-form');
        const signupForm = document.getElementById('signup-form');
        const showSignupLink = document.getElementById('show-signup');
        const showSigninLink = document.getElementById('show-signin');

        // Debug logging
        console.log('Forms found:', {
            signinForm: !!signinForm,
            signupForm: !!signupForm,
            showSignupLink: !!showSignupLink,
            showSigninLink: !!showSigninLink
        });

        // Toggle form visibility
        showSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            signinForm.style.display = 'none';
            signupForm.style.display = 'block';
        });

        showSigninLink.addEventListener('click', (e) => {
            e.preventDefault();
            signupForm.style.display = 'none';
            signinForm.style.display = 'block';
        });

        // Handle sign up
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const button = document.getElementById('signup-button');
            const errorElement = document.getElementById('signup-error');

            try {
                button.classList.add('loading');
                button.disabled = true;

                const email = document.getElementById('signup-email').value;
                const password = document.getElementById('signup-password').value;

                console.log('Starting sign up process');
                const result = await firebaseService.signUp(email, password);

                if (result.success) {
                    console.log('Sign up successful');
                    await chrome.storage.local.set({
                        user: {
                            uid: result.user.uid,
                            email: result.user.email
                        }
                    });
                    window.close();
                } else {
                    errorElement.textContent = result.error;
                }
            } catch (error) {
                console.error('Sign up error:', error);
                errorElement.textContent = error.message;
            } finally {
                button.classList.remove('loading');
                button.disabled = false;
            }
        });

        // Handle sign in
        signinForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const button = document.getElementById('signin-button');
            const errorElement = document.getElementById('signin-error');

            try {
                button.classList.add('loading');
                button.disabled = true;

                const email = document.getElementById('signin-email').value;
                const password = document.getElementById('signin-password').value;

                console.log('Starting sign in process');


                const res = await fetch('http://13.222.142.175:3001/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                if (!res.ok) {
                    const { error } = await res.json();
                    errorElement.textContent = error || 'Login failed';
                    return;
                }

                const { token, user } = await res.json();
                const userCred = await loginWithCustomToken(token);

                console.log('✅ Signed in:', userCred.user);


                if (result.success) {
                    console.log('Sign in successful');
                    await chrome.storage.local.set({
                        user: {
                            uid: user.uid,
                            email: user.email
                        }
                    });
                    window.close();
                } else {
                    errorElement.textContent = result.error;
                }
            } catch (error) {
                console.error('Sign in error:', error);
                errorElement.textContent = error.message;
            } finally {
                button.classList.remove('loading');
                button.disabled = false;
            }
        });
    } catch (error) {
        console.error('Initialization error:', error);
        const errorElement = document.getElementById('signin-error');
        if (errorElement) {
            errorElement.textContent = `Service unavailable: ${error.message}`;
        }
    }
});
