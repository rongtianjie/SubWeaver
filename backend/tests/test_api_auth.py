"""
测试认证 API 端点。
使用 httpx + AsyncClient 进行集成测试，打桩 service 层而非 DB 层。
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient, ASGITransport

from app.core.security import create_access_token


@pytest.fixture
def test_app():
    """创建测试用 FastAPI 实例（无 lifespan）"""
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from app.api.v1 import auth, health

    app = FastAPI(lifespan=None)
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])
    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(health.router, prefix="/api/v1")

    @app.get("/")
    async def root():
        return {"service": "Whisper Platform", "version": "1.0.0", "docs": "/docs"}

    return app


@pytest.fixture
async def client(test_app):
    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as ac:
        yield ac


class TestAuthAPI:

    @pytest.mark.asyncio
    async def test_register_success(self, client):
        """注册成功"""
        fake_user = MagicMock()
        fake_user.id = uuid.uuid4()
        fake_user.username = "newuser"
        fake_user.email = "new@example.com"
        fake_user.role = "user"
        fake_user.is_active = True
        fake_user.created_at = datetime.now(timezone.utc)

        with patch("app.api.v1.auth.auth_service.register", new_callable=AsyncMock, return_value=fake_user):
            response = await client.post("/api/v1/auth/register", json={
                "username": "newuser",
                "email": "new@example.com",
                "password": "password123",
            })

        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "newuser"
        assert data["email"] == "new@example.com"

    @pytest.mark.asyncio
    async def test_register_invalid_data(self, client):
        """无效输入应返回 422"""
        # 用户名太短
        resp = await client.post("/api/v1/auth/register", json={
            "username": "ab", "email": "a@b.com", "password": "pass123"
        })
        assert resp.status_code == 422

        # 无效邮箱
        resp = await client.post("/api/v1/auth/register", json={
            "username": "test", "email": "invalid", "password": "pass123"
        })
        assert resp.status_code == 422

        # 密码太短
        resp = await client.post("/api/v1/auth/register", json={
            "username": "test", "email": "a@b.com", "password": "12345"
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_register_duplicate_username(self, client):
        """重复用户名应返回 400"""
        with patch("app.api.v1.auth.auth_service.register",
                   new_callable=AsyncMock, side_effect=ValueError("用户名已存在")):
            response = await client.post("/api/v1/auth/register", json={
                "username": "existing", "email": "a@b.com", "password": "password123",
            })

        assert response.status_code == 400
        assert "用户名已存在" in response.text

    @pytest.mark.asyncio
    async def test_login_success(self, client):
        """登录成功"""
        fake_user = MagicMock()
        fake_user.id = uuid.uuid4()
        access_token = create_access_token({"sub": str(fake_user.id), "role": "user"})
        refresh_token = create_access_token({"sub": str(fake_user.id), "role": "user"})

        with patch("app.api.v1.auth.auth_service.login",
                   new_callable=AsyncMock,
                   return_value=(fake_user, access_token, refresh_token)):
            response = await client.post("/api/v1/auth/login", json={
                "username": "testuser", "password": "password123",
            })

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self, client):
        """无效凭据应返回 401"""
        with patch("app.api.v1.auth.auth_service.login",
                   new_callable=AsyncMock, side_effect=ValueError("用户名或密码错误")):
            response = await client.post("/api/v1/auth/login", json={
                "username": "wrong", "password": "wrong",
            })

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_token_valid(self, client):
        """有效的 refresh token 应返回新 access token"""
        sub = str(uuid.uuid4())
        refresh_token = create_access_token({"sub": sub, "role": "user"})

        response = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": refresh_token,
        })

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_refresh_token_invalid(self, client):
        """无效的 refresh token 应返回 401"""
        response = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": "invalid.token.here",
        })
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_me_endpoint(self, test_app):
        """获取当前用户信息"""
        from app.dependencies import require_user

        fake_user = MagicMock()
        fake_user.id = str(uuid.uuid4())
        fake_user.username = "testuser"
        fake_user.email = "test@example.com"
        fake_user.role = "user"
        fake_user.is_active = True
        fake_user.created_at = datetime.now(timezone.utc)

        test_app.dependency_overrides[require_user] = lambda: fake_user
        token = create_access_token({"sub": fake_user.id, "role": "user"})

        async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as ac:
            response = await ac.get("/api/v1/auth/me", headers={
                "Authorization": f"Bearer {token}",
            })

        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "testuser"

    @pytest.mark.asyncio
    async def test_root_endpoint(self, client):
        """根路径"""
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "service" in data
        assert "version" in data
