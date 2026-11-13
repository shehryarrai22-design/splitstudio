
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDU2yWTX8MuD21h4f1RT0A7AnI7FsZBM54",
  authDomain: "slipstudio-585a6.firebaseapp.com",
  projectId: "slipstudio-585a6",
  storageBucket: "slipstudio-585a6.firebasestorage.app",
  messagingSenderId: "301307076397",
  appId: "1:301307076397:web:db34e151350cfefc47fda4",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
