#!/usr/bin/env bash
# exit on error
set -o errexit

# Upgrade pip
python -m pip install --upgrade pip

# Install dependencies
# We use --prefer-binary to avoid building rust crates from source when possible
pip install --prefer-binary -r requirements.txt
