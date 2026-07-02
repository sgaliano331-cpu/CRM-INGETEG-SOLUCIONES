FROM node:18-bookworm

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm install

COPY client/package*.json ./client/
RUN cd client && npm install

COPY . .

RUN cd client && npm run build

EXPOSE 3001

CMD ["node", "server/server.js"]
