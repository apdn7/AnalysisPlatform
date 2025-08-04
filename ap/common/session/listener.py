import logging
from typing import Any

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Engine, event
from sqlalchemy.orm import Session

from ap.common.services.normalization import model_normalize
from ap.common.session.config_changes import SessionConfigChanges

logger = logging.getLogger(__name__)


class SessionListener:
    @staticmethod
    def make_mapper_events(model):
        @event.listens_for(model, 'before_insert')
        def before_insert(_mapper, _connection, target):
            model_normalize(target)

        @event.listens_for(model, 'before_update')
        def before_update(_mapper, _connection, target):
            model_normalize(target)

        logger.debug('[SessionMeta] Initialized mapper events.')

    @classmethod
    def make_session_events(cls):
        @event.listens_for(Session, 'after_transaction_create')
        def after_transaction_create(session: Session, transaction):
            """listen for the 'after_transaction_create' event

            Add an attribute on top level of transaction to make sure it always presents in session at all times.
            :param Session session: SQLAlchemy session
            :param transaction:
            :return: Void
            """
            SessionConfigChanges.begin(session)

        @event.listens_for(Session, 'after_flush')
        def after_flush(session: Session, flush_context):
            """listen for the 'after_flush' event

            :param Session session: SQLAlchemy session
            :param flush_context:
            :return: Void
            """
            SessionConfigChanges.update(session)

        @event.listens_for(Session, 'before_commit')
        def before_commit(session: Session):
            """listen for the 'before_commit' event

            :param Session session: SQLAlchemy session
            :return: Void
            """
            SessionConfigChanges.update(session)

        @event.listens_for(Session, 'after_transaction_end')
        def after_transaction_end(session: Session, transaction):
            """listen for the 'after_transaction_end' event

            :param Session session: SQLAlchemy session
            :return: Void
            """
            if transaction.parent is None:
                SessionConfigChanges.commit(session)
                SessionConfigChanges.close(session)

        @event.listens_for(Session, 'after_rollback')
        def after_rollback(session: Session):
            """listen for the 'after_rollback' event

            :param Session session: SQLAlchemy session
            :return: Void
            """
            SessionConfigChanges.close(session)

        logger.debug('[SessionMeta] Initialized session events.')

    @staticmethod
    def make_core_events(db: SQLAlchemy, engine: Engine):
        @event.listens_for(engine, 'begin')
        def do_begin(dbapi_conn):
            # Avoid the database lock issue, not sure if this is the best way to do it.
            # dbapi_conn.execute(sa.text('BEGIN IMMEDIATE'))
            ...

        @event.listens_for(engine, 'commit')
        def do_expire(dbapi_conn):
            """
            Expire all objects in `db.session` everytime meta session perform a commit.
            This makes `db.session` removes all cached and queries to database again to get the newest objects
            """
            db.session.expire_all()

    @staticmethod
    def get_models(db: SQLAlchemy) -> tuple[Any, ...]:
        all_sub_classes = db.Model.__subclasses__()
        return tuple([_class for _class in all_sub_classes if hasattr(_class, '__tablename__')])

    @classmethod
    def add_listen_events(cls, db: SQLAlchemy):
        for model in cls.get_models(db):
            cls.make_mapper_events(model)

        cls.make_session_events()
