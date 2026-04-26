"""
Auth API — signup, signin, me
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from core.database import get_db
from core.auth import hash_password, verify_password, create_access_token, decode_token, oauth2_scheme
from models.user import User
from schemas.user import UserSignup, UserSignin, UserResponse, TokenResponse

router = APIRouter()


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: UserSignup, db: AsyncSession = Depends(get_db)):
    # Check if email already exists
    result = await db.execute(select(User).filter(User.email == body.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"user_id": user.id})
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/signin", response_model=TokenResponse)
async def signin(body: UserSignin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.email == body.email))
    user = result.scalars().first()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"user_id": user.id})
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    payload = decode_token(token)
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return UserResponse.model_validate(user)
