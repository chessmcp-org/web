FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile --production
COPY src ./src
COPY assets ./assets
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
USER bun
CMD ["bun", "src/index.ts"]
