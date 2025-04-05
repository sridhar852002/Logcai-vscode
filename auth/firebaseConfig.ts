// src/auth/firebaseConfig.ts
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
// This is the Firebase configuration from your web setup.
export const firebaseConfig = {
    apiKey: "AIzaSyBI6CxCskvzzbf4Fd8-xTgeXFk16eDdRig",
    authDomain: "logcai-450f8.firebaseapp.com",
    projectId: "logcai-450f8",
    storageBucket: "logcai-450f8.firebasestorage.app",
    messagingSenderId: "603342399755",
    appId: "1:603342399755:web:7b8c09ebd58af55f5e9a0e",
    measurementId: "G-5JYFW60TS7"
  };
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  
  export default firebase;