#!/bin/bash

# SSL 인증서 생성 스크립트 (개발용)
# 프로덕션에서는 Let's Encrypt 또는 실제 인증서 사용

SSL_DIR="./ssl"
CERT_FILE="$SSL_DIR/cert.pem"
KEY_FILE="$SSL_DIR/key.pem"

echo "개발용 SSL 인증서 생성 중..."

# SSL 디렉토리 생성
mkdir -p $SSL_DIR

# 개발용 자체 서명 인증서 생성
openssl req -x509 -newkey rsa:4096 -keyout $KEY_FILE -out $CERT_FILE -days 365 -nodes \
  -subj "/C=KR/ST=Seoul/L=Seoul/O=SecondhandAPI/OU=Development/CN=localhost"

# 권한 설정
chmod 600 $KEY_FILE
chmod 644 $CERT_FILE

echo "SSL 인증서 생성 완료:"
echo "  인증서: $CERT_FILE"
echo "  개인키: $KEY_FILE"
echo ""
echo "⚠️  주의: 이는 개발용 자체 서명 인증서입니다."
echo "   프로덕션에서는 실제 SSL 인증서를 사용하세요."