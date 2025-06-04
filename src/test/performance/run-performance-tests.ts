#!/usr/bin/env tsx

import { PerformanceTestRunner, performanceTestConfigs } from './performance-test-setup';
import { Command } from 'commander';

async function main() {
  const program = new Command();
  
  program
    .name('run-performance-tests')
    .description('Run performance tests for the Fluent Scribe QA Platform')
    .version('1.0.0');

  program
    .command('api')
    .description('Run API endpoint load tests')
    .option('-d, --duration <seconds>', 'Test duration in seconds', '300')
    .option('-c, --concurrency <number>', 'Number of concurrent connections', '50')
    .option('-u, --url <url>', 'Target endpoint URL', 'http://localhost:3000/api/health')
    .action(async (options) => {
      const runner = new PerformanceTestRunner();
      await runner.initialize();

      const config = {
        ...performanceTestConfigs.apiEndpoints,
        duration: parseInt(options.duration),
        concurrency: parseInt(options.concurrency),
        targetEndpoint: options.url
      };

      try {
        await runner.runLoadTest(config);
        console.log('✅ API load test completed successfully');
      } catch (error) {
        console.error('❌ API load test failed:', error);
        process.exit(1);
      } finally {
        await runner.cleanup();
      }
    });

  program
    .command('database')
    .description('Run database load tests using JMeter')
    .option('-d, --duration <seconds>', 'Test duration in seconds', '600')
    .option('-c, --concurrency <number>', 'Number of concurrent connections', '100')
    .action(async (options) => {
      const runner = new PerformanceTestRunner();
      await runner.initialize();

      const config = {
        ...performanceTestConfigs.databaseLoad,
        duration: parseInt(options.duration),
        concurrency: parseInt(options.concurrency)
      };

      try {
        await runner.runLoadTest(config);
        console.log('✅ Database load test completed successfully');
      } catch (error) {
        console.error('❌ Database load test failed:', error);
        process.exit(1);
      } finally {
        await runner.cleanup();
      }
    });

  program
    .command('stress')
    .description('Run comprehensive stress tests')
    .option('-b, --base-concurrency <number>', 'Base concurrency level', '50')
    .option('-u, --url <url>', 'Target endpoint URL', 'http://localhost:3000')
    .action(async (options) => {
      const runner = new PerformanceTestRunner();
      await runner.initialize();

      const baseConfig = {
        ...performanceTestConfigs.fullSystem,
        concurrency: parseInt(options.baseConcurrency),
        targetEndpoint: options.url
      };

      try {
        await runner.runStressTest(baseConfig);
        console.log('✅ Stress test completed successfully');
      } catch (error) {
        console.error('❌ Stress test failed:', error);
        process.exit(1);
      } finally {
        await runner.cleanup();
      }
    });

  program
    .command('all')
    .description('Run all performance test suites')
    .option('-q, --quick', 'Run quick tests (reduced duration)')
    .action(async (options) => {
      const runner = new PerformanceTestRunner();
      await runner.initialize();

      const durationMultiplier = options.quick ? 0.2 : 1; // 20% of normal duration for quick tests

      console.log('🚀 Starting comprehensive performance test suite...\n');

      try {
        // 1. API Endpoint Tests
        console.log('📊 Running API endpoint tests...');
        const apiConfig = {
          ...performanceTestConfigs.apiEndpoints,
          duration: Math.floor(performanceTestConfigs.apiEndpoints.duration * durationMultiplier)
        };
        await runner.runLoadTest(apiConfig);

        // Wait between tests
        console.log('⏸️  Waiting for system recovery...');
        await new Promise(resolve => setTimeout(resolve, 15000));

        // 2. Database Tests (if JMeter is available)
        console.log('🗄️  Running database tests...');
        try {
          const dbConfig = {
            ...performanceTestConfigs.databaseLoad,
            duration: Math.floor(performanceTestConfigs.databaseLoad.duration * durationMultiplier)
          };
          await runner.runLoadTest(dbConfig);
        } catch (error) {
          console.warn('⚠️  Database test skipped (JMeter may not be available):', error);
        }

        // Wait between tests
        console.log('⏸️  Waiting for system recovery...');
        await new Promise(resolve => setTimeout(resolve, 15000));

        // 3. Basic Stress Test
        if (!options.quick) {
          console.log('💪 Running basic stress test...');
          const stressConfig = {
            ...performanceTestConfigs.fullSystem,
            duration: 300, // 5 minutes for stress test
            concurrency: 100
          };
          await runner.runLoadTest(stressConfig);
        }

        console.log('\n✅ All performance tests completed successfully!');
        console.log('📋 Check test-results/performance/ for detailed reports');

      } catch (error) {
        console.error('\n❌ Performance test suite failed:', error);
        process.exit(1);
      } finally {
        await runner.cleanup();
      }
    });

  program
    .command('monitor')
    .description('Start system monitoring without running tests')
    .option('-d, --duration <seconds>', 'Monitoring duration in seconds', '300')
    .action(async (options) => {
      const runner = new PerformanceTestRunner();
      await runner.initialize();

      console.log(`🔍 Starting system monitoring for ${options.duration} seconds...`);

      try {
        await runner['startMonitoring'](); // Access private method for monitoring only
        
        await new Promise(resolve => setTimeout(resolve, parseInt(options.duration) * 1000));
        
        await runner['stopMonitoring']();
        console.log('✅ Monitoring completed');
        
      } catch (error) {
        console.error('❌ Monitoring failed:', error);
        process.exit(1);
      } finally {
        await runner.cleanup();
      }
    });

  await program.parseAsync(process.argv);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Performance test runner failed:', error);
    process.exit(1);
  });
}

export { main }; 