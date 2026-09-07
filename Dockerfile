# Next.js Dockerfile
FROM node:20-alpine

WORKDIR /app

# 의존성 파일 복사 및 설치
COPY package*.json ./
RUN npm ci

# 소스 복사
COPY . .

# Next.js 빌드
RUN npm run build

EXPOSE 3000

# 프로덕션 실행
CMD ["npm", "start"]
