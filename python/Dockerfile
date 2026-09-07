# Python ML Server Dockerfile
FROM python:3.11-slim

WORKDIR /app

# 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스 및 모델 복사
COPY . .

EXPOSE 5001

# Flask 서버 실행
CMD ["python", "ml_server_weather.py"]
