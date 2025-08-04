import dataclasses
import logging
from typing import Optional

from sqlalchemy.orm import Session

from ap import db
from ap.common.cache.handler import CacheHandler
from ap.common.session.meta import SessionMeta
from ap.setting_module.models import (
    CfgFilter,
    CfgFilterDetail,
    CfgProcess,
    CfgProcessColumn,
    CfgProcessFunctionColumn,
    CfgTrace,
    CfgTraceKey,
    CfgVisualization,
)

logger = logging.getLogger(__name__)


@dataclasses.dataclass
class ComputeCacheChanges:
    changed_process_ids: set[int] = dataclasses.field(default_factory=set)
    deleted_process_ids: set[int] = dataclasses.field(default_factory=set)
    compute_traces: bool = False
    compute_process_ids: bool = False

    @property
    def process_ids(self) -> set[int]:
        # exclude deleted ids to avoid computing cache for deleted processes
        return self.changed_process_ids - self.deleted_process_ids

    @property
    def compute_process(self) -> bool:
        return len(self.process_ids) > 0

    def update(self, target: db.Model, is_delete: bool = False) -> None:
        """Update the changes list"""
        process_id = None
        # Models related directly to process config
        if isinstance(target, CfgProcess):
            process_id = target.id
            self.compute_process_ids = True
        elif isinstance(target, (CfgFilter, CfgProcessColumn, CfgVisualization)):
            process_id = target.process_id
        elif isinstance(target, CfgFilterDetail):
            # there are cases where `cfg_filter` is assigned with new `cfg_filter_details`.
            # then some filter detail are popped out, and some filter details are inserted in.
            # e.g: cfg_filter.filter_details = new_filter_details
            # the old filter detail wouldn't know about cfg_filter
            if target.cfg_filter is not None:
                process_id = target.cfg_filter.process_id
        elif isinstance(target, CfgProcessFunctionColumn):
            # similar to cfg filter case
            if target.cfg_process_column is not None:
                process_id = target.cfg_process_column.process_id

        # Models related directly to 2 process configs
        elif isinstance(target, (CfgTrace, CfgTraceKey)):
            self.compute_traces = True

        if process_id is not None:
            self.changed_process_ids.add(int(process_id))
        if is_delete and isinstance(target, CfgProcess):
            # deleted processes will not be triggered to compute cache
            self.deleted_process_ids.add(int(process_id))

    def has_changes(self) -> bool:
        """Whether is there anything to changes"""
        return self.compute_traces or self.compute_process_ids or self.compute_process


class SessionConfigChanges(SessionMeta):
    CACHE_CONFIG_MODELS = (
        CfgProcess,
        CfgProcessColumn,
        CfgProcessFunctionColumn,
        CfgFilter,
        CfgFilterDetail,
        CfgTrace,
        CfgTraceKey,
        CfgVisualization,
    )

    CACHE_CONFIG_KEY = '_cache_config_key'

    @classmethod
    def begin(cls, session: Session, **kwargs):
        setattr(session, cls.CACHE_CONFIG_KEY, ComputeCacheChanges())

    @classmethod
    def update(cls, session: Session, **kwargs):
        """Get all model objects that will be inserted, updated or deleted
        and then update to `config_change_key` attribute into the session.

        :param Session session: SQLAlchemy session
        :return: Void
        """
        updated_targets = [
            target for target in list(session.dirty) + list(session.new) if isinstance(target, cls.CACHE_CONFIG_MODELS)
        ]
        deleted_targets = [target for target in session.deleted if isinstance(target, cls.CACHE_CONFIG_MODELS)]
        changes = cls.changes(session)
        for target in updated_targets:
            changes.update(target)
        for target in deleted_targets:
            changes.update(target, True)

    @classmethod
    def close(cls, session: Session, **kwargs):
        setattr(session, cls.CACHE_CONFIG_KEY, ComputeCacheChanges())

    @classmethod
    def commit(cls, session: Session):
        changes = cls.changes(session)
        if changes is None or not changes.has_changes():
            return

        CacheHandler.compute(
            process_ids=changes.process_ids,
            compute_process=changes.compute_process,
            compute_process_ids=changes.compute_process_ids,
            compute_traces=changes.compute_traces,
            periodic=False,
        )

    @classmethod
    def changes(cls, session: Session) -> Optional[ComputeCacheChanges]:
        return getattr(session, cls.CACHE_CONFIG_KEY, None)
