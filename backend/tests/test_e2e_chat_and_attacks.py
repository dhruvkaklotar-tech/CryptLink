import pytest

from tests.test_e2e_full_simulation import run_full_suite


@pytest.mark.asyncio
async def test_cryptlink_e2e_and_attacks():
    """
    Executes full 2-user encrypted chat simulation and 7 attack vector tests.
    """
    await run_full_suite()
