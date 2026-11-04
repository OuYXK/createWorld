-- 容器首次初始化（data 目录为空时）自动执行，仅执行一次。
-- 若 data/postgres 已有数据，本脚本不会重跑，需手工执行：
--   docker exec -i cw-postgres psql -U cw -d create_world < 01-init.sql

-- pgvector：核心依赖。用 DO 块包裹，避免因镜像不含该扩展导致
-- initdb 失败、容器直接退出（换镜像调试时很常见）。
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
    RAISE NOTICE '[init] pgvector 已就绪';
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[init] pgvector 不可用（%），已跳过。当前镜像不是 pgvector/pgvector，向量检索相关功能不可用', SQLERRM;
END $$;

-- pg_trgm：模糊搜索（标题相似度），PostgreSQL contrib 自带
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 校验
SELECT extname AS 扩展, extversion AS 版本
FROM pg_extension
WHERE extname IN ('vector', 'pg_trgm');

SHOW timezone;
SHOW server_encoding;
