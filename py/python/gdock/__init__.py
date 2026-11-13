"""Python bindings for gdock."""

from importlib.metadata import version as _version

from gdock._internal import (
    cluster_contacts,
    contacts,
    dock,
    generate_restraints,
    score,
    tbl_to_pairs,
)

__version__ = _version("gdock")
__all__ = [
    "cluster_contacts",
    "contacts",
    "dock",
    "generate_restraints",
    "score",
    "tbl_to_pairs",
]
