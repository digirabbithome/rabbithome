import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";

const firebaseConfig = {
    apiKey: "AIzaSyANuDJyJuQbxnXq-FTyaTAI9mSc6zpmuWs",
    authDomain: "rabbithome-auth.firebaseapp.com",
    projectId: "rabbithome-auth",
    storageBucket: "rabbithome-auth.appspot.com",
    messagingSenderId: "50928677930",
    appId: "1:50928677930:web:e8eff13c8028b888537f53"
};

export const app = initializeApp(firebaseConfig);
