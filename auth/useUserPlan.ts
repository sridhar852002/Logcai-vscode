// src/auth/useUserPlan.ts (Updated for API key support)
import { useEffect, useState } from 'react';
import firebase from './firebaseConfig';
import { setUserPlan } from '../monetization/planManager';
import ApiKeyManager from '../services/ApiKeyManager';
import vscode from '../utils/vscode';

export function useUserPlan() {
  const [plan, setPlan] = useState<'Free' | 'LocalPro' | 'CloudPro'>('Free');
  const [user, setUser] = useState<firebase.User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Setup auth state listener
    const unsubscribe = firebase.auth().onAuthStateChanged(async (u) => {
      try {
        setIsLoading(true);
        if (u) {
          // User is signed in
          setUser(u);
          // Initialize API Key Manager with user ID
          ApiKeyManager.initialize(u.uid);
          // Fetch user data from Firestore
          const doc = await firebase.firestore().collection('users').doc(u.uid).get();
          const userData = doc.data();
          // Set plan information
          const userPlan = userData?.plan || 'Free';
          const userRole = userData?.role || 'user';
          
          console.log(`[useUserPlan] Retrieved plan from Firestore: ${userPlan}`);
          
          setPlan(userPlan);
          setIsAdmin(userRole === 'admin');
          
          // Update global state
          window.userPlan = userPlan;
          window.isAdmin = userRole === 'admin';
          
          // This links the UI state with the backend plan manager
          setUserPlan(userPlan);
          
          // Notify the extension host about the plan update
          vscode.postMessage({
            command: 'updateUserPlan',
            plan: userPlan
          });
          
        } else {
          // User is signed out
          setUser(null);
          setPlan('Free');
          setIsAdmin(false);
          // Reset global state
          window.userPlan = 'Free';
          window.isAdmin = false;
          // Clear API Key Manager state
          ApiKeyManager.initialize(null);
          // Update plan manager
          setUserPlan('Free');
          
          // Notify extension host about plan reset
          vscode.postMessage({
            command: 'updateUserPlan',
            plan: 'Free'
          });
        }
        setError(null);
      } catch (err: any) {
        console.error('Error in auth state change:', err);
        setError(err.message || 'Authentication error');
        // Ensure we have fallback values in case of error
        setPlan('Free');
        setUserPlan('Free');
        // Clear API Key Manager state
        ApiKeyManager.initialize(null);
        
        // Notify extension host about plan reset due to error
        vscode.postMessage({
          command: 'updateUserPlan',
          plan: 'Free'
        });
      } finally {
        setIsLoading(false);
      }
    });
    
    // Listen for plan updates from extension host
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'userPlanChanged' && message.plan) {
        console.log(`[useUserPlan] Received plan update from extension: ${message.plan}`);
        setPlan(message.plan);
        window.userPlan = message.plan;
        setUserPlan(message.plan);
      }
    };
    
    window.addEventListener('message', handleMessage);

    // Clean up listener on unmount
    return () => {
      unsubscribe();
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return { plan, user, isAdmin, isLoading, error };
}