import { parsePhoneNumber, isValidPhoneNumber, CountryCode } from 'libphonenumber-js'

export interface PhoneValidationResult {
  isValid: boolean
  formatted?: string  // E.164 format (+15555551234)
  display?: string    // Display format ((555) 555-1234)
  countryCode?: string
  nationalNumber?: string
  error?: string
}

/**
 * Validate and format a phone number
 * @param phone Phone number in any format
 * @param defaultCountry Default country code if not provided (default: US)
 * @returns Validation result with formatted numbers
 */
export function validateAndFormatPhone(
  phone: string,
  defaultCountry: CountryCode = 'US'
): PhoneValidationResult {
  if (!phone || phone.trim().length === 0) {
    return {
      isValid: false,
      error: 'Phone number is required'
    }
  }

  try {
    // Check if it's a valid phone number
    if (!isValidPhoneNumber(phone, defaultCountry)) {
      return {
        isValid: false,
        error: 'Invalid phone number format'
      }
    }

    // Parse the phone number
    const phoneNumber = parsePhoneNumber(phone, defaultCountry)

    if (!phoneNumber) {
      return {
        isValid: false,
        error: 'Could not parse phone number'
      }
    }

    // Return formatted versions
    return {
      isValid: true,
      formatted: phoneNumber.format('E.164'),  // +15555551234
      display: phoneNumber.formatNational(),   // (555) 555-1234
      countryCode: phoneNumber.countryCallingCode,
      nationalNumber: phoneNumber.nationalNumber
    }
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Invalid phone number'
    }
  }
}

/**
 * Format phone number for display
 * @param phone Phone number in E.164 format
 * @param format Display format ('national' | 'international')
 * @returns Formatted phone number for display
 */
export function formatPhoneForDisplay(
  phone: string,
  format: 'national' | 'international' = 'national'
): string {
  try {
    const phoneNumber = parsePhoneNumber(phone)
    
    if (!phoneNumber) {
      return phone
    }

    if (format === 'international') {
      return phoneNumber.formatInternational()  // +1 555 555 1234
    }

    return phoneNumber.formatNational()  // (555) 555-1234
  } catch (error) {
    return phone
  }
}

/**
 * Extract country code from phone number
 * @param phone Phone number in any format
 * @returns Country code (e.g., 'US', 'GB')
 */
export function getPhoneCountry(phone: string): CountryCode | null {
  try {
    const phoneNumber = parsePhoneNumber(phone)
    return phoneNumber?.country || null
  } catch (error) {
    return null
  }
}

/**
 * Check if two phone numbers are the same
 * @param phone1 First phone number
 * @param phone2 Second phone number
 * @returns true if both numbers are the same
 */
export function arePhoneNumbersEqual(phone1: string, phone2: string): boolean {
  try {
    const parsed1 = parsePhoneNumber(phone1)
    const parsed2 = parsePhoneNumber(phone2)
    
    if (!parsed1 || !parsed2) {
      return false
    }

    return parsed1.format('E.164') === parsed2.format('E.164')
  } catch (error) {
    return false
  }
}

/**
 * Normalize phone number to E.164 format
 * @param phone Phone number in any format
 * @param defaultCountry Default country code
 * @returns Phone number in E.164 format or null if invalid
 */
export function normalizePhoneNumber(
  phone: string,
  defaultCountry: CountryCode = 'US'
): string | null {
  const result = validateAndFormatPhone(phone, defaultCountry)
  return result.isValid ? result.formatted! : null
}

/**
 * Get phone number metadata (for debugging/display)
 * @param phone Phone number
 * @returns Phone number metadata
 */
export function getPhoneMetadata(phone: string): {
  isValid: boolean
  country?: string
  countryCode?: string
  nationalNumber?: string
  type?: string
  formatted?: {
    e164?: string
    national?: string
    international?: string
  }
} {
  try {
    const phoneNumber = parsePhoneNumber(phone)
    
    if (!phoneNumber) {
      return { isValid: false }
    }

    return {
      isValid: phoneNumber.isValid(),
      country: phoneNumber.country,
      countryCode: phoneNumber.countryCallingCode,
      nationalNumber: phoneNumber.nationalNumber,
      type: phoneNumber.getType(),
      formatted: {
        e164: phoneNumber.format('E.164'),
        national: phoneNumber.formatNational(),
        international: phoneNumber.formatInternational()
      }
    }
  } catch (error) {
    return { isValid: false }
  }
}

/**
 * Validate phone number with custom rules
 * @param phone Phone number
 * @param options Validation options
 * @returns Validation result
 */
export function validatePhoneWithRules(
  phone: string,
  options?: {
    defaultCountry?: CountryCode
    allowedCountries?: CountryCode[]
    allowMobile?: boolean
    allowLandline?: boolean
  }
): PhoneValidationResult {
  const result = validateAndFormatPhone(phone, options?.defaultCountry || 'US')
  
  if (!result.isValid) {
    return result
  }

  try {
    const phoneNumber = parsePhoneNumber(phone, options?.defaultCountry)
    
    if (!phoneNumber) {
      return {
        isValid: false,
        error: 'Invalid phone number'
      }
    }

    // Check allowed countries
    if (options?.allowedCountries && phoneNumber.country) {
      if (!options.allowedCountries.includes(phoneNumber.country)) {
        return {
          isValid: false,
          error: `Phone numbers from ${phoneNumber.country} are not allowed`
        }
      }
    }

    // Check phone type (mobile vs landline)
    const type = phoneNumber.getType()
    
    if (options?.allowMobile === false && type === 'MOBILE') {
      return {
        isValid: false,
        error: 'Mobile numbers are not allowed'
      }
    }
    
    if (options?.allowLandline === false && type === 'FIXED_LINE') {
      return {
        isValid: false,
        error: 'Landline numbers are not allowed'
      }
    }

    return result
  } catch (error) {
    return {
      isValid: false,
      error: 'Phone validation failed'
    }
  }
}
