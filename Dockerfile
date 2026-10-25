FROM node:22-alpine

# Install python3 & sqlite for shared Wikipedia harvester + SQLite DB
RUN apk add --no-cache python3 sqlite

WORKDIR /app

COPY package.json server.js server.py start.sh ./
COPY hub ./hub
COPY games ./games

RUN mkdir -p /app/data && chmod +x /app/start.sh /app/server.js /app/server.py /app/games/kattfisking/wiki_harvester.py

ENV PORT=3000
ENV HOST=0.0.0.0
ENV KATTFISKING_DB=/app/data/kattfisking.db

EXPOSE 3000

CMD ["node", "server.js"]
