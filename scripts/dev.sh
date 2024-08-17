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

open http://localhost:3000

wait ${pids[@]}
