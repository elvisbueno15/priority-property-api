FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# The API lives in a public GitHub repo with dist/ prebuilt — clone and install
# runtime deps only. To pick up new code later: Settings -> Factory rebuild.
RUN git clone --depth 1 https://github.com/elvisbueno15/priority-property-api.git .
RUN npm install --omit=dev

RUN useradd -m -u 1000 user && mkdir -p /app/data && chown -R user:user /app
USER user

ENV PORT=7860 PPA_DATA_DIR=/app/data
EXPOSE 7860

CMD ["node", "dist/main.js"]
