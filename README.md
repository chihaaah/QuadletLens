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
```

Generated Quadlet:

```ini
[Container]
Image=nginx:latest
PublishPort=8080:80
```

## Planned Features

- Compose compatibility diagnostics
- `.container` generation
- `.network` generation
- `.volume` generation
- Multi-container Compose support
- Harbor Compose conversion
- Download generated Quadlet files as ZIP

## Privacy

Compose files are processed entirely in your browser and are not uploaded to a server.

## License

Apache-2.0
