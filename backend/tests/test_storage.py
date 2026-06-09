"""
测试文件存储后端。
"""

import os
import tempfile
import shutil
from uuid import UUID

import pytest

from app.core.storage import StorageBackend


class TestStorageBackend:
    """StorageBackend 本地文件存储测试"""

    @pytest.fixture
    def temp_storage(self):
        """创建临时存储目录"""
        tmp_dir = tempfile.mkdtemp()
        storage = StorageBackend(base_dir=tmp_dir)
        yield storage
        shutil.rmtree(tmp_dir)

    @pytest.fixture
    def sample_uuid(self):
        return UUID("550e8400-e29b-41d4-a716-446655440000")

    def test_storage_init_creates_dirs(self, temp_storage):
        """初始化自动创建目录"""
        assert temp_storage.base_dir.exists()
        assert temp_storage.uploads_dir.exists()
        assert temp_storage.outputs_dir.exists()

    def test_save_and_get_upload(self, temp_storage, sample_uuid):
        """保存上传文件并获取路径"""
        content = b"fake audio content"
        filepath = temp_storage.save_upload(sample_uuid, "test.mp3", content)

        assert os.path.exists(filepath)
        assert os.path.getsize(filepath) == len(content)

        # 验证获取路径
        expected_path = temp_storage.save_upload(sample_uuid, "test.mp3", content)
        get_path = temp_storage.get_upload_path(sample_uuid, "test.mp3")
        assert get_path == expected_path

    def test_save_output_text(self, temp_storage, sample_uuid):
        """保存文本输出文件"""
        content = "Hello, world!"
        filepath = temp_storage.save_output(sample_uuid, "output.txt", content)

        assert os.path.exists(filepath)
        with open(filepath, "r", encoding="utf-8") as f:
            assert f.read() == content

    def test_save_output_binary(self, temp_storage, sample_uuid):
        """保存二进制输出文件"""
        content = b"\x00\x01\x02\x03"
        filepath = temp_storage.save_output(sample_uuid, "output.bin", content)

        with open(filepath, "rb") as f:
            assert f.read() == content

    def test_get_output_dir_creates(self, temp_storage, sample_uuid):
        """获取输出目录时自动创建"""
        output_dir = temp_storage.get_output_dir(sample_uuid)
        assert os.path.isdir(output_dir)
        assert str(sample_uuid) in output_dir

    def test_file_size(self, temp_storage, sample_uuid):
        """获取文件大小"""
        content = b"x" * 1024
        filepath = temp_storage.save_output(sample_uuid, "1kb.txt", content)
        assert temp_storage.file_size(filepath) == 1024

    def test_delete_task_files(self, temp_storage, sample_uuid):
        """删除任务相关文件"""
        temp_storage.save_upload(sample_uuid, "input.mp3", b"data")
        temp_storage.save_output(sample_uuid, "output.srt", "data")

        upload_dir = temp_storage.uploads_dir / str(sample_uuid)
        output_dir = temp_storage.outputs_dir / str(sample_uuid)
        assert upload_dir.exists()
        assert output_dir.exists()

        temp_storage.delete_task_files(sample_uuid)
        assert not upload_dir.exists()
        assert not output_dir.exists()

    def test_cleanup_expired(self, temp_storage):
        """清理过期文件"""
        old_id = UUID("00000000-0000-0000-0000-000000000001")
        new_id = UUID("00000000-0000-0000-0000-000000000002")

        temp_storage.save_output(new_id, "new.txt", "new data")
        temp_storage.save_output(old_id, "old.txt", "old data")

        # 把 old 目录的修改时间设为 10 天前
        old_dir = temp_storage.outputs_dir / str(old_id)
        old_time = os.path.getmtime(str(old_dir)) - 10 * 86400
        os.utime(str(old_dir), (old_time, old_time))

        # 清理 7 天前的文件
        temp_storage.cleanup_expired(days=7)

        assert not old_dir.exists()  # 应被清理
        assert (temp_storage.outputs_dir / str(new_id)).exists()  # 应保留

    def test_multiple_task_isolation(self, temp_storage):
        """不同任务的文件应隔离"""
        id1 = UUID("11111111-1111-1111-1111-111111111111")
        id2 = UUID("22222222-2222-2222-2222-222222222222")

        temp_storage.save_output(id1, "task1.txt", "任务1")
        temp_storage.save_output(id2, "task2.txt", "任务2")

        assert os.path.exists(temp_storage.get_output_path(id1, "task1.txt"))
        assert not os.path.exists(temp_storage.get_output_path(id1, "task2.txt"))
        assert os.path.exists(temp_storage.get_output_path(id2, "task2.txt"))
