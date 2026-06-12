from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_user
from app.models.user import User
from app.schemas.auth import (
    UserRegister, UserLogin, TokenResponse, RefreshRequest, UserResponse
)
from app.services.auth_service import auth_service
from app.core.security import decode_access_token, create_access_token
from app.database import get_db

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/register", response_model=UserResponse)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    try:
        user = await auth_service.register(db, data.username, data.email, data.password)
        return UserResponse(
            id=str(user.id),
            username=user.username,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            created_at=str(user.created_at),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    try:
        user, access_token, refresh_token = await auth_service.login(db, data.username, data.password)
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshRequest):
    try:
        payload = decode_access_token(data.refresh_token)
        user_id = payload.get("sub")
        role = payload.get("role", "user")
        new_access_token = create_access_token({"sub": user_id, "role": role})
        return TokenResponse(access_token=new_access_token, refresh_token=data.refresh_token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="refresh token 已过期或无效")


@router.get("/admin-exists")
async def admin_exists(db: AsyncSession = Depends(get_db)):
    """检查系统中是否存在管理员（公开接口）"""
    exists = await auth_service.admin_exists(db)
    return {"exists": exists}


@router.post("/register-admin", response_model=UserResponse)
async def register_admin(data: UserRegister, db: AsyncSession = Depends(get_db)):
    """注册初始管理员（仅当系统中尚无管理员时可用）"""
    try:
        user = await auth_service.register_admin(db, data.username, data.email, data.password)
        await db.commit()
        return UserResponse(
            id=str(user.id),
            username=user.username,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            created_at=str(user.created_at),
        )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(require_user)):
    return UserResponse(
        id=str(current_user.id),
        username=current_user.username,
        email=current_user.email,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=str(current_user.created_at),
    )
