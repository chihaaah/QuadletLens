# Compose2Quadlet

Convert Docker Compose files to Podman Quadlet units entirely in your browser.

## Features

- Convert Docker Compose YAML to Podman Quadlet
- Generate `.container`, `.network`, and `.volume` files
- Detect unsupported or partially supported Compose options
- No server-side upload
- Runs entirely in your browser

## Status

🚧 Early development

## Example

Docker Compose:

```yaml
services:
  web:
    image: nginx:latest
    ports:
      - "8080:80"
