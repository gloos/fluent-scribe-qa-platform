/**
 * Formula Parser and Evaluator
 * 
 * Provides safe evaluation of custom scoring formulas with mathematical operations,
 * conditional logic, and reference functions. Uses a whitelist-based approach
 * for security and prevents arbitrary code execution.
 */

import type {
  FormulaContext,
  FormulaValidationResult,
  FormulaValidationError,
  FormulaExecutionResult,
  FormulaFunction,
  FormulaVariable
} from '@/lib/types/scoring-models';

/**
 * Supported mathematical operators
 */
const OPERATORS = {
  '+': (a: number, b: number) => a + b,
  '-': (a: number, b: number) => a - b,
  '*': (a: number, b: number) => a * b,
  '/': (a: number, b: number) => b !== 0 ? a / b : 0,
  '%': (a: number, b: number) => b !== 0 ? a % b : 0,
  '^': (a: number, b: number) => Math.pow(a, b),
  '**': (a: number, b: number) => Math.pow(a, b),
} as const;

/**
 * Supported comparison operators
 */
const COMPARISON_OPERATORS = {
  '>': (a: number, b: number) => a > b,
  '<': (a: number, b: number) => a < b,
  '>=': (a: number, b: number) => a >= b,
  '<=': (a: number, b: number) => a <= b,
  '==': (a: any, b: any) => a === b,
  '!=': (a: any, b: any) => a !== b,
  '===': (a: any, b: any) => a === b,
  '!==': (a: any, b: any) => a !== b,
} as const;

/**
 * Supported built-in mathematical functions
 */
const MATH_FUNCTIONS = {
  // Basic math
  abs: (x: number) => Math.abs(x),
  ceil: (x: number) => Math.ceil(x),
  floor: (x: number) => Math.floor(x),
  round: (x: number) => Math.round(x),
  sqrt: (x: number) => Math.sqrt(x),
  pow: (x: number, y: number) => Math.pow(x, y),
  log: (x: number) => Math.log(x),
  log10: (x: number) => Math.log10(x),
  
  // Min/Max
  min: (...args: number[]) => Math.min(...args),
  max: (...args: number[]) => Math.max(...args),
  
  // Rounding and precision
  toFixed: (x: number, digits: number = 2) => parseFloat(x.toFixed(digits)),
  toPrecision: (x: number, precision: number = 3) => parseFloat(x.toPrecision(precision)),
  
  // Statistical functions
  avg: (...args: number[]) => args.length > 0 ? args.reduce((sum, val) => sum + val, 0) / args.length : 0,
  sum: (...args: number[]) => args.reduce((sum, val) => sum + val, 0),
  count: (...args: any[]) => args.length,
  
  // Conditional functions
  if: (condition: boolean, trueValue: any, falseValue: any) => condition ? trueValue : falseValue,
  and: (...args: boolean[]) => args.every(Boolean),
  or: (...args: boolean[]) => args.some(Boolean),
  not: (value: boolean) => !value,
  
  // Range and bounds
  clamp: (value: number, min: number, max: number) => Math.min(Math.max(value, min), max),
  between: (value: number, min: number, max: number) => value >= min && value <= max,
} as const;

/**
 * Scoring-specific reference functions
 */
const SCORING_FUNCTIONS = {
  // Dimension references
  dimension: (context: FormulaContext, dimensionId: string) => {
    return context.dimensions[dimensionId] || 0;
  },
  
  // Error type references
  errorType: (context: FormulaContext, errorTypeId: string) => {
    return context.errorTypes[errorTypeId] || 0;
  },
  
  // Weight references
  weight: (context: FormulaContext, weightId: string) => {
    return context.weights[weightId] || 0;
  },
  
  // Constant references
  constant: (context: FormulaContext, constantName: string) => {
    return context.constants[constantName] || 0;
  },
  
  // Variable references
  variable: (context: FormulaContext, variableName: string) => {
    return context.variables[variableName] || 0;
  },
  
  // Context data
  totalErrors: (context: FormulaContext) => context.totalErrors,
  unitCount: (context: FormulaContext) => context.unitCount,
  errorRate: (context: FormulaContext) => context.errorRate,
  maxScore: (context: FormulaContext) => context.maxScore,
  passingThreshold: (context: FormulaContext) => context.passingThreshold,
  
  // Percentage calculations
  percentage: (value: number, total: number) => total > 0 ? (value / total) * 100 : 0,
  percentageOf: (percentage: number, total: number) => (percentage / 100) * total,
  
  // Quality level determination
  qualityLevel: (score: number, thresholds: Record<string, number>) => {
    if (score >= (thresholds.excellent || 95)) return 'excellent';
    if (score >= (thresholds.good || 85)) return 'good';
    if (score >= (thresholds.fair || 70)) return 'fair';
    if (score >= (thresholds.poor || 50)) return 'poor';
    return 'unacceptable';
  },
} as const;

/**
 * Token types for the parser
 */
type TokenType = 
  | 'NUMBER'
  | 'STRING'
  | 'IDENTIFIER'
  | 'OPERATOR'
  | 'COMPARISON'
  | 'FUNCTION'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'SEMICOLON'
  | 'WHITESPACE'
  | 'EOF'
  | 'UNKNOWN';

/**
 * Token structure
 */
interface Token {
  type: TokenType;
  value: string;
  position: number;
  line: number;
  column: number;
}

/**
 * AST Node types
 */
type ASTNode = 
  | NumberNode
  | StringNode
  | IdentifierNode
  | BinaryOpNode
  | UnaryOpNode
  | FunctionCallNode
  | ConditionalNode;

interface NumberNode {
  type: 'number';
  value: number;
}

interface StringNode {
  type: 'string';
  value: string;
}

interface IdentifierNode {
  type: 'identifier';
  name: string;
}

interface BinaryOpNode {
  type: 'binaryOp';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

interface UnaryOpNode {
  type: 'unaryOp';
  operator: string;
  operand: ASTNode;
}

interface FunctionCallNode {
  type: 'functionCall';
  name: string;
  arguments: ASTNode[];
}

interface ConditionalNode {
  type: 'conditional';
  condition: ASTNode;
  trueValue: ASTNode;
  falseValue: ASTNode;
}

/**
 * Formula Parser Class
 */
export class FormulaParser {
  private tokens: Token[] = [];
  private currentTokenIndex = 0;
  private errors: FormulaValidationError[] = [];

  /**
   * Parse and validate a formula expression
   */
  static validateFormula(expression: string): FormulaValidationResult {
    const startTime = performance.now();
    const parser = new FormulaParser();
    
    try {
      const tokens = parser.tokenize(expression);
      parser.tokens = tokens;
      parser.currentTokenIndex = 0;
      parser.errors = [];
      
      const ast = parser.parseExpression();
      
      // Additional semantic validation
      parser.validateSemantics(ast);
      
      const parseTime = performance.now() - startTime;
      
      return {
        isValid: parser.errors.length === 0,
        errors: parser.errors,
        warnings: [],
        suggestedFixes: parser.generateSuggestedFixes(),
        parseTime
      };
    } catch (error) {
      const parseTime = performance.now() - startTime;
      
      return {
        isValid: false,
        errors: [{
          type: 'syntax',
          message: error instanceof Error ? error.message : 'Unknown parsing error',
          severity: 'error'
        }],
        warnings: [],
        suggestedFixes: [],
        parseTime
      };
    }
  }

  /**
   * Execute a formula with the given context
   */
  static executeFormula(expression: string, context: FormulaContext): FormulaExecutionResult {
    const startTime = performance.now();
    
    try {
      const validation = FormulaParser.validateFormula(expression);
      
      if (!validation.isValid) {
        return {
          success: false,
          error: `Formula validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
          executionTime: performance.now() - startTime,
          context
        };
      }
      
      const parser = new FormulaParser();
      const tokens = parser.tokenize(expression);
      parser.tokens = tokens;
      parser.currentTokenIndex = 0;
      
      const ast = parser.parseExpression();
      const result = parser.evaluateAST(ast, context);
      
      return {
        success: true,
        result,
        executionTime: performance.now() - startTime,
        context
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error',
        executionTime: performance.now() - startTime,
        context
      };
    }
  }

  /**
   * Tokenize the input expression
   */
  private tokenize(expression: string): Token[] {
    const tokens: Token[] = [];
    let position = 0;
    let line = 1;
    let column = 1;

    while (position < expression.length) {
      const char = expression[position];

      // Skip whitespace
      if (/\s/.test(char)) {
        if (char === '\n') {
          line++;
          column = 1;
        } else {
          column++;
        }
        position++;
        continue;
      }

      // Numbers (including decimals)
      if (/\d/.test(char)) {
        let value = '';
        while (position < expression.length && /[\d.]/.test(expression[position])) {
          value += expression[position];
          position++;
          column++;
        }
        tokens.push({ type: 'NUMBER', value, position: position - value.length, line, column: column - value.length });
        continue;
      }

      // Strings (single or double quotes)
      if (char === '"' || char === "'") {
        const quote = char;
        let value = '';
        position++; // Skip opening quote
        column++;
        
        while (position < expression.length && expression[position] !== quote) {
          value += expression[position];
          position++;
          column++;
        }
        
        if (position < expression.length) {
          position++; // Skip closing quote
          column++;
        }
        
        tokens.push({ type: 'STRING', value, position: position - value.length - 2, line, column: column - value.length - 2 });
        continue;
      }

      // Identifiers and function names
      if (/[a-zA-Z_]/.test(char)) {
        let value = '';
        while (position < expression.length && /[a-zA-Z0-9_]/.test(expression[position])) {
          value += expression[position];
          position++;
          column++;
        }
        
        // Check if it's a known function
        const isFunction = value in MATH_FUNCTIONS || value in SCORING_FUNCTIONS;
        tokens.push({ 
          type: isFunction ? 'FUNCTION' : 'IDENTIFIER', 
          value, 
          position: position - value.length, 
          line, 
          column: column - value.length 
        });
        continue;
      }

      // Operators and comparison operators
      const twoCharOp = expression.substr(position, 2);
      if (twoCharOp in OPERATORS || twoCharOp in COMPARISON_OPERATORS) {
        const type = twoCharOp in OPERATORS ? 'OPERATOR' : 'COMPARISON';
        tokens.push({ type, value: twoCharOp, position, line, column });
        position += 2;
        column += 2;
        continue;
      }

      const oneCharOp = char;
      if (oneCharOp in OPERATORS || oneCharOp in COMPARISON_OPERATORS) {
        const type = oneCharOp in OPERATORS ? 'OPERATOR' : 'COMPARISON';
        tokens.push({ type, value: oneCharOp, position, line, column });
        position++;
        column++;
        continue;
      }

      // Parentheses and other symbols
      switch (char) {
        case '(':
          tokens.push({ type: 'LPAREN', value: char, position, line, column });
          break;
        case ')':
          tokens.push({ type: 'RPAREN', value: char, position, line, column });
          break;
        case ',':
          tokens.push({ type: 'COMMA', value: char, position, line, column });
          break;
        case ';':
          tokens.push({ type: 'SEMICOLON', value: char, position, line, column });
          break;
        default:
          tokens.push({ type: 'UNKNOWN', value: char, position, line, column });
          this.errors.push({
            type: 'syntax',
            message: `Unknown character: ${char}`,
            position: { start: position, end: position + 1, line, column },
            severity: 'error'
          });
      }
      
      position++;
      column++;
    }

    tokens.push({ type: 'EOF', value: '', position, line, column });
    return tokens;
  }

  /**
   * Parse expression into AST
   */
  private parseExpression(): ASTNode {
    return this.parseConditional();
  }

  /**
   * Parse conditional expressions (ternary operator)
   */
  private parseConditional(): ASTNode {
    let node = this.parseLogicalOr();

    if (this.match('OPERATOR') && this.currentToken().value === '?') {
      this.advance(); // consume '?'
      const trueValue = this.parseExpression();
      
      if (!this.match('OPERATOR') || this.currentToken().value !== ':') {
        this.addError('Expected ":" in ternary operator');
      } else {
        this.advance(); // consume ':'
      }
      
      const falseValue = this.parseExpression();
      
      node = {
        type: 'conditional',
        condition: node,
        trueValue,
        falseValue
      };
    }

    return node;
  }

  /**
   * Parse logical OR expressions
   */
  private parseLogicalOr(): ASTNode {
    let node = this.parseLogicalAnd();

    while (this.match('OPERATOR') && this.currentToken().value === '||') {
      const operator = this.currentToken().value;
      this.advance();
      const right = this.parseLogicalAnd();
      node = {
        type: 'binaryOp',
        operator,
        left: node,
        right
      };
    }

    return node;
  }

  /**
   * Parse logical AND expressions
   */
  private parseLogicalAnd(): ASTNode {
    let node = this.parseComparison();

    while (this.match('OPERATOR') && this.currentToken().value === '&&') {
      const operator = this.currentToken().value;
      this.advance();
      const right = this.parseComparison();
      node = {
        type: 'binaryOp',
        operator,
        left: node,
        right
      };
    }

    return node;
  }

  /**
   * Parse comparison expressions
   */
  private parseComparison(): ASTNode {
    let node = this.parseAddition();

    while (this.match('COMPARISON')) {
      const operator = this.currentToken().value;
      this.advance();
      const right = this.parseAddition();
      node = {
        type: 'binaryOp',
        operator,
        left: node,
        right
      };
    }

    return node;
  }

  /**
   * Parse addition and subtraction
   */
  private parseAddition(): ASTNode {
    let node = this.parseMultiplication();

    while (this.match('OPERATOR') && (this.currentToken().value === '+' || this.currentToken().value === '-')) {
      const operator = this.currentToken().value;
      this.advance();
      const right = this.parseMultiplication();
      node = {
        type: 'binaryOp',
        operator,
        left: node,
        right
      };
    }

    return node;
  }

  /**
   * Parse multiplication, division, and modulo
   */
  private parseMultiplication(): ASTNode {
    let node = this.parseExponentiation();

    while (this.match('OPERATOR') && ['*', '/', '%'].includes(this.currentToken().value)) {
      const operator = this.currentToken().value;
      this.advance();
      const right = this.parseExponentiation();
      node = {
        type: 'binaryOp',
        operator,
        left: node,
        right
      };
    }

    return node;
  }

  /**
   * Parse exponentiation
   */
  private parseExponentiation(): ASTNode {
    let node = this.parseUnary();

    if (this.match('OPERATOR') && (this.currentToken().value === '^' || this.currentToken().value === '**')) {
      const operator = this.currentToken().value;
      this.advance();
      const right = this.parseExponentiation(); // Right associative
      node = {
        type: 'binaryOp',
        operator,
        left: node,
        right
      };
    }

    return node;
  }

  /**
   * Parse unary expressions
   */
  private parseUnary(): ASTNode {
    if (this.match('OPERATOR') && (this.currentToken().value === '+' || this.currentToken().value === '-' || this.currentToken().value === '!')) {
      const operator = this.currentToken().value;
      this.advance();
      const operand = this.parseUnary();
      return {
        type: 'unaryOp',
        operator,
        operand
      };
    }

    return this.parsePrimary();
  }

  /**
   * Parse primary expressions (numbers, identifiers, function calls, parentheses)
   */
  private parsePrimary(): ASTNode {
    // Numbers
    if (this.match('NUMBER')) {
      const value = parseFloat(this.currentToken().value);
      this.advance();
      return { type: 'number', value };
    }

    // Strings
    if (this.match('STRING')) {
      const value = this.currentToken().value;
      this.advance();
      return { type: 'string', value };
    }

    // Function calls
    if (this.match('FUNCTION')) {
      const name = this.currentToken().value;
      this.advance();
      
      if (!this.match('LPAREN')) {
        this.addError(`Expected '(' after function name '${name}'`);
        return { type: 'identifier', name };
      }
      
      this.advance(); // consume '('
      
      const args: ASTNode[] = [];
      
      if (!this.match('RPAREN')) {
        do {
          args.push(this.parseExpression());
        } while (this.match('COMMA') && this.advance());
      }
      
      if (!this.match('RPAREN')) {
        this.addError("Expected ')' after function arguments");
      } else {
        this.advance();
      }
      
      return {
        type: 'functionCall',
        name,
        arguments: args
      };
    }

    // Identifiers
    if (this.match('IDENTIFIER')) {
      const name = this.currentToken().value;
      this.advance();
      return { type: 'identifier', name };
    }

    // Parenthesized expressions
    if (this.match('LPAREN')) {
      this.advance(); // consume '('
      const node = this.parseExpression();
      
      if (!this.match('RPAREN')) {
        this.addError("Expected ')' after expression");
      } else {
        this.advance();
      }
      
      return node;
    }

    this.addError(`Unexpected token: ${this.currentToken().value}`);
    return { type: 'number', value: 0 };
  }

  /**
   * Evaluate AST node
   */
  private evaluateAST(node: ASTNode, context: FormulaContext): any {
    switch (node.type) {
      case 'number':
        return node.value;
        
      case 'string':
        return node.value;
        
      case 'identifier':
        // Look up variable in context
        return context.variables[node.name] || context.constants[node.name] || 0;
        
      case 'binaryOp':
        const left = this.evaluateAST(node.left, context);
        const right = this.evaluateAST(node.right, context);
        
        if (node.operator in OPERATORS) {
          return OPERATORS[node.operator as keyof typeof OPERATORS](left, right);
        } else if (node.operator in COMPARISON_OPERATORS) {
          return COMPARISON_OPERATORS[node.operator as keyof typeof COMPARISON_OPERATORS](left, right);
        }
        
        throw new Error(`Unknown operator: ${node.operator}`);
        
      case 'unaryOp':
        const operand = this.evaluateAST(node.operand, context);
        
        switch (node.operator) {
          case '+':
            return +operand;
          case '-':
            return -operand;
          case '!':
            return !operand;
          default:
            throw new Error(`Unknown unary operator: ${node.operator}`);
        }
        
      case 'functionCall':
        const args = node.arguments.map(arg => this.evaluateAST(arg, context));
        
        if (node.name in MATH_FUNCTIONS) {
          const func = MATH_FUNCTIONS[node.name as keyof typeof MATH_FUNCTIONS];
          // Type-safe function call handling
          return (func as any)(...args);
        } else if (node.name in SCORING_FUNCTIONS) {
          const func = SCORING_FUNCTIONS[node.name as keyof typeof SCORING_FUNCTIONS];
          // Type-safe function call handling for scoring functions
          return (func as any)(context, ...args);
        }
        
        throw new Error(`Unknown function: ${node.name}`);
        
      case 'conditional':
        const condition = this.evaluateAST(node.condition, context);
        return condition ? this.evaluateAST(node.trueValue, context) : this.evaluateAST(node.falseValue, context);
        
      default:
        throw new Error(`Unknown AST node type: ${(node as any).type}`);
    }
  }

  /**
   * Validate semantics of the AST
   */
  private validateSemantics(node: ASTNode): void {
    switch (node.type) {
      case 'functionCall':
        // Validate function exists
        if (!(node.name in MATH_FUNCTIONS) && !(node.name in SCORING_FUNCTIONS)) {
          this.addError(`Unknown function: ${node.name}`);
        }
        
        // Validate arguments recursively
        node.arguments.forEach(arg => this.validateSemantics(arg));
        break;
        
      case 'binaryOp':
        this.validateSemantics(node.left);
        this.validateSemantics(node.right);
        break;
        
      case 'unaryOp':
        this.validateSemantics(node.operand);
        break;
        
      case 'conditional':
        this.validateSemantics(node.condition);
        this.validateSemantics(node.trueValue);
        this.validateSemantics(node.falseValue);
        break;
    }
  }

  /**
   * Helper methods
   */
  private currentToken(): Token {
    return this.tokens[this.currentTokenIndex] || { type: 'EOF', value: '', position: 0, line: 0, column: 0 };
  }

  private match(type: TokenType): boolean {
    return this.currentToken().type === type;
  }

  private advance(): boolean {
    if (!this.isAtEnd()) {
      this.currentTokenIndex++;
      return true;
    }
    return false;
  }

  private isAtEnd(): boolean {
    return this.currentToken().type === 'EOF';
  }

  private addError(message: string): void {
    const token = this.currentToken();
    this.errors.push({
      type: 'syntax',
      message,
      position: {
        start: token.position,
        end: token.position + token.value.length,
        line: token.line,
        column: token.column
      },
      severity: 'error'
    });
  }

  private generateSuggestedFixes(): string[] {
    // Basic suggested fixes based on common errors
    const fixes: string[] = [];
    
    this.errors.forEach(error => {
      if (error.message.includes('Unknown function')) {
        fixes.push('Check function name spelling or use a supported function');
      } else if (error.message.includes('Expected')) {
        fixes.push('Check syntax for missing parentheses, commas, or operators');
      } else if (error.message.includes('Unknown character')) {
        fixes.push('Remove invalid characters from the expression');
      }
    });
    
    return fixes;
  }
}

/**
 * Utility functions for formula management
 */
export const FormulaUtils = {
  /**
   * Extract variables used in a formula
   */
  extractVariables(expression: string): FormulaVariable[] {
    const parser = new FormulaParser();
    const tokens = parser['tokenize'](expression);
    const variables: FormulaVariable[] = [];
    const seen = new Set<string>();
    
    tokens.forEach(token => {
      if (token.type === 'IDENTIFIER' && !seen.has(token.value)) {
        variables.push({
          name: token.value,
          type: 'reference',
          description: `Variable: ${token.value}`
        });
        seen.add(token.value);
      }
    });
    
    return variables;
  },

  /**
   * Extract functions used in a formula
   */
  extractFunctions(expression: string): FormulaFunction[] {
    const parser = new FormulaParser();
    const tokens = parser['tokenize'](expression);
    const functions: FormulaFunction[] = [];
    const seen = new Set<string>();
    
    tokens.forEach(token => {
      if (token.type === 'FUNCTION' && !seen.has(token.value)) {
        functions.push({
          name: token.value,
          parameters: [], // Would need more sophisticated parsing for actual parameters
          returnType: 'number',
          description: `Function: ${token.value}`
        });
        seen.add(token.value);
      }
    });
    
    return functions;
  },

  /**
   * Create a test context for formula validation
   */
  createTestContext(): FormulaContext {
    return {
      dimensions: {
        'fluency': 85,
        'adequacy': 90,
        'style': 80,
        'terminology': 95
      },
      errorTypes: {
        'minor': 2,
        'major': 1,
        'critical': 0
      },
      weights: {
        'fluency': 30,
        'adequacy': 40,
        'style': 20,
        'terminology': 10
      },
      totalErrors: 3,
      unitCount: 100,
      errorRate: 0.03,
      constants: {
        'pi': Math.PI,
        'e': Math.E
      },
      variables: {},
      maxScore: 100,
      passingThreshold: 85
    };
  }
}; 