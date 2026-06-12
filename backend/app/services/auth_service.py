from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token


class AuthService:

    @staticmethod
    async def register(db: AsyncSession, username: str, email: str, password: str) -> User:
        """用户注册"""
        # 检查是否已存在
        result = await db.execute(select(User).where(
            (User.username == username) | (User.email == email)
        ))
        existing = result.scalar_one_or_none()
        if existing:
            if existing.username == username:
                raise ValueError("用户名已存在")
            raise ValueError("邮箱已被注册")

        user = User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            role="user",
        )
        db.add(user)
        await db.flush()
        return user

    @staticmethod
    async def register_admin(db: AsyncSession, username: str, email: str, password: str) -> User:
        """注册初始管理员（仅当系统中尚无管理员时可用）"""
        # 检查是否已有管理员
        result = await db.execute(select(User).where(User.role == "admin"))
        existing_admin = result.scalar_one_or_none()
        if existing_admin:
            raise PermissionError("系统中已存在管理员，无法重复创建")

        # 检查用户名/邮箱是否已被占用
        result = await db.execute(select(User).where(
            (User.username == username) | (User.email == email)
        ))
        existing = result.scalar_one_or_none()
        if existing:
            if existing.username == username:
                raise ValueError("用户名已存在")
            raise ValueError("邮箱已被注册")

        user = User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            role="admin",
        )
        db.add(user)
        await db.flush()
        return user

    @staticmethod
    async def admin_exists(db: AsyncSession) -> bool:
        """检查系统中是否存在管理员"""
        result = await db.execute(select(User).where(User.role == "admin"))
        return result.scalar_one_or_none() is not None

    @staticmethod
    async def login(db: AsyncSession, username: str, password: str) -> tuple[User, str, str]:
        """用户登录，返回 (user, access_token, refresh_token)"""
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()

        if user is None:
            # 尝试用邮箱登录
            result = await db.execute(select(User).where(User.email == username))
            user = result.scalar_one_or_none()

        if user is None or not verify_password(password, user.password_hash):
            raise ValueError("用户名或密码错误")

        if not user.is_active:
            raise ValueError("账号已被禁用")

        access_token = create_access_token({"sub": str(user.id), "role": user.role})
        refresh_token = create_refresh_token({"sub": str(user.id), "role": user.role})
        return user, access_token, refresh_token


auth_service = AuthService()
