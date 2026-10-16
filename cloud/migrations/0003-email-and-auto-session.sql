-- 仅新增表；旧账号、工作台和媒体保持原身份。旧用户名不自动视为已验证邮箱。
CREATE TABLE IF NOT EXISTS account_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, email TEXT UNIQUE, display_name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS email_codes(email TEXT NOT NULL, purpose TEXT NOT NULL, digest TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, sent INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(email,purpose));
CREATE TABLE IF NOT EXISTS capture_sessions(token_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash) ON DELETE CASCADE, parent_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE);
