#!/usr/bin/env python3
import json
import os
import sys
import re

if len(sys.argv) < 4:
    print("usage: render-taskdef.py <input.json> <output.json> <ecr_registry>")
    sys.exit(1)

src, dst, ecr_registry = sys.argv[1:4]
region = os.environ.get("AWS_REGION", "eu-west-1")
account = os.environ.get("AWS_ACCOUNT_ID", "495219734037")

with open(src, "r", encoding="utf-8") as f:
    data = json.load(f)

placeholder_re = re.compile(r"\{\{orya/prod/([^}]+)\}\}")

def replace_value(value):
    if isinstance(value, str):
        if value == "{{ECR_URI}}":
            return ecr_registry
        m = placeholder_re.search(value)
        if m:
            name = m.group(1)
            return f"arn:aws:secretsmanager:{region}:{account}:secret:orya/prod/{name}"
        return value
    if isinstance(value, list):
        return [replace_value(v) for v in value]
    if isinstance(value, dict):
        return {k: replace_value(v) for k, v in value.items()}
    return value

rendered = replace_value(data)

with open(dst, "w", encoding="utf-8") as f:
    json.dump(rendered, f, indent=2)
