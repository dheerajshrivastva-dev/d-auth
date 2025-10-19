import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true, // Generate .d.ts files like tsconfig.build.json
  clean: true,
  minify: true,
  splitting: false,
  sourcemap: false,
  treeshake: true,
  target: 'es2020', // Matches tsconfig target
  outDir: 'dist',
  skipNodeModulesBundle: true,
  // Externalize all dependencies and peerDependencies
  external: [
    'connect-mongo',
    'cors',
    'dotenv',
    'express-validation',
    'uuid',
    'winston',
    'bcryptjs',
    'cookie-parser',
    'express',
    'express-rate-limit',
    'express-session',
    'jsonwebtoken',
    'mongoose',
    'nodemailer',
    'passport',
    'passport-apple',
    'passport-facebook',
    'passport-google-oauth20',
    'passport-local',
    'ua-parser-js',
  ],
});
