# Dinner with Charles — ordering app

## Workflow
- This folder (`~/Documents/GitHub/dinnerwithcharles`) is the only working copy. Never use the Desktop copy.
- After each change: `npm run build`, then `git commit` and `git push origin main`. Netlify auto-deploys in ~2 min.
- Before pushing, run the dev server and confirm multiple delivery time windows can be selected. Also confirm `.env` is not staged.
- Never commit `.env`, `.DS_Store` files, or API keys. Secrets go in Netlify environment variables.
- Commit each fix separately with a clear message.

## Stack
React + Vite, Supabase, Netlify (with serverless functions in `netlify/functions/`), Resend for email.

## Brand
- Forest green `#1B5E4E`, gold `#D4A373`, cream `#faf8f3`, border `#e0dbd1`.
- Sharp corners (no border-radius).
- System sans-serif font stack.
- Premium, spacious feel.
