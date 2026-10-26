import { defineConfig,devices } from '@playwright/test';
import { existsSync } from 'node:fs';
if(existsSync('.env'))process.loadEnvFile('.env');
export default defineConfig({testDir:'./tests/e2e',fullyParallel:false,workers:1,globalSetup:'./tests/e2e/setup.ts',reporter:[['list'],['html',{open:'never'}],['json',{outputFile:'test-results/results.json'}]],use:{baseURL:'http://localhost:3000',trace:'retain-on-failure',screenshot:'only-on-failure'},projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],webServer:{command:'npm run dev',url:'http://localhost:3000',reuseExistingServer:false,timeout:120000,env:{DATABASE_URL:process.env.TEST_DATABASE_URL??'',APP_ORIGIN:'http://localhost:3000'}}});
