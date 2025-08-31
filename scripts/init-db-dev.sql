-- PostgreSQL 개발환경 초기화 스크립트

-- 확장 프로그램 설치
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 개발용 스키마
CREATE SCHEMA IF NOT EXISTS dev_audit;
CREATE SCHEMA IF NOT EXISTS dev_security;

-- 개발용 테스트 데이터
CREATE TABLE IF NOT EXISTS dev_audit.test_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_name VARCHAR(100),
    result VARCHAR(20),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 개발용 디버그 함수
CREATE OR REPLACE FUNCTION debug_info()
RETURNS TEXT AS $$
BEGIN
    RETURN '개발 데이터베이스 연결 성공 - ' || NOW();
END;
$$ LANGUAGE plpgsql;

-- 개발 환경 확인
SELECT debug_info();