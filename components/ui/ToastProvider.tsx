import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ToastContainer, ToastVariant } from './Toast';

// Define the Toast type
interface Toast {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

// Define the Toast Context type
interface ToastContextType {
  toast: (message: string, options?: { variant?: ToastVariant; duration?: number }) => string;
  removeToast: (id: string) => void;
}

// Create the context
const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Provider props
interface ToastProviderProps {
  children: ReactNode;
}

// Create a provider component
export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Add a toast
  const toast = useCallback((
    message: string, 
    options?: { variant?: ToastVariant; duration?: number }
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    
    setToasts((prevToasts) => [
      ...prevToasts,
      {
        id,
        message,
        variant: options?.variant,
        duration: options?.duration,
      },
    ]);
    
    return id;
  }, []);

  // Remove a toast
  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

// Custom hook to use the toast context
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  
  return context;
};

// Utility functions for different toast types
export const useToastTypes = () => {
  const { toast } = useToast();
  
  return {
    success: (message: string, duration?: number) => 
      toast(message, { variant: 'success', duration }),
    
    error: (message: string, duration?: number) => 
      toast(message, { variant: 'error', duration }),
    
    warning: (message: string, duration?: number) => 
      toast(message, { variant: 'warning', duration }),
    
    info: (message: string, duration?: number) => 
      toast(message, { variant: 'info', duration }),
  };
};