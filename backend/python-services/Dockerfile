FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

ENV PYTHON_SERVICE_PORT=8000
ENV PYTHONUNBUFFERED=1

CMD ["python", "api_server.py"]
