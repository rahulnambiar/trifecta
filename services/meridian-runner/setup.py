"""Packaging for the Meridian runner (installable into the training container)."""
from setuptools import find_packages, setup

setup(
    name="meridian-runner",
    version="0.1.0",
    description="Trifecta Phase 0 — train Meridian on the simulated dataset; export model.pkl + results.json.",
    packages=find_packages(exclude=("vertex",)),
    python_requires=">=3.10",
    install_requires=[
        "google-meridian>=1.3,<2",
        "google-cloud-storage>=2.16",
        "pandas>=2.0",
        "numpy>=1.26",
        "xarray>=2024.0",
    ],
)
