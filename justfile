dev:
    bun run --watch scripts/dev.ts

build:
    bun build \
        --outdir ./dist \
        --root ./frontend \
        --watch \
        ./frontend/index.tsx

serve:
    bunx serve ./dist
