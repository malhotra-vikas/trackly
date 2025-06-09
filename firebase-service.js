class FirebaseService {
  constructor() {
    this.auth = null;
    this.initialized = false;
    this.errorMessages = {
      'auth/invalid-login-credentials': 'Invalid email or password. Please try again.',
      'auth/user-not-found': 'No account found with this email. Please sign up.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/email-already-in-use': 'An account already exists with this email. Please sign in.',
      'auth/weak-password': 'Password should be at least 6 characters long.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'default': 'An error occurred. Please try again.'
    };
  }

  getErrorMessage(error) {
    return this.errorMessages[error.code] || this.errorMessages.default;
  }

  async initializeFirebase() {
    if (this.initialized) return;

    try {
      // Get Firebase config
      const keys = await chrome.storage.local.get([
        "firebaseApiKey",
        "firebaseAuthDomain",
        "firebaseProjectId",
        "firebaseAppId",
        "firebaseMeasurementId",
        "firebaseMessagingSenderId",
        "firebaseStorageBucketId"
      ]);

      // Validate required keys
      if (!keys.firebaseApiKey || !keys.firebaseAuthDomain) {
        throw new Error('Missing required Firebase configuration');
      }

      const firebaseConfig = {
        apiKey: keys.firebaseApiKey,
        authDomain: keys.firebaseAuthDomain,
        projectId: keys.firebaseProjectId,
        storageBucket: keys.firebaseStorageBucketId,
        messagingSenderId: keys.firebaseMessagingSenderId,
        appId: keys.firebaseAppId
      };

      // Initialize Firebase
      firebase.initializeApp(firebaseConfig);
      this.auth = firebase.auth();
      this.initialized = true;
      console.log('Firebase initialized successfully');
      
      return true;
    } catch (error) {
      console.error('Firebase initialization error:', error);
      throw error;
    }
  }

  async signIn(email, password) {
    if (!this.auth) {
      throw new Error('Firebase not initialized');
    }
    try {
      const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { 
        success: false, 
        error: this.getErrorMessage(error)
      };
    }
  }

  async signUp(email, password) {
    if (!this.auth) {
      throw new Error('Firebase not initialized');
    }
    try {
      const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async signOut() {
    if (!this.auth) {
      throw new Error('Firebase not initialized');
    }
    try {
      await this.auth.signOut();
      return { success: true };
    } catch (error) {
      console.error('Sign out   error:', error);
      return { success: false, error: error.message };
    }
  }

  getCurrentUser() {
    if (!this.auth) {
      throw new Error('Firebase not initialized');
    }
    const user = this.auth.currentUser;
    if (!user) {
      return null;
    }
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified
    };
  }

  onAuthStateChanged(callback) {
    if (!this.auth) {
      throw new Error('Firebase not initialized');
    }
    return this.auth.onAuthStateChanged(callback);
  }
}

// Create global instance
window.firebaseService = new FirebaseService();