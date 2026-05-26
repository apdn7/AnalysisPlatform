import sqlite3
import duckdb
import pandas as pd
from pathlib import Path


logging.basicConfig(level=logging.INFO, format="%(message)s")
from loguru import logger


# ----------------------- Helper functions -----------------------
def save_df(df: pd.DataFrame, export_folder: Path, table_name: str, sqlite: bool):
    df = df.convert_dtypes().astype('string')
    df = df[sorted(df.columns)]

    # unsorted
    if sqlite:
        csv_file = Path(export_folder) / f"unsorted_{table_name}_sqlite.csv"
    else:
        csv_file = Path(export_folder) / f"unsorted_{table_name}_duckdb.csv"
    df.to_csv(csv_file, index=False)

    # sorted
    if sqlite:
        csv_file = Path(export_folder) / f"sorted_{table_name}_sqlite.csv"
    else:
        csv_file = Path(export_folder) / f"sorted_{table_name}_duckdb.csv"
    df = df.sort_values(by=sorted(df.columns))
    df.to_csv(csv_file, index=False)


def export_sqlite_to_csv(sqlite_file, export_folder):
    """Export SQLite table to CSV in the export folder (skip if exists)."""
    table_name = sqlite_file.stem

    # skip exporting
    csv_file = Path(export_folder) / f"sorted_{table_name}_sqlite.csv"
    if csv_file.exists():
        logger.info(f"⏩ Skipping export, file already exists: {csv_file}")
        return

    logger.info(f"📤 Exporting SQLite table '{table_name}'")

    conn = sqlite3.connect(sqlite_file)
    query = f"SELECT * FROM {table_name}"

    df = pd.read_sql_query(query, conn)
    save_df(df, export_folder, table_name, True)
    conn.close()

    logger.info(f"✅ Exported SQLite table to {csv_file}")


def export_duckdb_to_csv(duckdb_file, export_folder):
    """Export DuckDB table to CSV in the export folder (skip if exists)."""
    table_name = duckdb_file.stem
    csv_file = Path(export_folder) / f"sorted_{table_name}_duckdb.csv"
    if csv_file.exists():
        logger.info(f"⏩ Skipping export, file already exists: {csv_file}")
        return

    logger.info(f"📤 Exporting DuckDB table '{table_name}'")

    conn = duckdb.connect(duckdb_file)
    query = f"SELECT * FROM {table_name}"

    df = conn.execute(query).df()
    save_df(df, export_folder, table_name, False)
    conn.close()

    logger.info(f"✅ Exported DuckDB table to {csv_file}")


# ----------------------------- Main ------------------------------

def main(sqlite_folder, duckdb_folder, export_folder):
    export_folder = Path(export_folder)
    export_folder.mkdir(parents=True, exist_ok=True)

    sqlite_files = sorted(Path(sqlite_folder).glob("*.sqlite3"))
    duckdb_files = sorted(Path(duckdb_folder).glob("*.duckdb"))

    # 1️⃣ Export all first
    for sqlite_file, duckdb_file in zip(sqlite_files, duckdb_files):
        assert sqlite_file.stem == duckdb_file.stem, f"File mismatch: {sqlite_file} vs {duckdb_file}"
        table_name = sqlite_file.stem

        logger.info(f"\n🚀 Processing table '{table_name}'...")

        # Export both sorted and unsorted variants
        export_sqlite_to_csv(sqlite_file, export_folder)
        export_duckdb_to_csv(duckdb_file, export_folder)

if __name__ == "__main__":
    main(
        sqlite_folder=r"C:\workspace\sqlite3_duckdb_comparison\sqlite3",
        duckdb_folder=r"C:\workspace\sqlite3_duckdb_comparison\duckdb",
        export_folder=r"C:\workspace\sqlite3_duckdb_comparison\exported",
    )
