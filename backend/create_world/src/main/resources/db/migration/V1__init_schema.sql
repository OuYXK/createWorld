-- ============================================================
-- 创意孵化台 · 初始化表结构
-- 由 Flyway 在应用启动时自动执行（db/migration）
-- 约定：主键 BIGINT 雪花，前端一律按 string 传输；时间统一 TIMESTAMPTZ
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ------------------------------------------------------------
-- 用户
-- ------------------------------------------------------------
CREATE TABLE sys_user (
    id            BIGINT PRIMARY KEY,
    username      VARCHAR(64)   NOT NULL,
    nickname      VARCHAR(64)   NOT NULL,
    password_hash VARCHAR(100)  NOT NULL,
    avatar_url    VARCHAR(512),
    bio           VARCHAR(256),
    role          VARCHAR(16)   NOT NULL DEFAULT 'USER',
    trust_weight  NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
    risk_flag     SMALLINT      NOT NULL DEFAULT 0,
    points        INTEGER       NOT NULL DEFAULT 0,
    deleted       SMALLINT      NOT NULL DEFAULT 0,
    created_time  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_time  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uk_user_username ON sys_user (username) WHERE deleted = 0;

COMMENT ON TABLE sys_user IS '用户';
COMMENT ON COLUMN sys_user.trust_weight IS '打分权重 0.00~1.00，用于社区分聚合';
COMMENT ON COLUMN sys_user.risk_flag IS '0 正常 / 1 观察 / 2 冻结';

-- ------------------------------------------------------------
-- 分类与标签
-- ------------------------------------------------------------
CREATE TABLE idea_category (
    id           BIGINT PRIMARY KEY,
    name         VARCHAR(32) NOT NULL,
    code         VARCHAR(32) NOT NULL,
    sort         INTEGER     NOT NULL DEFAULT 0,
    enabled      SMALLINT    NOT NULL DEFAULT 1,
    created_time TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uk_category_code ON idea_category (code);

CREATE TABLE idea_tag (
    id           BIGINT PRIMARY KEY,
    name         VARCHAR(32) NOT NULL,
    use_count    INTEGER     NOT NULL DEFAULT 0,
    created_time TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uk_tag_name ON idea_tag (name);

CREATE TABLE idea_tag_rel (
    idea_id BIGINT NOT NULL,
    tag_id  BIGINT NOT NULL,
    PRIMARY KEY (idea_id, tag_id)
);
CREATE INDEX idx_tag_rel_tag ON idea_tag_rel (tag_id);

-- ------------------------------------------------------------
-- 创意主表
-- ------------------------------------------------------------
CREATE TABLE idea (
    id                   BIGINT PRIMARY KEY,
    title                VARCHAR(120)  NOT NULL,
    cover_url            VARCHAR(512),
    category_id          BIGINT        NOT NULL,
    author_id            BIGINT        NOT NULL,
    status               SMALLINT      NOT NULL DEFAULT 0,
    summary              VARCHAR(500),
    background           TEXT,
    goal                 TEXT,
    plan_text            TEXT,
    expect_effect        TEXT,
    est_cost             VARCHAR(64),
    est_duration         VARCHAR(64),
    view_count           BIGINT        NOT NULL DEFAULT 0,
    favorite_count       BIGINT        NOT NULL DEFAULT 0,
    comment_count        BIGINT        NOT NULL DEFAULT 0,
    score_count          INTEGER       NOT NULL DEFAULT 0,
    score_sum            NUMERIC(12, 2) NOT NULL DEFAULT 0,
    score_avg            NUMERIC(4, 2),
    score_bayes          NUMERIC(4, 2),
    ai_score_total       NUMERIC(4, 2),
    ai_creativity_score  NUMERIC(4, 2),
    ai_feasibility_score NUMERIC(4, 2),
    ai_report_id         BIGINT,
    latest_task_id       BIGINT,
    publish_time         TIMESTAMPTZ,
    deleted              SMALLINT      NOT NULL DEFAULT 0,
    created_time         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_time         TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_idea_author   ON idea (author_id, status);
CREATE INDEX idx_idea_category ON idea (category_id, status, publish_time DESC);
CREATE INDEX idx_idea_ai_score ON idea (ai_score_total DESC) WHERE status = 1 AND deleted = 0;
CREATE INDEX idx_idea_bayes    ON idea (score_bayes DESC)    WHERE status = 1 AND deleted = 0;
CREATE INDEX idx_idea_publish  ON idea (publish_time DESC)   WHERE status = 1 AND deleted = 0;
CREATE INDEX idx_idea_title_trgm ON idea USING gin (title gin_trgm_ops);

COMMENT ON TABLE idea IS '创意主表';
COMMENT ON COLUMN idea.status IS '0 草稿 / 1 已发布 / 2 已归档 / 3 已下架';
COMMENT ON COLUMN idea.score_sum IS '社区原始分总和，与 score_count 一起做原子累加';
COMMENT ON COLUMN idea.score_bayes IS '贝叶斯加权分，榜单排序用';

-- ------------------------------------------------------------
-- 向量切片
-- ------------------------------------------------------------
CREATE TABLE idea_chunk (
    id           BIGINT PRIMARY KEY,
    idea_id      BIGINT        NOT NULL,
    chunk_index  SMALLINT      NOT NULL,
    chunk_type   VARCHAR(16)   NOT NULL,
    content      TEXT          NOT NULL,
    token_count  INTEGER       NOT NULL DEFAULT 0,
    embedding    vector(1024)  NOT NULL,
    created_time TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_chunk_idea ON idea_chunk (idea_id);
CREATE INDEX idx_chunk_vec  ON idea_chunk USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

COMMENT ON TABLE idea_chunk IS '创意切片向量，用于查重与语义检索';
COMMENT ON COLUMN idea_chunk.chunk_type IS 'TITLE / SUMMARY / PLAN / AI_REPORT';
COMMENT ON COLUMN idea_chunk.embedding IS 'text-embedding-v3，1024 维；换模型需重建该列与索引';

-- ------------------------------------------------------------
-- 分析任务
-- ------------------------------------------------------------
CREATE TABLE ai_analysis_task (
    id             BIGINT PRIMARY KEY,
    idea_id        BIGINT       NOT NULL,
    user_id        BIGINT       NOT NULL,
    mode           SMALLINT     NOT NULL,
    status         SMALLINT     NOT NULL DEFAULT 0,
    stage          VARCHAR(32),
    progress       SMALLINT     NOT NULL DEFAULT 0,
    report_id      BIGINT,
    model_name     VARCHAR(64),
    prompt_version VARCHAR(16),
    token_input    INTEGER      NOT NULL DEFAULT 0,
    token_output   INTEGER      NOT NULL DEFAULT 0,
    cost_ms        INTEGER,
    error_code     VARCHAR(64),
    error_msg      VARCHAR(1000),
    retry_count    SMALLINT     NOT NULL DEFAULT 0,
    started_time   TIMESTAMPTZ,
    finished_time  TIMESTAMPTZ,
    created_time   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_idea   ON ai_analysis_task (idea_id, created_time DESC);
CREATE INDEX idx_task_status ON ai_analysis_task (status, created_time) WHERE status IN (0, 1);

COMMENT ON TABLE ai_analysis_task IS 'AI 分析任务';
COMMENT ON COLUMN ai_analysis_task.mode IS '1 轻量 / 2 深度';
COMMENT ON COLUMN ai_analysis_task.status IS '0 排队 / 1 分析中 / 2 成功 / 3 失败 / 4 已取消';

-- ------------------------------------------------------------
-- 分析报告（版本化）
-- ------------------------------------------------------------
CREATE TABLE ai_analysis_report (
    id                   BIGINT PRIMARY KEY,
    idea_id              BIGINT        NOT NULL,
    task_id              BIGINT        NOT NULL,
    version              SMALLINT      NOT NULL DEFAULT 1,
    is_active            SMALLINT      NOT NULL DEFAULT 1,
    creativity_score     NUMERIC(4, 2) NOT NULL,
    creativity_reason    TEXT,
    feasibility_level    SMALLINT      NOT NULL,
    feasibility_score    NUMERIC(4, 2) NOT NULL,
    feasibility_reason   TEXT,
    total_score          NUMERIC(4, 2) NOT NULL,
    dedup_result         JSONB,
    risk_list            JSONB,
    roadmap              JSONB,
    roadmap_mermaid      TEXT,
    tech_stack           JSONB,
    capability_list      JSONB,
    suggestions          JSONB,
    dedup_max_similarity NUMERIC(4, 3),
    model_name           VARCHAR(64)   NOT NULL,
    prompt_version       VARCHAR(16)   NOT NULL,
    raw_response         TEXT,
    parse_status         SMALLINT      NOT NULL DEFAULT 1,
    created_time         TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_report_idea ON ai_analysis_report (idea_id, version DESC);
CREATE UNIQUE INDEX uk_report_active ON ai_analysis_report (idea_id) WHERE is_active = 1;

COMMENT ON TABLE ai_analysis_report IS 'AI 分析报告，同一创意仅一条 is_active=1';
COMMENT ON COLUMN ai_analysis_report.feasibility_level IS '1 高 / 2 中 / 3 低';
COMMENT ON COLUMN ai_analysis_report.parse_status IS '1 解析成功 / 2 部分降级 / 3 解析失败';

-- ------------------------------------------------------------
-- 社区打分（一人一票）
-- ------------------------------------------------------------
CREATE TABLE community_score (
    id            BIGINT PRIMARY KEY,
    idea_id       BIGINT        NOT NULL,
    user_id       BIGINT        NOT NULL,
    score         NUMERIC(4, 2) NOT NULL,
    short_comment VARCHAR(140),
    weight        NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
    client_ip     VARCHAR(64),
    deleted       SMALLINT      NOT NULL DEFAULT 0,
    created_time  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_time  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_score_range CHECK (score >= 0 AND score <= 10)
);
CREATE UNIQUE INDEX uk_score_idea_user ON community_score (idea_id, user_id) WHERE deleted = 0;
CREATE INDEX idx_score_user ON community_score (user_id, created_time DESC);
CREATE INDEX idx_score_idea ON community_score (idea_id);

COMMENT ON TABLE community_score IS '社区打分，(idea_id, user_id) 唯一，重复提交视为修改';

-- ------------------------------------------------------------
-- 评论
-- ------------------------------------------------------------
CREATE TABLE idea_comment (
    id            BIGINT PRIMARY KEY,
    idea_id       BIGINT        NOT NULL,
    user_id       BIGINT        NOT NULL,
    parent_id     BIGINT        NOT NULL DEFAULT 0,
    root_id       BIGINT        NOT NULL DEFAULT 0,
    reply_user_id BIGINT,
    content       VARCHAR(1000) NOT NULL,
    like_count    INTEGER       NOT NULL DEFAULT 0,
    status        SMALLINT      NOT NULL DEFAULT 0,
    deleted       SMALLINT      NOT NULL DEFAULT 0,
    created_time  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_comment_idea ON idea_comment (idea_id, status, created_time DESC);
CREATE INDEX idx_comment_root ON idea_comment (root_id, created_time);

COMMENT ON TABLE idea_comment IS '评论，只做两级：一级评论 + 楼内回复';
COMMENT ON COLUMN idea_comment.root_id IS '一级评论 id，二级评论归属楼中楼';

CREATE TABLE idea_comment_like (
    comment_id BIGINT NOT NULL,
    user_id    BIGINT NOT NULL,
    PRIMARY KEY (comment_id, user_id)
);

-- ------------------------------------------------------------
-- 收藏与关注
-- ------------------------------------------------------------
CREATE TABLE idea_favorite (
    id           BIGINT PRIMARY KEY,
    idea_id      BIGINT      NOT NULL,
    user_id      BIGINT      NOT NULL,
    created_time TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uk_favorite ON idea_favorite (idea_id, user_id);
CREATE INDEX idx_favorite_user ON idea_favorite (user_id, created_time DESC);

CREATE TABLE user_follow (
    id           BIGINT PRIMARY KEY,
    follower_id  BIGINT      NOT NULL,
    followee_id  BIGINT      NOT NULL,
    created_time TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uk_follow ON user_follow (follower_id, followee_id);

-- ------------------------------------------------------------
-- 运营支撑
-- ------------------------------------------------------------
CREATE TABLE ai_scoring_config (
    id                 BIGINT PRIMARY KEY,
    name               VARCHAR(64)   NOT NULL,
    weight_creativity  NUMERIC(3, 2) NOT NULL DEFAULT 0.40,
    weight_feasibility NUMERIC(3, 2) NOT NULL DEFAULT 0.60,
    dedup_threshold    NUMERIC(4, 3) NOT NULL DEFAULT 0.850,
    dedup_top_k        SMALLINT      NOT NULL DEFAULT 5,
    temperature        NUMERIC(3, 2) NOT NULL DEFAULT 0.30,
    is_active          SMALLINT      NOT NULL DEFAULT 0,
    remark             VARCHAR(256),
    created_time       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_weight_sum CHECK (weight_creativity + weight_feasibility = 1.00)
);
CREATE UNIQUE INDEX uk_config_active ON ai_scoring_config (is_active) WHERE is_active = 1;

CREATE TABLE ai_calibration_sample (
    id                 BIGINT PRIMARY KEY,
    title              VARCHAR(120)  NOT NULL,
    plan_text          TEXT          NOT NULL,
    expect_creativity  NUMERIC(4, 2) NOT NULL,
    expect_feasibility NUMERIC(4, 2) NOT NULL,
    expect_level       SMALLINT      NOT NULL,
    label_note         VARCHAR(512),
    enabled            SMALLINT      NOT NULL DEFAULT 1,
    created_time       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE risk_event (
    id           BIGINT PRIMARY KEY,
    user_id      BIGINT,
    ip           VARCHAR(64),
    biz_type     VARCHAR(32) NOT NULL,
    biz_id       BIGINT,
    rule_code    VARCHAR(64) NOT NULL,
    action       SMALLINT    NOT NULL,
    detail       JSONB,
    created_time TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_risk_user ON risk_event (user_id, created_time DESC);

CREATE TABLE report_export (
    id           BIGINT PRIMARY KEY,
    report_id    BIGINT      NOT NULL,
    user_id      BIGINT      NOT NULL,
    format       VARCHAR(8)  NOT NULL,
    status       SMALLINT    NOT NULL DEFAULT 0,
    file_url     VARCHAR(512),
    created_time TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE risk_event IS '风控事件；只调权重并留痕，不做静默删分';
