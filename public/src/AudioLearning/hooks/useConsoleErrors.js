import { useEffect, useRef, useState } from 'react';

export const useConsoleErrors = () => {
  const [consoleErrors, setConsoleErrors] = useState([]);
  const consoleErrorRef = useRef([]);

  useEffect(() => {
    const originalError = console.error;
    const originalWarn = console.warn;
    
    const addError = (type, ...args) => {
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      
      const errorEntry = {
        id: Date.now() + Math.random(),
        type,
        message,
        timestamp: new Date().toLocaleTimeString(),
      };
      
      consoleErrorRef.current = [...consoleErrorRef.current, errorEntry].slice(-50); // Keep last 50
      setConsoleErrors([...consoleErrorRef.current]);
    };
    
    console.error = (...args) => {
      originalError.apply(console, args);
      addError('error', ...args);
    };
    
    console.warn = (...args) => {
      originalWarn.apply(console, args);
      addError('warn', ...args);
    };
    
    return () => {
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  return { consoleErrors, setConsoleErrors, consoleErrorRef };
};

