import { useState, useCallback, useRef } from "react";

export type PhoneStatus = "idle" | "checking" | "valid" | "invalid" | "incomplete";

interface UsePhoneValidationOptions {
  debounceMs?: number;
  minDigits?: number;
  maxDigits?: number;
}

interface UsePhoneValidationReturn {
  phoneStatus: PhoneStatus;
  setPhoneStatus: React.Dispatch<React.SetStateAction<PhoneStatus>>;
  validatePhone: (phone: string) => void;
  resetStatus: () => void;
  isValidating: boolean;
}

// Brazilian phone validation
function isValidBrazilianPhone(phone: string): { valid: boolean; incomplete: boolean } {
  const cleanPhone = phone.replace(/\D/g, "");
  
  // Empty is idle
  if (cleanPhone.length === 0) {
    return { valid: false, incomplete: false };
  }
  
  // Less than 10 digits is incomplete
  if (cleanPhone.length < 10) {
    return { valid: false, incomplete: true };
  }
  
  // More than 11 digits is invalid
  if (cleanPhone.length > 11) {
    return { valid: false, incomplete: false };
  }
  
  // 10 digits = landline (XX) XXXX-XXXX
  // 11 digits = mobile (XX) 9XXXX-XXXX
  if (cleanPhone.length === 10) {
    // Landline: first 2 digits are DDD (valid range: 11-99)
    const ddd = parseInt(cleanPhone.substring(0, 2));
    if (ddd < 11 || ddd > 99) {
      return { valid: false, incomplete: false };
    }
    return { valid: true, incomplete: false };
  }
  
  if (cleanPhone.length === 11) {
    // Mobile: first 2 digits are DDD, 3rd digit must be 9
    const ddd = parseInt(cleanPhone.substring(0, 2));
    const thirdDigit = cleanPhone.charAt(2);
    
    if (ddd < 11 || ddd > 99) {
      return { valid: false, incomplete: false };
    }
    
    if (thirdDigit !== "9") {
      return { valid: false, incomplete: false };
    }
    
    return { valid: true, incomplete: false };
  }
  
  return { valid: false, incomplete: false };
}

export function usePhoneValidation(options: UsePhoneValidationOptions = {}): UsePhoneValidationReturn {
  const {
    debounceMs = 300,
  } = options;

  const [phoneStatus, setPhoneStatus] = useState<PhoneStatus>("idle");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkPhoneValidity = useCallback((phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    
    // Empty phone
    if (cleanPhone.length === 0) {
      setPhoneStatus("idle");
      return;
    }

    const result = isValidBrazilianPhone(phone);
    
    if (result.incomplete) {
      setPhoneStatus("incomplete");
    } else if (result.valid) {
      setPhoneStatus("valid");
    } else {
      setPhoneStatus("invalid");
    }
  }, []);

  const validatePhone = useCallback((phone: string) => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const cleanPhone = phone.replace(/\D/g, "");

    // Empty phone - idle
    if (cleanPhone.length === 0) {
      setPhoneStatus("idle");
      return;
    }

    // Quick validation for incomplete state
    if (cleanPhone.length < 10) {
      setPhoneStatus("incomplete");
      return;
    }

    // Schedule full validation with debounce
    timeoutRef.current = setTimeout(() => {
      checkPhoneValidity(phone);
    }, debounceMs);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [debounceMs, checkPhoneValidity]);

  const resetStatus = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setPhoneStatus("idle");
  }, []);

  return {
    phoneStatus,
    setPhoneStatus,
    validatePhone,
    resetStatus,
    isValidating: phoneStatus === "checking",
  };
}
