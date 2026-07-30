FROM node:20-alpine

WORKDIR /app

# Install deps first (better cache)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

RUN addgroup -S -g 10001 wallet && adduser -S -D -H -u 10001 -G wallet wallet \
  && mkdir -p /app/uploads \
  && chown -R wallet:wallet /app

USER wallet

EXPOSE 3001
CMD ["node", "server.js"]
