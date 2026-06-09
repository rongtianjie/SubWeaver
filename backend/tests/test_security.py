"""
测试核心安全模块：JWT 令牌生成/验证、密码哈希。
"""

import time
from datetime import timedelta

import pytest

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_access_token,
)


class TestPasswordHashing:
    """密码哈希与验证测试"""

    def test_hash_and_verify(self):
        """测试密码哈希和验证的基本流程"""
        password = "my_secure_password_123!"
        hashed = hash_password(password)

        # 哈希结果不能是明文
        assert hashed != password
        # 正确密码应验证通过
        assert verify_password(password, hashed)
        # 错误密码应验证失败
        assert not verify_password("wrong_password", hashed)

    def test_hash_is_deterministic(self):
        """每次 hash 结果应不同（bcrypt 自动加盐）"""
        password = "same_password"
        h1 = hash_password(password)
        h2 = hash_password(password)
        assert h1 != h2
        # 但都能验证
        assert verify_password(password, h1)
        assert verify_password(password, h2)

    def test_empty_password(self):
        """空密码也应正常工作"""
        hashed = hash_password("")
        assert verify_password("", hashed)
        assert not verify_password("a", hashed)

    def test_long_password(self):
        """长密码（100 字符）"""
        long_pwd = "a" * 100
        hashed = hash_password(long_pwd)
        assert verify_password(long_pwd, hashed)


class TestJWTToken:
    """JWT 令牌测试"""

    def test_create_and_decode_access_token(self):
        """创建和解码 access token"""
        payload = {"sub": "user-123", "role": "user"}
        token = create_access_token(payload)

        assert isinstance(token, str)
        assert len(token.split(".")) == 3  # JWT 格式：header.payload.signature

        decoded = decode_access_token(token)
        assert decoded["sub"] == "user-123"
        assert decoded["role"] == "user"
        assert "exp" in decoded

    def test_create_and_decode_refresh_token(self):
        """创建和解码 refresh token"""
        payload = {"sub": "user-456", "role": "admin"}
        token = create_refresh_token(payload)

        decoded = decode_access_token(token)
        assert decoded["sub"] == "user-456"
        assert decoded["role"] == "admin"

    def test_access_token_expiry(self):
        """验证 access token 过期时间设置"""
        payload = {"sub": "test"}
        token = create_access_token(payload, expires_delta=timedelta(seconds=1))

        decoded = decode_access_token(token)
        assert "exp" in decoded

        # 等待 token 过期
        time.sleep(2.5)
        with pytest.raises(ValueError, match="无效的 token"):
            decode_access_token(token)

    def test_invalid_token_format(self):
        """无效格式的 token"""
        with pytest.raises(ValueError, match="无效的 token"):
            decode_access_token("not-a-valid-token")

    def test_tampered_token(self):
        """被篡改的 token"""
        payload = {"sub": "user-789"}
        token = create_access_token(payload)
        # 篡改 payload 部分
        parts = token.split(".")
        tampered = parts[0] + "." + "eyJzdWIiOiAiYWRtaW4ifQ" + "." + parts[2]
        with pytest.raises(ValueError, match="无效的 token"):
            decode_access_token(tampered)

    def test_token_with_additional_claims(self):
        """携带自定义声明的 token"""
        payload = {"sub": "user-999", "role": "user", "custom": "value"}
        token = create_access_token(payload)
        decoded = decode_access_token(token)
        assert decoded["custom"] == "value"

    def test_refresh_token_has_longer_expiry(self):
        """验证 refresh token > access token 的过期时间"""
        access_token = create_access_token({"sub": "test"})
        refresh_token = create_refresh_token({"sub": "test"})

        access_decoded = decode_access_token(access_token)
        refresh_decoded = decode_access_token(refresh_token)

        # refresh token 的过期时间应该比 access token 长
        assert refresh_decoded["exp"] > access_decoded["exp"]
