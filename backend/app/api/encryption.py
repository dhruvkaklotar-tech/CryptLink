"""
©AngelaMos | 2026
encryption.py
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.dependencies import current_user
from app.models.Base import get_session
from app.models.User import User
from app.services.prekey_service import PreKeyBundle, prekey_service


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/encryption", tags=["encryption"])


class ClientKeysUpload(BaseModel):
    """
    Request body for uploading client generated public keys
    """

    identity_key: str
    identity_key_ed25519: str
    signed_prekey: str
    signed_prekey_signature: str
    one_time_prekeys: list[str]


@router.get(
    "/prekey-bundle/{user_id}",
    status_code=status.HTTP_200_OK,
    response_model=PreKeyBundle,
)
async def get_prekey_bundle(
    user_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> PreKeyBundle:
    """
    Returns a prekey bundle for initiating X3DH with the target user
    """
    bundle = await prekey_service.get_prekey_bundle(session, user_id)
    return bundle


@router.get(
    "/public-identity/{user_id}",
    status_code=status.HTTP_200_OK,
    response_model=PreKeyBundle,
)
async def get_public_identity(
    user_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> PreKeyBundle:
    """
    Returns public identity keys for audit, verification, and fingerprints without consuming OPKs
    """
    return await prekey_service.get_public_identity(session, user_id)


@router.post("/upload-keys/{user_id}", status_code=status.HTTP_201_CREATED)
async def upload_client_keys(
    user_id: UUID,
    keys: ClientKeysUpload,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    """
    Stores client generated public keys for E2E encryption.
    Authenticates the user and verifies they are only modifying their own keys,
    preventing unauthorized key substitution attacks (MitM).
    """
    if user.id != user_id:
        logger.warning(
            "User %s attempted unauthorized key upload for user %s",
            user.id,
            user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Cannot upload keys for another user",
        )

    await prekey_service.store_client_keys(
        session,
        user_id,
        keys.identity_key,
        keys.identity_key_ed25519,
        keys.signed_prekey,
        keys.signed_prekey_signature,
        keys.one_time_prekeys,
    )
    return {
        "status": "success",
        "message": f"Stored client keys for user {user_id}",
    }
