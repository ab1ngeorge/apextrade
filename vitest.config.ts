import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { existsSync } from 'node:fs';
if(existsSync('.env'))process.loadEnvFile('.env');
if(process.env.TEST_DATABASE_URL)process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
export default defineConfig({resolve:{alias:{'@':path.resolve(__dirname,'src')}},test:{include:['tests/**/*.test.ts'],fileParallelism:false,testTimeout:30000}});
