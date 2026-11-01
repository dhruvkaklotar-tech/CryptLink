"""
CryptLink Engineering | 2026
Common Pydantic schemas for API responses
"""

from pydantic import BaseModel


class RootResponse(BaseModel):
    """
    Root endpoint response schema
    """

    app: str
    version: str
    status: str
    environment: str


class HealthResponse(BaseModel):
    """
    Health check endpoint response schema
    """

    status: str
