FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV BBP_PYTHON_PATH=/opt/bbp-venv/bin/python

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-venv \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY requirements.txt ./
RUN python3 -m venv /opt/bbp-venv \
  && /opt/bbp-venv/bin/pip install --no-cache-dir -r requirements.txt

COPY . .

RUN npm run build

EXPOSE 8080

CMD ["npm", "start"]
