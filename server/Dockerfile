# Build context is the repo root (see docker-compose.yml: context: ..,
# dockerfile: server/Dockerfile) -- the server needs site/lut-io.js and
# scripts/lib/*, which live outside server/, so the context can't be
# server/ itself.
FROM node:24-alpine

# node:sqlite is a built-in module as of Node 22.5, still marked experimental
# as of this image's Node version -- see README.md "Known limitations."
WORKDIR /app
COPY server /app/server
COPY site/lut-io.js site/color-spaces.js /app/site/
COPY scripts/lib /app/scripts/lib

RUN mkdir -p /data/db

EXPOSE 8420
CMD ["node", "--experimental-sqlite", "server/index.mjs"]
