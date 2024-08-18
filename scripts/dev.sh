#!/usr/bin/env bash

trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

pids=()
bun build \
	--outdir=./dist \
	--root=./frontend \
	--watch \
	./frontend/index.tsx \
	&
pids+=($!)

bunx serve ./dist &
pids+=($!)

bun run tailwindcss \
	--input ./frontend/index.css \
	--output ./dist/index.css \
	--watch \
	&
pids+=($!)

wait ${pids[@]}
