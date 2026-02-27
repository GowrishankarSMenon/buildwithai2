"""
data_loader.py — CSV Data Ingestion Service
Loads inventory and orders data from CSV files using Pandas.
Provides simple lookup helpers for the agent pipeline.
"""

import pandas as pd
import os

# Resolve paths relative to this file so it works from any cwd
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def load_inventory() -> pd.DataFrame:
    """Load the full inventory CSV."""
    return pd.read_csv(os.path.join(DATA_DIR, "inventory.csv"))


def load_orders() -> pd.DataFrame:
    """Load the full orders CSV."""
    return pd.read_csv(os.path.join(DATA_DIR, "orders.csv"))


def get_inventory(product_id: str) -> dict | None:
    """Return inventory row for a product as a dict, or None."""
    df = load_inventory()
    row = df[df["product_id"] == product_id]
    if row.empty:
        return None
    return row.iloc[0].to_dict()


def get_orders(product_id: str) -> list[dict]:
    """Return all orders for a given product as a list of dicts."""
    df = load_orders()
    rows = df[df["product_id"] == product_id]
    return rows.to_dict(orient="records")
