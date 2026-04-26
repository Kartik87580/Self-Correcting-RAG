#!/usr/bin/env bash
# exit on error
set -o errexit

echo "--- Upgrading Pip ---"
python -m pip install --upgrade pip

echo "--- Installing Dependencies (Binary Only) ---"
# --only-binary=:all: ensures we never try to compile from source.
# If a package doesn't have a wheel for the current python version, this will fail fast.
pip install --only-binary=:all: -r requirements.txt
