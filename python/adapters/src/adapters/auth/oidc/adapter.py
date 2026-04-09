from core.domain.models import AuthenticatedUser


class OIDCAuthAdapter:
    def authenticate(self, username: str, password: str) -> AuthenticatedUser | None:
        raise NotImplementedError('OIDC adapter is reserved for enterprise-saas profile')

    def issue_token(self, user: AuthenticatedUser) -> str:
        raise NotImplementedError('OIDC token issuing should be delegated to the identity provider')

    def verify_token(self, token: str) -> AuthenticatedUser | None:
        raise NotImplementedError('OIDC token verification is not implemented in MVP')

    def get_user_roles(self, user_id: str, scope: str) -> list[str]:
        return ['viewer']
