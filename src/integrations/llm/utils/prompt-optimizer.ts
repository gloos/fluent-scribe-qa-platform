// Prompt Optimization for Cost Reduction

import { LLMRequest } from '../types/llm-types';

export interface PromptOptimizationConfig {
  maxPromptLength: number;
  maxContextLength: number;
  maxSystemPromptLength: number;
  enableCompression: boolean;
  enableSummarization: boolean;
  preserveImportantContent: boolean;
  compressionRatio: number; // Target compression ratio (0.1 - 1.0)
}

export interface OptimizationResult {
  originalRequest: LLMRequest;
  optimizedRequest: LLMRequest;
  savings: {
    tokenReduction: number;
    estimatedCostSavings: number;
    compressionRatio: number;
  };
  optimizations: string[];
  quality: {
    informationRetention: number; // 0-1 score
    coherence: number; // 0-1 score
    completeness: number; // 0-1 score
  };
}

export interface PromptAnalysis {
  totalLength: number;
  estimatedTokens: number;
  redundancy: number; // 0-1 score
  complexity: number; // 0-1 score
  compressibility: number; // 0-1 score
  suggestions: string[];
}

export class PromptOptimizer {
  private config: PromptOptimizationConfig;

  constructor(config: Partial<PromptOptimizationConfig> = {}) {
    this.config = {
      maxPromptLength: 8000, // characters
      maxContextLength: 4000,
      maxSystemPromptLength: 1000,
      enableCompression: true,
      enableSummarization: true,
      preserveImportantContent: true,
      compressionRatio: 0.7, // Target 70% of original size
      ...config
    };
  }

  /**
   * Optimize a request for cost efficiency
   */
  public optimizeRequest(request: LLMRequest): OptimizationResult {
    const originalRequest = { ...request };
    const optimizations: string[] = [];
    let optimizedRequest = { ...request };

    // Analyze original request
    const analysis = this.analyzePrompt(request);

    // Apply optimizations based on analysis
    if (this.config.enableCompression) {
      optimizedRequest = this.compressPrompt(optimizedRequest);
      optimizations.push('Prompt compression applied');
    }

    if (this.config.enableSummarization && analysis.compressibility > 0.5) {
      optimizedRequest = this.summarizeContext(optimizedRequest);
      optimizations.push('Context summarization applied');
    }

    // Remove redundancy
    optimizedRequest = this.removeRedundancy(optimizedRequest);
    optimizations.push('Redundancy removal');

    // Optimize system prompt
    optimizedRequest = this.optimizeSystemPrompt(optimizedRequest);
    optimizations.push('System prompt optimization');

    // Calculate savings
    const originalTokens = this.estimateTokens(originalRequest);
    const optimizedTokens = this.estimateTokens(optimizedRequest);
    const tokenReduction = originalTokens - optimizedTokens;
    const estimatedCostSavings = this.estimateCostSavings(tokenReduction);

    return {
      originalRequest,
      optimizedRequest,
      savings: {
        tokenReduction,
        estimatedCostSavings,
        compressionRatio: optimizedTokens / originalTokens
      },
      optimizations,
      quality: this.assessOptimizationQuality(originalRequest, optimizedRequest)
    };
  }

  /**
   * Analyze prompt for optimization opportunities
   */
  public analyzePrompt(request: LLMRequest): PromptAnalysis {
    const totalLength = this.calculateTotalLength(request);
    const estimatedTokens = this.estimateTokens(request);
    
    return {
      totalLength,
      estimatedTokens,
      redundancy: this.calculateRedundancy(request),
      complexity: this.calculateComplexity(request),
      compressibility: this.calculateCompressibility(request),
      suggestions: this.generateSuggestions(request)
    };
  }

  /**
   * Compress prompt content
   */
  private compressPrompt(request: LLMRequest): LLMRequest {
    const optimized = { ...request };

    if (optimized.prompt && optimized.prompt.length > this.config.maxPromptLength) {
      optimized.prompt = this.compressText(
        optimized.prompt, 
        Math.min(this.config.maxPromptLength, optimized.prompt.length * this.config.compressionRatio)
      );
    }

    return optimized;
  }

  /**
   * Summarize context to reduce token usage
   */
  private summarizeContext(request: LLMRequest): LLMRequest {
    const optimized = { ...request };

    if (optimized.context && optimized.context.length > this.config.maxContextLength) {
      optimized.context = this.summarizeText(
        optimized.context,
        Math.min(this.config.maxContextLength, optimized.context.length * this.config.compressionRatio)
      );
    }

    return optimized;
  }

  /**
   * Remove redundant content
   */
  private removeRedundancy(request: LLMRequest): LLMRequest {
    const optimized = { ...request };

    // Remove duplicate sentences
    if (optimized.prompt) {
      optimized.prompt = this.removeDuplicateSentences(optimized.prompt);
    }

    if (optimized.context) {
      optimized.context = this.removeDuplicateSentences(optimized.context);
    }

    // Remove redundant phrases
    if (optimized.prompt) {
      optimized.prompt = this.removeRedundantPhrases(optimized.prompt);
    }

    return optimized;
  }

  /**
   * Optimize system prompt
   */
  private optimizeSystemPrompt(request: LLMRequest): LLMRequest {
    const optimized = { ...request };

    if (optimized.systemPrompt && optimized.systemPrompt.length > this.config.maxSystemPromptLength) {
      // Extract key instructions
      const essentialInstructions = this.extractEssentialInstructions(optimized.systemPrompt);
      optimized.systemPrompt = this.compressText(essentialInstructions, this.config.maxSystemPromptLength);
    }

    return optimized;
  }

  /**
   * Compress text while preserving meaning
   */
  private compressText(text: string, targetLength: number): string {
    if (text.length <= targetLength) return text;

    // Split into sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Score sentences by importance
    const scoredSentences = sentences.map(sentence => ({
      text: sentence.trim(),
      score: this.calculateSentenceImportance(sentence, text),
      length: sentence.length
    }));

    // Sort by importance and select to fit target length
    scoredSentences.sort((a, b) => b.score - a.score);
    
    let selectedText = '';
    let currentLength = 0;
    
    for (const sentence of scoredSentences) {
      if (currentLength + sentence.length <= targetLength) {
        selectedText += sentence.text + '. ';
        currentLength += sentence.length;
      }
    }

    return selectedText.trim();
  }

  /**
   * Summarize text content
   */
  private summarizeText(text: string, targetLength: number): string {
    if (text.length <= targetLength) return text;

    // Extract key points
    const keyPoints = this.extractKeyPoints(text);
    
    // Create summary
    let summary = '';
    for (const point of keyPoints) {
      if (summary.length + point.length <= targetLength) {
        summary += point + ' ';
      } else {
        break;
      }
    }

    return summary.trim();
  }

  /**
   * Remove duplicate sentences
   */
  private removeDuplicateSentences(text: string): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const uniqueSentences = new Set<string>();
    
    const result: string[] = [];
    
    for (const sentence of sentences) {
      const normalized = this.normalizeSentence(sentence);
      if (!uniqueSentences.has(normalized)) {
        uniqueSentences.add(normalized);
        result.push(sentence.trim());
      }
    }

    return result.join('. ') + '.';
  }

  /**
   * Remove redundant phrases
   */
  private removeRedundantPhrases(text: string): string {
    // Common redundant phrases to remove
    const redundantPhrases = [
      /\b(please note that|it should be noted that|it is important to note that)\b/gi,
      /\b(as mentioned earlier|as previously stated|as discussed above)\b/gi,
      /\b(in order to|so as to)\b/gi,
      /\b(due to the fact that|owing to the fact that)\b/gi,
      /\b(at this point in time|at the present time)\b/gi,
      /\b(it is worth mentioning that|it is worth noting that)\b/gi
    ];

    let optimized = text;
    
    for (const phrase of redundantPhrases) {
      optimized = optimized.replace(phrase, '');
    }

    // Clean up multiple spaces
    optimized = optimized.replace(/\s+/g, ' ').trim();

    return optimized;
  }

  /**
   * Extract essential instructions from system prompt
   */
  private extractEssentialInstructions(systemPrompt: string): string {
    // Identify instruction keywords
    const instructionKeywords = [
      'must', 'should', 'required', 'important', 'essential', 'critical',
      'format', 'output', 'response', 'analyze', 'evaluate', 'assess'
    ];

    const sentences = systemPrompt.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const essentialSentences: string[] = [];

    for (const sentence of sentences) {
      const hasKeyword = instructionKeywords.some(keyword => 
        sentence.toLowerCase().includes(keyword)
      );
      
      if (hasKeyword || sentence.length < 50) { // Short sentences are likely important
        essentialSentences.push(sentence.trim());
      }
    }

    return essentialSentences.join('. ') + '.';
  }

  /**
   * Calculate sentence importance
   */
  private calculateSentenceImportance(sentence: string, fullText: string): number {
    let score = 0;

    // Length penalty (very short or very long sentences are less important)
    const length = sentence.length;
    if (length >= 20 && length <= 100) score += 1;

    // Keyword scoring
    const importantKeywords = [
      'analyze', 'evaluate', 'assess', 'determine', 'identify', 'find',
      'error', 'problem', 'issue', 'quality', 'translation', 'fluency'
    ];

    for (const keyword of importantKeywords) {
      if (sentence.toLowerCase().includes(keyword)) {
        score += 2;
      }
    }

    // Position scoring (first and last sentences often important)
    const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const position = sentences.indexOf(sentence);
    if (position === 0 || position === sentences.length - 1) {
      score += 1;
    }

    return score;
  }

  /**
   * Extract key points from text
   */
  private extractKeyPoints(text: string): string[] {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const keyPoints: string[] = [];

    for (const sentence of sentences) {
      const importance = this.calculateSentenceImportance(sentence, text);
      if (importance >= 2) {
        keyPoints.push(sentence.trim());
      }
    }

    return keyPoints;
  }

  /**
   * Normalize sentence for duplicate detection
   */
  private normalizeSentence(sentence: string): string {
    return sentence
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate various metrics
   */
  private calculateTotalLength(request: LLMRequest): number {
    let length = 0;
    if (request.prompt) length += request.prompt.length;
    if (request.context) length += request.context.length;
    if (request.systemPrompt) length += request.systemPrompt.length;
    return length;
  }

  private estimateTokens(request: LLMRequest): number {
    const totalLength = this.calculateTotalLength(request);
    return Math.ceil(totalLength / 4); // Rough estimation: 4 characters per token
  }

  private calculateRedundancy(request: LLMRequest): number {
    // Simple redundancy calculation based on repeated phrases
    const allText = [request.prompt, request.context, request.systemPrompt]
      .filter(Boolean)
      .join(' ');
    
    const words = allText.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    
    return 1 - (uniqueWords.size / words.length);
  }

  private calculateComplexity(request: LLMRequest): number {
    const allText = [request.prompt, request.context, request.systemPrompt]
      .filter(Boolean)
      .join(' ');
    
    const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
    
    // Normalize to 0-1 scale (assuming 100 chars is high complexity)
    return Math.min(1, avgSentenceLength / 100);
  }

  private calculateCompressibility(request: LLMRequest): number {
    const redundancy = this.calculateRedundancy(request);
    const complexity = this.calculateComplexity(request);
    
    // Higher redundancy and lower complexity = more compressible
    return (redundancy + (1 - complexity)) / 2;
  }

  private generateSuggestions(request: LLMRequest): string[] {
    const suggestions: string[] = [];
    const analysis = {
      redundancy: this.calculateRedundancy(request),
      complexity: this.calculateComplexity(request),
      totalLength: this.calculateTotalLength(request)
    };

    if (analysis.redundancy > 0.3) {
      suggestions.push('High redundancy detected - consider removing duplicate content');
    }

    if (analysis.complexity > 0.7) {
      suggestions.push('High complexity detected - consider simplifying language');
    }

    if (analysis.totalLength > 10000) {
      suggestions.push('Large prompt size - consider splitting into smaller requests');
    }

    if (request.systemPrompt && request.systemPrompt.length > 1000) {
      suggestions.push('Long system prompt - consider extracting only essential instructions');
    }

    return suggestions;
  }

  private estimateCostSavings(tokenReduction: number): number {
    // Estimate cost savings based on average token pricing
    const avgInputTokenPrice = 0.005; // $0.005 per 1K tokens (average)
    const avgOutputTokenPrice = 0.015; // $0.015 per 1K tokens (average)
    
    // Assume input reduction mainly affects input tokens
    const inputSavings = (tokenReduction / 1000) * avgInputTokenPrice;
    
    return inputSavings;
  }

  private assessOptimizationQuality(original: LLMRequest, optimized: LLMRequest): OptimizationResult['quality'] {
    // Simple quality assessment based on length preservation
    const originalLength = this.calculateTotalLength(original);
    const optimizedLength = this.calculateTotalLength(optimized);
    const compressionRatio = optimizedLength / originalLength;

    // Quality metrics (simplified)
    return {
      informationRetention: Math.max(0.5, compressionRatio), // Assume some information loss
      coherence: compressionRatio > 0.7 ? 0.9 : 0.7, // Better coherence with less compression
      completeness: compressionRatio > 0.8 ? 0.95 : 0.8 // Completeness depends on compression level
    };
  }

  /**
   * Optimize request for specific cost target
   */
  public optimizeForCostTarget(request: LLMRequest, targetCostReduction: number): OptimizationResult {
    let currentRequest = { ...request };
    const optimizations: string[] = [];
    
    // Iteratively apply optimizations until target is reached
    const originalTokens = this.estimateTokens(request);
    const targetTokens = originalTokens * (1 - targetCostReduction);
    
    while (this.estimateTokens(currentRequest) > targetTokens) {
      // Apply more aggressive optimization
      this.config.compressionRatio *= 0.9; // Increase compression
      const result = this.optimizeRequest(currentRequest);
      currentRequest = result.optimizedRequest;
      optimizations.push(...result.optimizations);
    }

    // Calculate final savings
    const finalTokens = this.estimateTokens(currentRequest);
    const tokenReduction = originalTokens - finalTokens;
    const estimatedCostSavings = this.estimateCostSavings(tokenReduction);

    return {
      originalRequest: request,
      optimizedRequest: currentRequest,
      savings: {
        tokenReduction,
        estimatedCostSavings,
        compressionRatio: finalTokens / originalTokens
      },
      optimizations: [...new Set(optimizations)], // Remove duplicates
      quality: this.assessOptimizationQuality(request, currentRequest)
    };
  }
} 