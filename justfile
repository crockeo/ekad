run:
    go run ./cmd/ek

test:
    go test -count=1 ./...

install:
    go install ./cmd/ek
