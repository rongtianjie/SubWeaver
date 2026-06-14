"""
测试 Pydantic Schemas：验证请求/响应模型的验证规则。
"""

import pytest
from pydantic import ValidationError

from app.schemas.auth import UserRegister, UserLogin, TokenResponse, RefreshRequest, UserResponse
from app.schemas.task import TaskCreate, TaskResponse, TaskOutputResponse, TaskListResponse, QueueStatusResponse
from app.schemas.admin import ConfigUpdate, ConfigResponse, AdminStats, UserRoleUpdate, HealthCheckItem


class TestAuthSchemas:
    """认证相关 schema 测试"""

    def test_valid_user_register(self):
        data = UserRegister(username="testuser", email="test@example.com", password="password123")
        assert data.username == "testuser"
        assert data.email == "test@example.com"

    def test_username_too_short(self):
        with pytest.raises(ValidationError):
            UserRegister(username="ab", email="test@example.com", password="password123")

    def test_username_too_long(self):
        with pytest.raises(ValidationError):
            UserRegister(username="a" * 51, email="test@example.com", password="password123")

    def test_invalid_email(self):
        with pytest.raises(ValidationError):
            UserRegister(username="testuser", email="not-an-email", password="password123")

    def test_password_too_short(self):
        with pytest.raises(ValidationError):
            UserRegister(username="testuser", email="test@example.com", password="12345")

    def test_password_too_long(self):
        with pytest.raises(ValidationError):
            UserRegister(username="testuser", email="test@example.com", password="x" * 101)

    def test_valid_user_login(self):
        data = UserLogin(username="testuser", password="password123")
        assert data.username == "testuser"
        assert data.password == "password123"

    def test_token_response(self):
        data = TokenResponse(access_token="abc.def.ghi", refresh_token="jkl.mno.pqr")
        assert data.token_type == "bearer"
        assert data.access_token == "abc.def.ghi"

    def test_refresh_request(self):
        data = RefreshRequest(refresh_token="some.token.here")
        assert data.refresh_token == "some.token.here"

    def test_user_response(self):
        data = UserResponse(
            id="uuid-1", username="test", email="test@example.com",
            role="user", is_active=True, created_at="2024-01-01T00:00:00Z"
        )
        assert data.role == "user"
        assert data.is_active is True


class TestTaskSchemas:
    """任务相关 schema 测试"""

    def test_valid_task_create_url(self):
        data = TaskCreate(
            source_type="url",
            source_url="https://youtube.com/watch?v=test",
            whisper_model="small",
            output_formats=["txt", "srt"],
            translate_target_langs=["zh", "ja"],
        )
        assert data.source_type == "url"
        assert data.whisper_model == "small"

    def test_invalid_source_type(self):
        with pytest.raises(ValidationError):
            TaskCreate(source_type="invalid")

    def test_invalid_whisper_model(self):
        with pytest.raises(ValidationError):
            TaskCreate(source_type="url", source_url="https://example.com/v.mp4", whisper_model="gpt-4")

    def test_default_values(self):
        data = TaskCreate(source_type="url", source_url="https://example.com/v.mp4")
        assert data.whisper_model == "base"
        assert data.output_formats == ["txt", "srt", "bilingual_srt"]
        assert data.translate_target_langs is None

    def test_task_response_creation(self):
        data = TaskResponse(
            id="uuid-1", title="Test Task", source_type="url",
            whisper_model="base", output_formats=["txt"], status="pending",
            progress=0.0, created_at="2024-01-01T00:00:00Z",
        )
        assert data.status == "pending"
        assert data.progress == 0.0

    def test_task_output_response(self):
        data = TaskOutputResponse(
            id="out-1", task_id="task-1", format_type="srt",
            language_pair="en-zh", file_path="/tmp/test.srt",
            created_at="2024-01-01T00:00:00Z",
        )
        assert data.format_type == "srt"
        assert data.language_pair == "en-zh"

    def test_task_list_response(self):
        data = TaskListResponse(tasks=[], total=0, page=1, page_size=20)
        assert data.total == 0

    def test_queue_status_response(self):
        data = QueueStatusResponse(pending_count=3, processing_count=1, avg_duration=300)
        assert data.pending_count == 3


class TestAdminSchemas:
    """管理后台 schema 测试"""

    def test_config_update(self):
        data = ConfigUpdate(value=100, description="最大并发数")
        assert data.value == 100

    def test_config_response(self):
        data = ConfigResponse(key="max_tasks", value=5)
        assert data.key == "max_tasks"

    def test_admin_stats(self):
        data = AdminStats(
            total_tasks=100, pending_tasks=10, processing_tasks=2,
            completed_tasks=85, failed_tasks=3, cancelled_tasks=0, total_users=50,
            storage_usage_mb=1024.5,
        )
        assert data.total_tasks == 100

    def test_user_role_update_valid(self):
        data = UserRoleUpdate(role="admin")
        assert data.role == "admin"

    def test_health_check_item(self):
        data = HealthCheckItem(name="数据库", status=True, severity="info", message="正常")
        assert data.status is True
