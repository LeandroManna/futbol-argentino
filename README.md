# Liga Argentina 2026

Web estática responsive para consultar fixture, resultados, tablas, promedios y equipos de la Liga Profesional Argentina 2026.

## Tecnologías

- HTML
- CSS
- JavaScript
- Bootstrap 5.3
- JSON local
- Python para regenerar datos

## Uso local

Abrir el proyecto desde un servidor local, por ejemplo XAMPP o:

```bash
python -m http.server 8090
```

Luego ingresar a:

```text
http://localhost:8090/
```

## Actualizar datos

El archivo que consume la web es:

```text
data/app-data.json
```

Para regenerarlo, el script necesita estas variables de entorno:

```text
LIGA_STANDINGS_URL
LIGA_FIXTURE_URL
LIGA_EVENTS_URL
```

Luego ejecutar:

```bash
python scripts/build_app_data.py
```

## Automatización

El workflow de GitHub Actions está en:

```text
.github/workflows/update-data.yml
```

Se puede ejecutar manualmente o por agenda.

## Autor

&copy; 2026 Leandro Manna  
Portfolio: https://leandromanna.com
## Licencia

Este proyecto está publicado bajo licencia MIT.

El software se entrega sin garantías. El uso, interpretación, redistribución o automatización de los datos queda bajo responsabilidad de cada usuario.
