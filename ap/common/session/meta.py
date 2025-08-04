import logging
from abc import ABCMeta, abstractmethod

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class SessionMeta(ABCMeta):
    @classmethod
    @abstractmethod
    def begin(cls, session: Session):
        """Init metadata on current session variable.

        :param Session session: SQLAlchemy session
        :return: Void
        """

    @classmethod
    @abstractmethod
    def update(cls, session: Session):
        """Update metadata on current session variable.

        :param Session session: SQLAlchemy session
        :return: Void
        """

    @classmethod
    @abstractmethod
    def close(cls, session: Session):
        """Close metadata on current session variable

        :param Session session: SQLAlchemy session
        :return: Void
        """

    @classmethod
    @abstractmethod
    def commit(cls, session: Session):
        """Commit metadata on current session variable

        :param Session session: SQLAlchemy session
        :return: Void
        """
