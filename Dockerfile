FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Generate prisma client (needed for the workers to talk to the DB)
RUN npx prisma generate

# Back4App REQUIRES a web port to be exposed, even if we are just running background workers
EXPOSE 3000

# We start a tiny dummy HTTP server on port 3000 to keep Back4App's health checks happy,
# and we run the Kafka background workers simultaneously.
CMD ["sh", "-c", "node -e \"require('http').createServer((req,res)=>{res.writeHead(200);res.end('Workers Health Check OK');}).listen(3000);\" & npm run start:workers"]
