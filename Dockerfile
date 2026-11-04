# Hosted mode of Tiled Map Builder: the web page and the MCP tools over HTTP on one port.
# This is what runs on the Hugging Face Space (docs/hugging-face.md); it also runs anywhere:
#   docker build -t tiled-map-builder .
#   docker run -p 7860:7860 tiled-map-builder        # then open http://localhost:7860
# The image holds no token: every paid call uses the caller's own Hugging Face token.
FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
COPY tiled-mcp/package.json tiled-mcp/
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

ENV NODE_ENV=production HOST=0.0.0.0 PORT=7860
# Spaces run containers as uid 1000, which is the image's "node" user.
USER node
EXPOSE 7860
CMD ["node", "tiled-mcp/dist/http.js"]
