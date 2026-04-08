import base64
import json

from core.domain.models import AuthenticatedUser


class LocalAuthAdapter:
    def authenticate(self, username: str, password: str) -> AuthenticatedUser | None:
        if not username or not password:
            return None
        return AuthenticatedUser(
            user_id=username,
            email=f'{username}@local.dev',
            display_name=username,
            roles=['admin'],
        )

    def issue_token(self, user: AuthenticatedUser) -> str:
        payload = json.dumps(user.model_dump()).encode()
        return base64.urlsafe_b64encode(payload).decode()

    def verify_token(self, token: str) -> AuthenticatedUser | None:
        try:
            payload = base64.urlsafe_b64decode(token.encode()).decode()
            return AuthenticatedUser(**json.loads(payload))
        except Exception:
            return None

    def get_user_roles(self, user_id: str, scope: str) -> list[str]:
        return ['admin']
