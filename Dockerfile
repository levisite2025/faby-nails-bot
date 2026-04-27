FROM ghcr.io/puppeteer/puppeteer:latest

USER root

# Instalar dependências para o SQLite e outras ferramentas
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Porta que o Render vai usar
EXPOSE 3000

CMD ["node", "server.js"]
