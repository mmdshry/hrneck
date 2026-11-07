#!/usr/bin/env python3
"""Remote SSH helper for HRNECK deploy. Passwords via env only."""

from __future__ import annotations

import os
import sys

import paramiko

HOST = os.environ.get("HRNECK_SSH_HOST", "15.204.81.140")
USER = os.environ.get("HRNECK_SSH_USER", "root")
PASSWORD = os.environ.get("HRNECK_SSH_PASSWORD", "")


def connect() -> paramiko.SSHClient:
    if not PASSWORD:
        raise SystemExit("Set HRNECK_SSH_PASSWORD")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        HOST,
        port=22,
        username=USER,
        password=PASSWORD,
        timeout=60,
        allow_agent=False,
        look_for_keys=False,
    )
    return client


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str, str]:
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    print(f"=== ({code}) {cmd[:160]}")
    sys.stdout.write(out)
    if err.strip():
        print("ERR:", err[:4000])
    return code, out, err


def main() -> int:
    client = connect()
    try:
        for cmd in sys.argv[1:]:
            run(client, cmd)
    finally:
        client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
