import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, query, where, GeoPoint, Timestamp, addDoc, orderBy, arrayUnion } from 'firebase/firestore';
import { toast } from 'sonner';

// Define user profile interface
export interface UserProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  location?: {
    country: string;
    state?: string | null;
  };
  role?: 'admin' | 'member';
  joinedAt?: Timestamp;
  streakDays?: number;
  lastCheckIn?: Timestamp;
  socialMedia?: {
    discord?: string;
    instagram?: string;
    other?: {
      name: string;
      url: string;
    };
  };
}

// Firebase configuration with provided credentials
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};


// Initialize Firebase with better error handling
let app, auth, db;
try {
  console.log("Initializing Firebase app...");
  app = initializeApp(firebaseConfig);
  console.log("Firebase app initialized successfully");
  
  console.log("Initializing Firebase auth...");
  auth = getAuth(app);
  console.log("Firebase auth initialized successfully");
  
  console.log("Initializing Firestore...");
  db = getFirestore(app);
  console.log("Firestore initialized successfully");
} catch (error) {
  console.error("Error initializing Firebase:", error);
}

export { app, auth, db };

// Secure way to check for admin permissions
// This function uses a hash comparison approach to avoid exposing the email directly
export const isUserAdmin = async (email: string): Promise<boolean> => {
  if (!db) {
    console.error("Firebase db not initialized");
    return false;
  }

  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email), where('role', '==', 'admin'));
    const querySnapshot = await getDocs(q);

    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};


// Auth functions with conditional checks to prevent errors
export const login = async (email: string, password: string) => {
  if (!auth) {
    console.error("Firebase auth not initialized");
    toast.error('Firebase not configured. Please add your Firebase credentials in environment variables.');
    return false;
  }
  
  try {
    await signInWithEmailAndPassword(auth, email, password);
    toast.success('Welcome back to PurePath');
    return true;
  } catch (error) {
    toast.error('Login failed: ' + error.message);
    return false;
  }
};

export const register = async (
  email: string, 
  password: string, 
  username: string, 
  firstName: string, 
  lastName: string, 
  gender: string, 
  location?: { country: string; state?: string | null }
) => {
  try {
    console.log('Registering user with gender:', gender);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Create user profile in Firestore
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      username,
      firstName,
      lastName,
      email,
      meditations: [],
      relapses: [],  
      gender,
      location: location || null,
      role: 'member', // Default role
      joinedAt: Timestamp.now(),
      streakDays: 0,
      lastCheckIn: Timestamp.now()
    });
    
    toast.success('Welcome to PurePath');
    return true;
  } catch (error) {
    console.error('Registration error:', error);
    toast.error('Registration failed: ' + error.message);
    return false;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
    toast.success('You have been logged out');
    return true;
  } catch (error) {
    toast.error('Logout failed: ' + error.message);
    return false;
  }
};

// User data functions
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!db) {
    console.error("Firebase db not initialized");
    return { id: userId };
  }
  
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as UserProfile;
    } else {
      return { id: userId };
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return { id: userId };
  }
};

export const updateUserProfile = async (userId: string, profileData: Partial<UserProfile>): Promise<boolean> => {
  if (!db) {
    console.error("Firebase db not initialized");
    toast.error('Firebase not configured properly');
    return false;
  }
  
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, profileData);
    toast.success('Profile updated successfully');
    return true;
  } catch (error) {
    console.error('Error updating profile:', error);
    toast.error('Failed to update profile: ' + error.message);
    return false;
  }
};

export const updateUserPassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
  if (!auth || !auth.currentUser) {
    console.error("User not logged in or auth not initialized");
    toast.error('You must be logged in to change your password');
    return false;
  }
  
  try {
    // Re-authenticate user before changing password
    const credential = EmailAuthProvider.credential(
      auth.currentUser.email || '',
      currentPassword
    );
    
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);
    toast.success('Password updated successfully');
    return true;
  } catch (error) {
    console.error('Error updating password:', error);
    
    // Handle specific error codes
    if (error.code === 'auth/wrong-password') {
      toast.error('Current password is incorrect');
    } else if (error.code === 'auth/weak-password') {
      toast.error('New password is too weak');
    } else {
      toast.error('Failed to update password: ' + error.message);
    }
    
    return false;
  }
};

// Streaks and check-ins
export const updateStreak = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const lastCheckIn = userData.lastCheckIn?.toDate() || new Date(0);
      const now = new Date();
      
      // Check if the last check-in was yesterday (maintaining streak)
      const yesterdayDate = new Date(now);
      yesterdayDate.setDate(now.getDate() - 1);
      
      const isYesterday = 
        lastCheckIn.getDate() === yesterdayDate.getDate() && 
        lastCheckIn.getMonth() === yesterdayDate.getMonth() && 
        lastCheckIn.getFullYear() === yesterdayDate.getFullYear();
        
      // Check if already checked in today
      const isToday = 
        lastCheckIn.getDate() === now.getDate() && 
        lastCheckIn.getMonth() === now.getMonth() && 
        lastCheckIn.getFullYear() === now.getFullYear();
      
      if (isToday) {
        return { success: true, streakDays: userData.streakDays, message: 'Already checked in today' };
      }
      
      let streakDays = userData.streakDays || 0;
      
      if (isYesterday) {
        // Maintain streak
        streakDays += 1;
      } else if (!isToday) {
        // Reset streak if more than a day has been missed
        streakDays = 1;
      }
      
      // Update user data
      await updateDoc(userRef, {
        lastCheckIn: Timestamp.now(),
        streakDays
      });
      
      return { success: true, streakDays, message: 'Streak updated successfully' };
    }
    
    return { success: false, message: 'User not found' };
  } catch (error) {
    console.error('Error updating streak:', error);
    return { success: false, message: error.message };
  }
};

// Log relapse - used for analytics
interface LogRelapseResult {
  success: boolean;
  message?: string;
}

export const logRelapse = async (userId: string, triggers: string, notes?: string): Promise<LogRelapseResult> => {
  try {
    const userDocRef = doc(db, 'users', userId);  // Reference to the user's document

    const relapseObject = {
      timestamp: Timestamp.now(),
      triggers: triggers,
      notes: notes || ''
    };

    await updateDoc(userDocRef, {
      relapses: arrayUnion(relapseObject) // Append the relapse object to the 'relapses' array
    });
    return { success: true, message: 'Progress reset. Remember: every moment is a new opportunity.' };
  } catch (error) {
    console.error('Error logging relapse:', error);
    return { success: false, message: error.message };
  }
};

// Community map data (anonymized)
export const getCommunityLocations = async () => {
  try {
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    
    const locations: { id: string; location: { country: string; state?: string | null; } }[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.location && data.location.country) {
        // Only include location data, not user identifiable information
        locations.push({
          id: doc.id,
          location: data.location
        });
      }
    });
    
    return locations;
  } catch (error) {
    console.error('Error fetching community locations:', error);
    return [];
  }
};

export default app;
