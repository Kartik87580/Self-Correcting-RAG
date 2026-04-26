from pydantic import BaseModel, EmailStr
from datetime import datetime


class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserSignin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
