// firebase.js
import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"

const keys = await getKeys();

const firebaseConfig = {
    apiKey: keys.firebaseConfig.apiKey,
    authDomain: keys.firebaseConfig.authDomain,
    projectId: keys.firebaseConfig.projectId,
    storageBucket: keys.firebaseConfig.storageBucket,
    messagingSenderId: keys.firebaseConfig.messagingSenderId,
    appId: keys.firebaseConfig.appId
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

export { auth }
