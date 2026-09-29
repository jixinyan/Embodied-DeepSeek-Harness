import argparse
import os
from pathlib import Path
import subprocess
import tomllib


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-config", type=Path, required=True)
    parser.add_argument("--credential-variable", required=True)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if not args.command or not args.credential_variable.isidentifier():
        raise ValueError("A command and credential environment variable are required.")
    config = tomllib.loads(args.source_config.read_text())
    provider = config["model_providers"][config["model_provider"]]
    credential = os.environ.get(provider.get("env_key", ""), "") or provider.get("experimental_bearer_token", "")
    if not credential or any(character.isspace() for character in credential):
        raise ValueError("The selected provider credential is missing or invalid.")
    environment = dict(os.environ)
    environment[args.credential_variable] = credential
    result = subprocess.run(args.command, env=environment, check=False)
    raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
