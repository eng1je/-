FROM node:20-slim

WORKDIR /app

# better-sqlite3 native dependency build
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /data/uploads/exams
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data
ENV UPLOAD_DIR=/data/uploads

EXPOSE 3000
CMD ["npm", "start"]