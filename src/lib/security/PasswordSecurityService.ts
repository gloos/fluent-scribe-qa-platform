import { PasswordBreachResult, PasswordEntropyResult } from './types';

export class PasswordSecurityService {
  /**
   * Check if password has been compromised using HaveIBeenPwned API
   * Uses k-anonymity to protect privacy
   */
  static async checkPasswordBreach(password: string): Promise<PasswordBreachResult> {
    try {
      // Hash the password with SHA-1
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-1', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

      // Use k-anonymity: send only first 5 characters of hash
      const prefix = hashHex.substring(0, 5);
      const suffix = hashHex.substring(5);

      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'QA-Tool-Security-Check'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const text = await response.text();
      const lines = text.split('\n');

      for (const line of lines) {
        const [hashSuffix, count] = line.split(':');
        if (hashSuffix === suffix) {
          return {
            isCompromised: true,
            occurrences: parseInt(count, 10)
          };
        }
      }

      return { isCompromised: false };
    } catch (error) {
      console.error('Password breach check failed:', error);
      return {
        isCompromised: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Enhanced password strength calculation
   */
  static calculatePasswordEntropy(password: string): PasswordEntropyResult {
    let charsetSize = 0;
    
    if (/[a-z]/.test(password)) charsetSize += 26;
    if (/[A-Z]/.test(password)) charsetSize += 26;
    if (/[0-9]/.test(password)) charsetSize += 10;
    if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32; // Special characters

    const entropy = password.length * Math.log2(charsetSize);
    
    // Estimate crack time (very simplified)
    const guessesPerSecond = 1000000000; // 1 billion guesses per second
    const guessesToCrack = Math.pow(2, entropy) / 2; // Average case
    const secondsToCrack = guessesToCrack / guessesPerSecond;

    let estimatedCrackTime: string;
    if (secondsToCrack < 60) {
      estimatedCrackTime = 'Less than a minute';
    } else if (secondsToCrack < 3600) {
      estimatedCrackTime = `${Math.round(secondsToCrack / 60)} minutes`;
    } else if (secondsToCrack < 86400) {
      estimatedCrackTime = `${Math.round(secondsToCrack / 3600)} hours`;
    } else if (secondsToCrack < 31536000) {
      estimatedCrackTime = `${Math.round(secondsToCrack / 86400)} days`;
    } else {
      const years = secondsToCrack / 31536000;
      if (years > 1000000) {
        estimatedCrackTime = 'Millions of years';
      } else {
        estimatedCrackTime = `${Math.round(years)} years`;
      }
    }

    let strength: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
    if (entropy < 25) strength = 'very-weak';
    else if (entropy < 35) strength = 'weak';
    else if (entropy < 50) strength = 'fair';
    else if (entropy < 65) strength = 'good';
    else if (entropy < 80) strength = 'strong';
    else strength = 'very-strong';

    return { entropy, strength, estimatedCrackTime };
  }

  /**
   * Check if password meets minimum security requirements
   */
  static validatePasswordComplexity(password: string): {
    isValid: boolean;
    requirements: Array<{ met: boolean; description: string }>;
  } {
    const requirements = [
      {
        met: password.length >= 8,
        description: 'At least 8 characters long'
      },
      {
        met: /[a-z]/.test(password),
        description: 'Contains lowercase letters'
      },
      {
        met: /[A-Z]/.test(password),
        description: 'Contains uppercase letters'
      },
      {
        met: /[0-9]/.test(password),
        description: 'Contains numbers'
      },
      {
        met: /[^a-zA-Z0-9]/.test(password),
        description: 'Contains special characters'
      }
    ];

    const isValid = requirements.every(req => req.met);

    return { isValid, requirements };
  }

  /**
   * Generate a secure password suggestion
   */
  static generateSecurePassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const allChars = lowercase + uppercase + numbers + symbols;
    
    let password = '';
    
    // Ensure at least one character from each category
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest with random characters
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password to avoid predictable patterns
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Check for common password patterns to avoid
   */
  static checkCommonPatterns(password: string): {
    hasCommonPatterns: boolean;
    patterns: string[];
  } {
    const patterns: string[] = [];

    // Sequential characters
    if (/123|abc|qwe|zxc/i.test(password)) {
      patterns.push('Sequential characters');
    }

    // Repeated characters
    if (/(.)\1{2,}/.test(password)) {
      patterns.push('Repeated characters');
    }

    // Common substitutions
    if (/p@ssw0rd|p4ssw0rd|password/i.test(password)) {
      patterns.push('Common password variations');
    }

    // Keyboard patterns
    if (/qwerty|asdf|zxcv/i.test(password)) {
      patterns.push('Keyboard patterns');
    }

    // Simple date patterns
    if (/19|20\d{2}|0[1-9]|1[0-2]/.test(password)) {
      patterns.push('Date patterns');
    }

    return {
      hasCommonPatterns: patterns.length > 0,
      patterns
    };
  }

  /**
   * Comprehensive password strength assessment
   */
  static async assessPasswordStrength(password: string): Promise<{
    entropy: PasswordEntropyResult;
    complexity: ReturnType<typeof PasswordSecurityService.validatePasswordComplexity>;
    patterns: ReturnType<typeof PasswordSecurityService.checkCommonPatterns>;
    breach?: PasswordBreachResult;
    overallScore: number; // 0-100
    recommendation: string;
  }> {
    const entropy = this.calculatePasswordEntropy(password);
    const complexity = this.validatePasswordComplexity(password);
    const patterns = this.checkCommonPatterns(password);
    
    // Optional breach check (might be slow)
    let breach: PasswordBreachResult | undefined;
    try {
      breach = await this.checkPasswordBreach(password);
    } catch (error) {
      console.warn('Breach check failed:', error);
    }

    // Calculate overall score
    let score = 0;
    
    // Entropy score (0-40 points)
    const entropyScore = Math.min(40, (entropy.entropy / 80) * 40);
    score += entropyScore;
    
    // Complexity score (0-30 points)
    const complexityScore = (complexity.requirements.filter(r => r.met).length / complexity.requirements.length) * 30;
    score += complexityScore;
    
    // Pattern penalty (0-20 points deduction)
    const patternPenalty = patterns.hasCommonPatterns ? 20 : 0;
    score -= patternPenalty;
    
    // Breach penalty (0-30 points deduction)
    const breachPenalty = breach?.isCompromised ? 30 : 0;
    score -= breachPenalty;
    
    // Length bonus (0-10 points)
    const lengthBonus = Math.min(10, (password.length - 8) * 2);
    score += lengthBonus;
    
    score = Math.max(0, Math.min(100, score));

    // Generate recommendation
    let recommendation = '';
    if (score < 30) {
      recommendation = 'Very weak password. Consider using a password manager to generate a strong password.';
    } else if (score < 50) {
      recommendation = 'Weak password. Add more characters and complexity.';
    } else if (score < 70) {
      recommendation = 'Fair password. Consider adding more length or special characters.';
    } else if (score < 85) {
      recommendation = 'Good password. Well done!';
    } else {
      recommendation = 'Excellent password! Very secure.';
    }

    if (breach?.isCompromised) {
      recommendation += ` Warning: This password has been found in ${breach.occurrences} data breaches.`;
    }

    return {
      entropy,
      complexity,
      patterns,
      breach,
      overallScore: score,
      recommendation
    };
  }
} 