"""Render the pinned official Harbor template. Requires Jinja2==3.1.6 only for regeneration."""
import hashlib
import json
from pathlib import Path

from jinja2 import StrictUndefined
from jinja2.sandbox import SandboxedEnvironment

directory = Path(__file__).resolve().parent
template = (directory / "docker-compose.yml.jinja").read_bytes()
expected = "1534979060530a7927a29e4807aac32e08900cff6f00e895b4282751e9a5642e"
if hashlib.sha256(template).hexdigest() != expected:
    raise SystemExit("Official template checksum mismatch")
profile = json.loads((directory / "profile.json").read_text(encoding="utf-8"))
environment = SandboxedEnvironment(
    undefined=StrictUndefined, trim_blocks=True, lstrip_blocks=True, autoescape=False
)
rendered = environment.from_string(template.decode("utf-8")).render(**profile)
(directory / "docker-compose.yml").write_bytes(rendered.encode("utf-8"))
print("Rendered official Harbor template: docker-compose.yml")
