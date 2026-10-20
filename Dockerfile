FROM node:22-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm install --no-package-lock
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM node:22-alpine AS backend
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev --no-package-lock
COPY backend/ ./
EXPOSE 3001
CMD ["node", "--watch", "server.js"]

FROM frontend AS frontend-build
ARG VITE_API_BASE_URL
ARG VITE_PORTAL_API_BASE_URL
ARG VITE_PORTAL_URL
RUN npm run build

FROM node:22-alpine AS frontend-production
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-package-lock
COPY --from=frontend-build /app/dist ./dist
COPY server.js ./
USER node
EXPOSE 8080
CMD ["node", "server.js"]

FROM backend AS backend-production
ENV NODE_ENV=production PORT=3000
USER node
EXPOSE 3000
CMD ["node", "server.js"]
