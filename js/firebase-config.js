/* ============================================================
   Firebase project config
   Replace the placeholders below with your own Firebase project's
   web app config (Firebase Console → Project settings → Your apps
   → SDK setup and configuration → Config).
   ============================================================ */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
