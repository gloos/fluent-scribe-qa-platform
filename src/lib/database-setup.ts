import { supabase } from '@/lib/supabase';
import { initializeAccountDeletionScheduler } from '@/lib/jobs/accountDeletionJob';
import fs from 'fs';
import path from 'path';

/**
 * Database Setup Utility
 * This file contains functions to set up the database schema and initialize
 * the account deletion system.
 */

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Apply the account deletion database schema
 * This should be run during application initialization
 */
export async function applyAccountDeletionSchema(): Promise<void> {
  try {
    console.log('Applying account deletion database schema...');

    // Read the SQL schema file
    const schemaPath = path.join(process.cwd(), 'src/lib/account-deletion-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split the schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    // Execute each statement
    for (const statement of statements) {
      const { error } = await supabase.rpc('exec_sql', { 
        sql_statement: statement + ';' 
      });

      if (error) {
        console.error('Error executing SQL statement:', statement);
        console.error('Error details:', error);
        throw error;
      }
    }

    console.log('Account deletion schema applied successfully');
  } catch (error) {
    console.error('Failed to apply account deletion schema:', error);
    throw error;
  }
}

/**
 * Initialize the account deletion job scheduler
 * This starts the automated processing of deletion requests
 */
export function startAccountDeletionScheduler(): void {
  if (schedulerInterval) {
    console.log('Account deletion scheduler already running');
    return;
  }

  try {
    console.log('Starting account deletion scheduler...');
    schedulerInterval = initializeAccountDeletionScheduler();
    console.log('Account deletion scheduler started successfully');
  } catch (error) {
    console.error('Failed to start account deletion scheduler:', error);
    throw error;
  }
}

/**
 * Stop the account deletion job scheduler
 * This stops the automated processing
 */
export function stopAccountDeletionScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('Account deletion scheduler stopped');
  } else {
    console.log('Account deletion scheduler is not running');
  }
}

/**
 * Initialize the complete account deletion system
 * This applies the schema and starts the scheduler
 */
export async function initializeAccountDeletionSystem(): Promise<void> {
  try {
    console.log('Initializing account deletion system...');
    
    // Apply database schema
    await applyAccountDeletionSchema();
    
    // Start the scheduler (only in production or when explicitly enabled)
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DELETION_SCHEDULER === 'true') {
      startAccountDeletionScheduler();
    } else {
      console.log('Account deletion scheduler disabled in development mode');
      console.log('Set ENABLE_DELETION_SCHEDULER=true to enable in development');
    }
    
    console.log('Account deletion system initialized successfully');
  } catch (error) {
    console.error('Failed to initialize account deletion system:', error);
    throw error;
  }
}

/**
 * Verify that the account deletion system is properly set up
 */
export async function verifyAccountDeletionSetup(): Promise<boolean> {
  try {
    // Check if the deletion_requests table exists
    const { data, error } = await supabase
      .from('deletion_requests')
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.error('Account deletion system verification failed:', error);
      return false;
    }

    console.log('Account deletion system verification passed');
    return true;
  } catch (error) {
    console.error('Account deletion system verification failed:', error);
    return false;
  }
}

/**
 * Utility function to create an exec_sql function in Supabase if it doesn't exist
 * This is needed to execute the schema statements
 */
export async function createExecSqlFunction(): Promise<void> {
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION exec_sql(sql_statement text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE sql_statement;
    END;
    $$;
  `;

  const { error } = await supabase.rpc('exec', { 
    sql: createFunctionSQL 
  });

  if (error) {
    console.warn('Could not create exec_sql function:', error);
    // This might fail if the function already exists or permissions are insufficient
    // In production, this should be handled through migrations
  }
}

// Export default initialization function
export default initializeAccountDeletionSystem; 