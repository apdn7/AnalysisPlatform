from filelock import FileLock

from ap.common.path_utils import gen_duckdb_file_name


class DuckDBLock:
    """File-based lock duckdb, this manages multiple processes. We must sort `processes` to avoid deadlock."""

    def __init__(self, process_ids: list[int]) -> None:
        self.process_ids: list[int] = process_ids
        self.process_ids.sort()
        self.lock_files: list[FileLock] = []

    def __repr__(self) -> str:
        """Represent DuckDBLock str"""
        process_ids = f'process_ids=[{",".join(map(str, self.process_ids))}]'
        lock_files = []
        for lock_file in self.lock_files:
            lock_files.append(f'({lock_file.is_locked}, {lock_file.lock_file})')
        lock_files = f'locks=[{",".join(lock_files)}]'
        return f'<{process_ids},{lock_files}>'

    @classmethod
    def gen_lock_file_name(cls, process_id: int) -> str:
        return f'{gen_duckdb_file_name(process_id)}.lock'

    def acquire(self) -> None:
        for process_id in self.process_ids:
            lock_file = FileLock(self.gen_lock_file_name(process_id))
            self.lock_files.append(lock_file)
            lock_file.acquire()

    def release(self) -> None:
        while self.lock_files:
            lock_file = self.lock_files.pop()
            lock_file.release()
